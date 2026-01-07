import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePDF } from "@/lib/parsers/pdf";
import { parseDOCX } from "@/lib/parsers/docx";
import { extractRequirements } from "@/lib/openai";
import { checkAndIncrementQuota } from "@/lib/quota";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TEMPORARILY DISABLED FOR DEBUGGING - TODO: Re-enable quota check
    // const quotaCheck = await checkAndIncrementQuota(session.user.id, false);
    // if (!quotaCheck.allowed) {
    //   return NextResponse.json(
    //     {
    //       error: "Monthly extraction limit reached. Please upgrade your plan.",
    //       remaining: 0,
    //       limit: quotaCheck.limit,
    //     },
    //     { status: 403 }
    //   );
    // }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const allowDuplicate = formData.get("allowDuplicate") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
    const fileExtension = fileName.split(".").pop()?.toLowerCase();

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse document based on type
    let rawText: string;
    if (fileExtension === "pdf") {
      rawText = await parsePDF(buffer);
    } else if (fileExtension === "docx" || fileExtension === "doc") {
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

        // SUCCESSFUL extraction - store requirements with type and domain context
        await prisma.requirement.createMany({
          data: result.requirements.map((req, index) => ({
            projectId: project.id,
            text: req.text,
            section: req.section,
            isMandatory: req.isMandatory,
            type: req.type,
            domainContext: req.domainContext || "FEATURE",
            requiresReview: req.domainContext === "LEGAL",
            status: "UNANSWERED",
            order: index,
          })),
        });

        // Update project status to READY
        await prisma.project.update({
          where: { id: project.id },
          data: { status: "READY" },
        });

        // TEMPORARILY DISABLED FOR DEBUGGING - TODO: Re-enable quota increment
        // await checkAndIncrementQuota(session.user.id, true);
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
