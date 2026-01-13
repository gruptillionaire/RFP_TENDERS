import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePDF } from "@/lib/parsers/pdf";
import { parseDOCX } from "@/lib/parsers/docx";
import { extractRequirements } from "@/lib/openai";
import {
  checkAndIncrementQuota,
  getSingleUseQuotaStatus,
  checkAndConsumeSingleUseExtraction,
} from "@/lib/quota";
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

    // Check quota - single-use credits first, then subscription
    const singleUseStatus = await getSingleUseQuotaStatus(session.user.id);
    const subscriptionQuota = await checkAndIncrementQuota(session.user.id, false);

    const usingSingleUse = singleUseStatus.hasCredits && singleUseStatus.extractionsRemaining > 0;
    const hasSubscriptionQuota = subscriptionQuota.allowed;

    if (!usingSingleUse && !hasSubscriptionQuota) {
      return NextResponse.json(
        {
          error: "No extraction credits available. Please purchase a Single RFP or upgrade your plan.",
          remaining: 0,
          limit: subscriptionQuota.limit,
          singleUseRemaining: singleUseStatus.extractionsRemaining,
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

    // Check for duplicate/in-progress uploads
    if (!allowDuplicate) {
      // Check for existing successful projects (warn user about duplicate)
      const existingProject = await prisma.project.findFirst({
        where: {
          userId: session.user.id,
          fileName: fileName,
          status: { in: ["READY", "COMPLETED"] },
        },
        select: { id: true, name: true, status: true },
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

      // Check for PROCESSING projects - handle stuck vs active
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const processingProject = await prisma.project.findFirst({
        where: {
          userId: session.user.id,
          fileName: fileName,
          status: "PROCESSING",
        },
        select: { id: true, createdAt: true },
      });

      if (processingProject) {
        if (processingProject.createdAt > fiveMinutesAgo) {
          // Still processing - tell user to wait
          return NextResponse.json(
            {
              error: "processing",
              message: "This file is currently being processed. Please wait a few minutes and refresh the page.",
            },
            { status: 409 }
          );
        }
        // Stuck for >5 minutes - delete it
        await prisma.project.delete({ where: { id: processingProject.id } });
      }

      // Clean up FAILED projects
      await prisma.project.deleteMany({
        where: {
          userId: session.user.id,
          fileName: fileName,
          status: "FAILED",
        },
      });
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
    // Set expiration for single-use projects
    const project = await prisma.project.create({
      data: {
        name: name || fileName.replace(/\.[^/.]+$/, ""),
        fileName,
        rawText,
        userId: session.user.id,
        status: "PROCESSING",
        // Single-use project tracking
        isSingleUseProject: usingSingleUse,
        expiresAt: usingSingleUse ? singleUseStatus.expiresAt : null,
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

    // Use after() to ensure extraction completes even after response is sent
    // This prevents Vercel from killing the function before extraction finishes
    after(async () => {
      try {
        const result = await extractRequirements(rawText);
        const requirementCount = result.requirements.length;

        if (requirementCount === 0) {
          console.error("Extraction returned 0 requirements:", {
            projectId: project.id,
            fileName: project.fileName,
            rawTextLength: rawText.length,
          });
          await prisma.project.update({
            where: { id: project.id },
            data: { status: "FAILED" },
          });
          return;
        }

        // Store requirements
        await prisma.requirement.createMany({
          data: result.requirements.map((req, index) => ({
            projectId: project.id,
            text: req.text,
            section: req.section,
            sectionGroup: req.sectionGroup,
            isMandatory: req.isMandatory,
            type: req.type,
            domainContext: req.domainContext || "FEATURE",
            requiresReview: req.domainContext === "LEGAL",
            wordLimit: req.wordLimit,
            characterLimit: req.characterLimit,
            isAttestation: req.isAttestation || false,
            status: "UNANSWERED",
            order: index,
          })),
        });

        // Update project status to READY
        await prisma.project.update({
          where: { id: project.id },
          data: {
            status: "READY",
            deadline: result.deadline ? new Date(result.deadline) : null,
            deadlineText: result.deadlineText,
          },
        });

        // Consume quota on successful extraction
        if (usingSingleUse) {
          await checkAndConsumeSingleUseExtraction(session.user.id);
        } else {
          await checkAndIncrementQuota(session.user.id, true);
        }
      } catch (error) {
        console.error("Extraction failed:", error);
        await prisma.project.update({
          where: { id: project.id },
          data: { status: "FAILED" },
        });
      }
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
