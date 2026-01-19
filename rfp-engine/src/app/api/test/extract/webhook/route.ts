/**
 * POST /api/test/extract/webhook
 *
 * Webhook endpoint for test extractions.
 * Called by Fly.io worker when async extraction completes.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { completeTestJob, failTestJob } from "@/lib/test-job-store";

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  console.log("[Test Webhook] Received extraction result");

  try {
    // Validate worker key
    const workerKey = request.headers.get("x-worker-key");
    const expectedKey = process.env.EXTRACTION_WORKER_KEY || "";

    if (!workerKey || !expectedKey || !timingSafeCompare(workerKey, expectedKey)) {
      console.error("[Test Webhook] Invalid worker key");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, status, result, error, elapsed } = body;

    console.log(`[Test Webhook] Job ${jobId}: status=${status}, elapsed=${elapsed}ms`);

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    if (status === "complete" && result) {
      completeTestJob(jobId, result);
      console.log(`[Test Webhook] Job ${jobId}: Stored ${result.requirements?.length || 0} requirements`);
      return NextResponse.json({ success: true });
    } else if (status === "failed") {
      failTestJob(jobId, error || "Unknown error");
      console.log(`[Test Webhook] Job ${jobId}: Failed - ${error}`);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Invalid status. Expected 'complete' or 'failed'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[Test Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
