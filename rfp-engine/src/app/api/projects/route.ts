import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePDF } from "@/lib/parsers/pdf";
import { parseDOCX } from "@/lib/parsers/docx";
import { extractRequirements } from "@/lib/openai";
import { checkAndIncrementQuota } from "@/lib/quota";
import fileType from "file-type";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";
import { rateLimiters, rateLimitHeaders } from "@/lib/rate-limit";

// Security constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_PROJECT_NAME_LENGTH = 255;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimit = rateLimiters.projects(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    // Quota check - re-enabled for security
    const quotaCheck = await checkAndIncrementQuota(session.user.id, false);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: "Monthly extraction limit reached. Please upgrade your plan.",
          remaining: 0,
          limit: quotaCheck.limit,
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const allowDuplicate = formData.get("allowDuplicate") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate project name length
    if (name && name.length > MAX_PROJECT_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Project name must not exceed ${MAX_PROJECT_NAME_LENGTH} characters` },
        { status: 400 }
      );
    }

    const fileName = file.name;

    // Check for duplicate file name
    if (!allowDuplicate) {
      const existingProject = await prisma.project.findFirst({
        where: {
          userId: session.user.id,
          fileName: fileName,
        },
        select: { id: true, name: true },
      });

      if (existingProject) {
        return NextResponse.json(
          {
            error: "duplicate",
            message: `A project with the file "${fileName}" already exists: "${existingProject.name}"`,
            existingProjectId: existingProject.id,
            existingProjectName: existingProject.name,
          },
          { status: 409 }
        );
      }
    }
    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Security: Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum file size is 10MB." },
        { status: 400 }
      );
    }

    // Security: Validate file type using magic bytes (not just extension)
    const detectedType = await fileType.fromBuffer(buffer);
    const fileExtension = fileName.split(".").pop()?.toLowerCase();

    // Check magic bytes for actual file type
    if (!detectedType || !ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
      // Fallback: also check extension for DOCX files (sometimes magic bytes detection fails)
      const isDocxExtension = fileExtension === "docx" || fileExtension === "doc";
      const isPdfExtension = fileExtension === "pdf";

      if (!isDocxExtension && !isPdfExtension) {
        return NextResponse.json(
          { error: "Invalid file type. Only PDF and DOCX files are allowed." },
          { status: 400 }
        );
      }
    }

    // Parse document based on validated type
    let rawText: string;
    const detectedMime = detectedType?.mime;

    if (detectedMime === "application/pdf" || fileExtension === "pdf") {
      rawText = await parsePDF(buffer);
    } else if (
      detectedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileExtension === "docx" ||
      fileExtension === "doc"
    ) {
      rawText = await parseDOCX(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF or Word document." },
        { status: 400 }
      );
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from document" },
        { status: 400 }
      );
    }

    // Create project in processing state
    const project = await prisma.project.create({
      data: {
        name: name || fileName.replace(/\.[^/.]+$/, ""),
        fileName,
        rawText,
        userId: session.user.id,
        status: "PROCESSING",
      },
    });

    // Log project creation
    await logAudit({
      userId: session.user.id,
      action: AuditAction.PROJECT_CREATE,
      resource: AuditResource.PROJECT,
      resourceId: project.id,
      details: {
        fileName,
        fileSize: buffer.length,
        fileType: detectedMime || fileExtension,
      },
      request,
    });

    // Extract requirements using AI (async, don't block response)
    extractRequirements(rawText)
      .then(async (result) => {
        const requirementCount = result.requirements.length;

        if (requirementCount === 0) {
          // FAILED extraction - mark as FAILED, DON'T count against quota
          await prisma.project.update({
            where: { id: project.id },
            data: { status: "FAILED" },
          });
          return;
        }

        // SUCCESSFUL extraction - store requirements with type, domain context, and limits
        await prisma.requirement.createMany({
          data: result.requirements.map((req, index) => ({
            projectId: project.id,
            text: req.text,
            section: req.section,
            isMandatory: req.isMandatory,
            type: req.type,
            domainContext: req.domainContext || "FEATURE",
            requiresReview: req.domainContext === "LEGAL",
            wordLimit: req.wordLimit,
            characterLimit: req.characterLimit,
            status: "UNANSWERED",
            order: index,
          })),
        });

        // Update project status to READY and store deadline if extracted
        await prisma.project.update({
          where: { id: project.id },
          data: {
            status: "READY",
            deadline: result.deadline ? new Date(result.deadline) : null,
            deadlineText: result.deadlineText,
          },
        });

        // Increment quota on successful extraction
        await checkAndIncrementQuota(session.user.id, true);
      })
      .catch(async (error) => {
        console.error("Extraction failed:", error);
        // Mark as FAILED on error - DON'T count against quota
        await prisma.project.update({
          where: { id: project.id },
          data: { status: "FAILED" },
        });
      });

    return NextResponse.json({
      id: project.id,
      name: project.name,
      status: project.status,
    });
  } catch (error) {
    console.error("Project creation error:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: { requirements: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Projects fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
