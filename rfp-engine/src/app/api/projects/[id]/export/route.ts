import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  scanForPlaceholders,
  generateDocx,
  generateExportFilename,
  getDocxMimeType,
  type ExportTemplate,
  type RequirementForExport,
} from "@/lib/export";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/export
 *
 * Check for placeholders and list existing exports
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        requirements: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            text: true,
            draftAnswer: true,
            order: true,
            // NOTE: internalNotes deliberately excluded
          },
        },
        exports: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            format: true,
            template: true,
            isDraft: true,
            fileName: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Scan for placeholders
    const scanResult = scanForPlaceholders(project.requirements);

    return NextResponse.json({
      hasBlockers: scanResult.hasBlockers,
      placeholders: scanResult,
      existingExports: project.exports,
    });
  } catch (error) {
    console.error("Export check error:", error);
    return NextResponse.json(
      { error: "Failed to check export status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/export
 *
 * Generate export, save to database, and return file download
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { format, template, forceDraft } = body;

    // Validate format
    if (!["docx", "pdf"].includes(format)) {
      return NextResponse.json({ error: "Invalid format. Must be 'docx' or 'pdf'." }, { status: 400 });
    }

    // Validate template
    if (!["compliance-matrix", "qa-format"].includes(template)) {
      return NextResponse.json({ error: "Invalid template." }, { status: 400 });
    }

    // PDF not yet implemented
    if (format === "pdf") {
      return NextResponse.json(
        { error: "PDF export is not yet available. Please use Word format." },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        requirements: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            text: true,
            section: true,
            isMandatory: true,
            draftAnswer: true,
            status: true,
            type: true,
            order: true,
            // NOTE: internalNotes deliberately excluded - NEVER export
          },
        },
      },
    });

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check for placeholders
    const scanResult = scanForPlaceholders(
      project.requirements.map((r) => ({
        id: r.id,
        text: r.text,
        draftAnswer: r.draftAnswer,
        order: r.order,
      }))
    );

    if (scanResult.hasBlockers && !forceDraft) {
      return NextResponse.json(
        {
          error: "Export blocked due to unfinished content",
          placeholders: scanResult,
        },
        { status: 422 }
      );
    }

    // Generate document
    const requirements: RequirementForExport[] = project.requirements.map((r) => ({
      id: r.id,
      text: r.text,
      section: r.section,
      isMandatory: r.isMandatory,
      draftAnswer: r.draftAnswer,
      status: r.status as "UNANSWERED" | "PARTIAL" | "ANSWERED",
      type: r.type,
      order: r.order,
    }));

    const options = {
      template: template as ExportTemplate,
      includeDraft: forceDraft && scanResult.hasBlockers,
      projectName: project.name,
      companyName: project.companyName,
      deadline: project.deadline,
    };

    const buffer = await generateDocx(requirements, options);
    const fileName = generateExportFilename(project.name, template as ExportTemplate, format);

    // Save to database for re-download
    // Convert Buffer to Uint8Array for Prisma Bytes field
    const fileData = new Uint8Array(buffer);
    const exportRecord = await prisma.projectExport.create({
      data: {
        projectId: project.id,
        format,
        template,
        isDraft: options.includeDraft,
        fileName,
        fileData,
        fileSize: buffer.length,
      },
    });

    // Return the file for download
    return new NextResponse(fileData, {
      status: 200,
      headers: {
        "Content-Type": getDocxMimeType(),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Export-Id": exportRecord.id,
      },
    });
  } catch (error) {
    console.error("Export generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
