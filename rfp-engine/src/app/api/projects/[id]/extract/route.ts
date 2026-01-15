/**
 * POST /api/projects/[id]/extract
 *
 * Triggers requirement extraction for a project in PROCESSING status.
 * This endpoint is called by the frontend after project creation.
 *
 * Design:
 * - Project creation returns quickly with PROCESSING status
 * - Frontend redirects to project page
 * - Project page calls this endpoint to trigger extraction
 * - This request has a 5-minute timeout (configured in vercel.json)
 * - Frontend polls for status updates
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractRequirements } from "@/lib/openai";
import {
  checkAndIncrementQuota,
  checkAndConsumeSingleUseExtraction,
} from "@/lib/quota";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch project with ownership check
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        id: true,
        status: true,
        rawText: true,
        fileName: true,
        isSingleUseProject: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only extract if status is PROCESSING
    if (project.status !== "PROCESSING") {
      return NextResponse.json({
        status: project.status,
        message: project.status === "READY"
          ? "Extraction already complete"
          : "Project is not in a valid state for extraction",
      });
    }

    // Check if rawText exists
    if (!project.rawText) {
      await prisma.project.update({
        where: { id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: "No document text found for extraction" },
        { status: 400 }
      );
    }

    console.log(`[Extract] Starting extraction for project ${id}, text length: ${project.rawText.length}`);
    const startTime = Date.now();

    try {
      const result = await extractRequirements(project.rawText);
      const requirementCount = result.requirements.length;

      console.log(`[Extract] Completed in ${Date.now() - startTime}ms, found ${requirementCount} requirements`);

      if (requirementCount === 0) {
        console.error("[Extract] No requirements found:", {
          projectId: id,
          fileName: project.fileName,
          rawTextLength: project.rawText.length,
        });
        await prisma.project.update({
          where: { id },
          data: { status: "FAILED" },
        });
        return NextResponse.json(
          {
            error: "No requirements found in document",
            status: "FAILED",
          },
          { status: 400 }
        );
      }

      // Store requirements
      await prisma.requirement.createMany({
        data: result.requirements.map((req, index) => ({
          projectId: id,
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
        where: { id },
        data: {
          status: "READY",
          deadline: result.deadline ? new Date(result.deadline) : null,
          deadlineText: result.deadlineText,
        },
      });

      // Consume quota on successful extraction
      if (project.isSingleUseProject) {
        await checkAndConsumeSingleUseExtraction(session.user.id);
      } else {
        await checkAndIncrementQuota(session.user.id, true);
      }

      return NextResponse.json({
        status: "READY",
        requirementCount,
        extractionTime: Date.now() - startTime,
      });
    } catch (extractionError) {
      console.error("[Extract] Extraction failed:", extractionError);
      await prisma.project.update({
        where: { id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        {
          error: "Extraction failed. Please try again.",
          status: "FAILED",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Extract] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
