/**
 * GET /api/extract/status?jobId=xxx
 *
 * Polling endpoint for async extraction status.
 * Returns the current status of an extraction job.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get jobId from query params
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    // Find the job with ownership check via project
    const job = await prisma.extractionJob.findFirst({
      where: {
        id: jobId,
        project: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
        status: true,
        error: true,
        createdAt: true,
        completedAt: true,
        project: {
          select: {
            id: true,
            status: true,
            _count: {
              select: { requirements: true },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Calculate elapsed time
    const elapsedMs = Date.now() - job.createdAt.getTime();

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      error: job.error,
      projectId: job.project.id,
      projectStatus: job.project.status,
      requirementCount: job.project._count.requirements,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() || null,
      elapsedMs,
    });
  } catch (error) {
    console.error("[Status] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
