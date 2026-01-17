/**
 * POST /api/projects/[id]/extract
 *
 * Triggers requirement extraction for a project in PROCESSING status.
 * This endpoint is called by the frontend after project creation.
 *
 * Design (Async Flow):
 * - Project creation returns quickly with PROCESSING status
 * - Frontend redirects to project page
 * - Project page calls this endpoint to trigger extraction
 * - This endpoint creates an ExtractionJob and calls the Fly.io worker async
 * - Returns immediately with jobId for polling
 * - Frontend polls /api/extract/status?jobId=xxx for updates
 * - Worker calls /api/extract/webhook when done
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXTRACTION_CONFIG } from "@/lib/constants";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("[Extract] === Async extraction request received ===");

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    console.log("[Extract] Project ID:", id);

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

    // Check if there's already an active extraction job
    const existingJob = await prisma.extractionJob.findFirst({
      where: {
        projectId: id,
        status: "PROCESSING",
      },
    });

    if (existingJob) {
      console.log(`[Extract] Existing job found: ${existingJob.id}`);
      return NextResponse.json({
        status: "processing",
        jobId: existingJob.id,
        message: "Extraction already in progress",
      });
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

    console.log(`[Extract] Starting async extraction for project ${id}, text length: ${project.rawText.length}`);

    // Create extraction job
    const job = await prisma.extractionJob.create({
      data: {
        projectId: id,
        status: "PROCESSING",
      },
    });

    console.log(`[Extract] Created job ${job.id}`);

    // Build webhook URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    const webhookUrl = `${baseUrl}/api/extract/webhook`;

    // Call worker async endpoint
    const workerUrl = `${EXTRACTION_CONFIG.WORKER_URL}/extract-async`;
    console.log(`[Extract] Calling worker at ${workerUrl}`);

    try {
      const workerResponse = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Key": process.env.EXTRACTION_WORKER_KEY || "",
        },
        body: JSON.stringify({
          documentText: project.rawText,
          jobId: job.id,
          webhookUrl,
          model: EXTRACTION_CONFIG.EXTRACTION_MODEL,
        }),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        throw new Error(`Worker returned ${workerResponse.status}: ${errorText}`);
      }

      const workerResult = await workerResponse.json();
      console.log(`[Extract] Worker accepted job: ${workerResult.accepted}`);

      // Return immediately with job ID for polling
      return NextResponse.json({
        status: "processing",
        jobId: job.id,
        message: "Extraction started. Poll /api/extract/status?jobId=... for updates.",
      });
    } catch (workerError) {
      console.error("[Extract] Worker call failed:", workerError);

      // Mark job as failed
      await prisma.extractionJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: workerError instanceof Error ? workerError.message : "Worker call failed",
          completedAt: new Date(),
        },
      });

      await prisma.project.update({
        where: { id },
        data: { status: "FAILED" },
      });

      return NextResponse.json(
        {
          error: "Failed to start extraction. Please try again.",
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
