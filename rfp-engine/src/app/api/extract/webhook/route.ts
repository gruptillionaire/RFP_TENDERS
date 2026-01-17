/**
 * POST /api/extract/webhook
 *
 * Webhook endpoint called by the Fly.io extraction worker when async extraction completes.
 * This endpoint:
 * 1. Validates the worker key
 * 2. Updates the ExtractionJob status
 * 3. On success: Creates requirements from the result
 * 4. On failure: Records the error message
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkAndIncrementQuota,
  checkAndConsumeSingleUseExtraction,
} from "@/lib/quota";

export async function POST(request: NextRequest) {
  console.log("[Webhook] === Extraction webhook received ===");

  try {
    // Validate worker key
    const workerKey = request.headers.get("x-worker-key");
    if (workerKey !== process.env.EXTRACTION_WORKER_KEY) {
      console.error("[Webhook] Invalid worker key");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, status, result, error, elapsed } = body;

    console.log(`[Webhook] Job ${jobId}: status=${status}, elapsed=${elapsed}ms`);

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    // Find the job
    const job = await prisma.extractionJob.findUnique({
      where: { id: jobId },
      include: {
        project: {
          select: {
            id: true,
            userId: true,
            isSingleUseProject: true,
          },
        },
      },
    });

    if (!job) {
      console.error(`[Webhook] Job ${jobId}: not found`);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "PROCESSING") {
      console.warn(`[Webhook] Job ${jobId}: already completed (status=${job.status})`);
      return NextResponse.json({
        success: true,
        message: "Job already completed",
        status: job.status,
      });
    }

    if (status === "complete" && result) {
      console.log(`[Webhook] Job ${jobId}: Processing ${result.requirements?.length || 0} requirements`);

      const requirementCount = result.requirements?.length || 0;

      if (requirementCount === 0) {
        // No requirements found - mark as failed
        await prisma.$transaction([
          prisma.extractionJob.update({
            where: { id: jobId },
            data: {
              status: "FAILED",
              error: "No requirements found in document",
              completedAt: new Date(),
            },
          }),
          prisma.project.update({
            where: { id: job.projectId },
            data: { status: "FAILED" },
          }),
        ]);

        return NextResponse.json({
          success: false,
          message: "No requirements found",
        });
      }

      // Create requirements from result
      await prisma.$transaction([
        prisma.requirement.createMany({
          data: result.requirements.map((req: {
            text: string;
            section?: string | null;
            sectionGroup?: string | null;
            isMandatory?: boolean;
            type?: string;
            domainContext?: string | null;
            wordLimit?: number | null;
            characterLimit?: number | null;
            isAttestation?: boolean;
          }, index: number) => ({
            projectId: job.projectId,
            text: req.text,
            section: req.section || null,
            sectionGroup: req.sectionGroup || null,
            isMandatory: req.isMandatory ?? true,
            type: req.type || "DESCRIPTIVE",
            domainContext: req.domainContext || "FEATURE",
            requiresReview: req.domainContext === "LEGAL",
            wordLimit: req.wordLimit || null,
            characterLimit: req.characterLimit || null,
            isAttestation: req.isAttestation || false,
            status: "UNANSWERED",
            order: index,
          })),
        }),
        prisma.extractionJob.update({
          where: { id: jobId },
          data: {
            status: "COMPLETE",
            result: result,
            completedAt: new Date(),
          },
        }),
        prisma.project.update({
          where: { id: job.projectId },
          data: {
            status: "READY",
            deadline: result.deadline ? new Date(result.deadline) : null,
            deadlineText: result.deadlineText || null,
          },
        }),
      ]);

      // Consume quota on successful extraction
      try {
        if (job.project.isSingleUseProject) {
          await checkAndConsumeSingleUseExtraction(job.project.userId);
        } else {
          await checkAndIncrementQuota(job.project.userId, true);
        }
      } catch (quotaError) {
        console.error(`[Webhook] Job ${jobId}: Quota update failed:`, quotaError);
        // Don't fail the webhook - extraction succeeded
      }

      console.log(`[Webhook] Job ${jobId}: Successfully saved ${requirementCount} requirements`);

      return NextResponse.json({
        success: true,
        requirementCount,
      });
    } else if (status === "failed") {
      // Extraction failed
      console.error(`[Webhook] Job ${jobId}: Extraction failed - ${error}`);

      await prisma.$transaction([
        prisma.extractionJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            error: error || "Unknown error",
            completedAt: new Date(),
          },
        }),
        prisma.project.update({
          where: { id: job.projectId },
          data: { status: "FAILED" },
        }),
      ]);

      return NextResponse.json({
        success: false,
        error,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid status. Expected 'complete' or 'failed'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[Webhook] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
