import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  scanForPlaceholders,
  generateDocx,
  generatePdf,
  generateExportFilename,
  getDocxMimeType,
  getPdfMimeType,
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
            type: true,
            isMandatory: true,
            isAttestation: true,
            complianceStatus: true,
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

    // Check for non-compliant items (non-blocking warnings)
    const nonCompliantMandatory = project.requirements.filter(
      (r) => r.isAttestation && r.complianceStatus === "NON_COMPLIANT" && r.isMandatory
    );
    const nonCompliantOptional = project.requirements.filter(
      (r) => r.isAttestation && r.complianceStatus === "NON_COMPLIANT" && !r.isMandatory
    );

    // Count contextual requirements (internal use only, not exported)
    const contextualCount = project.requirements.filter(
      (r) => r.type === "CONTEXTUAL"
    ).length;

    return NextResponse.json({
      hasBlockers: scanResult.hasBlockers,
      placeholders: scanResult,
      existingExports: project.exports,
      contextualCount,
      nonCompliantWarnings: {
        mandatory: nonCompliantMandatory.map((r) => ({
          id: r.id,
          text: r.text.slice(0, 100) + (r.text.length > 100 ? "..." : ""),
        })),
        optional: nonCompliantOptional.map((r) => ({
          id: r.id,
          text: r.text.slice(0, 100) + (r.text.length > 100 ? "..." : ""),
        })),
        hasMandatoryNonCompliant: nonCompliantMandatory.length > 0,
        totalNonCompliant: nonCompliantMandatory.length + nonCompliantOptional.length,
      },
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
            isAttestation: true,
            complianceStatus: true,
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

    // Filter out CONTEXTUAL requirements (internal use only, not exported)
    const exportableRequirements = project.requirements.filter(
      r => r.type !== "CONTEXTUAL"
    );

    // Generate document
    const requirements: RequirementForExport[] = exportableRequirements.map((r) => ({
      id: r.id,
      text: r.text,
      section: r.section,
      isMandatory: r.isMandatory,
      draftAnswer: r.draftAnswer,
      status: r.status as "UNANSWERED" | "PARTIAL" | "ANSWERED",
      type: r.type,
      order: r.order,
      isAttestation: r.isAttestation,
      complianceStatus: r.complianceStatus as "PENDING" | "COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE" | undefined,
    }));

    const options = {
      template: template as ExportTemplate,
      includeDraft: forceDraft && scanResult.hasBlockers,
      projectName: project.name,
      companyName: project.companyName,
      deadline: project.deadline,
    };

    // Generate document based on format
    let buffer: Buffer;
    let mimeType: string;

    if (format === "pdf") {
      buffer = await generatePdf(requirements, options);
      mimeType = getPdfMimeType();
    } else {
      buffer = await generateDocx(requirements, options);
      mimeType = getDocxMimeType();
    }

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
        "Content-Type": mimeType,
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
