/**
 * GET /api/test/extract/status?jobId=xxx
 *
 * Polling endpoint for test extraction status.
 * Returns the current status and result when complete.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getTestJob } from "@/lib/test-job-store";

export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const authHeader = request.headers.get("Authorization");
    const testApiKey = process.env.TEST_API_KEY;

    if (!testApiKey) {
      return NextResponse.json(
        { error: "Test endpoint not configured" },
        { status: 503 }
      );
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const providedKey = authHeader.replace("Bearer ", "");
    const keyBuffer = Buffer.from(providedKey);
    const expectedBuffer = Buffer.from(testApiKey);
    if (keyBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(keyBuffer, expectedBuffer)) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Get jobId from query params
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const job = getTestJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const elapsedMs = Date.now() - job.createdAt.getTime();

    if (job.status === "complete") {
      return NextResponse.json({
        jobId: job.id,
        status: job.status,
        result: job.result,
        elapsedMs,
      });
    } else if (job.status === "failed") {
      return NextResponse.json({
        jobId: job.id,
        status: job.status,
        error: job.error,
        elapsedMs,
      });
    } else {
      return NextResponse.json({
        jobId: job.id,
        status: job.status,
        elapsedMs,
      });
    }
  } catch (error) {
    console.error("[Test Status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
