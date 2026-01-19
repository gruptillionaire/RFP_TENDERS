/**
 * POST /api/test/extract
 *
 * Test endpoint for extraction - uses API key auth instead of session.
 * This allows testing extraction without logging in.
 *
 * Auth: Bearer token in Authorization header must match TEST_API_KEY env var
 *
 * Request: multipart/form-data with 'file' field containing PDF
 * Response: JSON with jobId for polling (async) or immediate results (debug modes)
 *
 * Debug modes (fast, run locally):
 * - ?debug=heuristic: Raw heuristic extraction (no LLM)
 * - ?debug=classified: Heuristic extraction + classification (no LLM)
 * - ?debug=refined: Heuristic + LLM refinement for low-confidence items
 *
 * Normal mode (async via Fly.io):
 * - Returns { jobId } immediately
 * - Poll /api/test/extract/status?jobId=xxx for results
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { parsePDF } from "@/lib/parsers/pdf";
import { refineLowConfidenceRequirements, ExtractedRequirement } from "@/lib/openai";
import { extractCandidatesHeuristically, extractAndClassifyHeuristically } from "@/lib/parsers/heuristic-extractor";
import { sanitizeForLLM } from "@/lib/security";
import { EXTRACTION_CONFIG } from "@/lib/constants";
import { createTestJob } from "@/lib/test-job-store";

// Keep short - we return quickly for async mode
export const maxDuration = 60;

// SECURITY: Maximum file size for test uploads (10MB)
const MAX_TEST_FILE_SIZE = 10 * 1024 * 1024;

function generateJobId(): string {
  return `test_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // SECURITY: Check API key auth
    const authHeader = request.headers.get("Authorization");
    const testApiKey = process.env.TEST_API_KEY;

    if (!testApiKey) {
      console.error("SECURITY: TEST_API_KEY not configured - test endpoint disabled");
      return NextResponse.json(
        { error: "Test endpoint not configured" },
        { status: 503 }
      );
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing Authorization header. Use: Bearer <TEST_API_KEY>" },
        { status: 401 }
      );
    }

    const providedKey = authHeader.replace("Bearer ", "");
    const keyBuffer = Buffer.from(providedKey);
    const expectedBuffer = Buffer.from(testApiKey);
    if (keyBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(keyBuffer, expectedBuffer)) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // Get the file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Send as multipart/form-data with 'file' field." },
        { status: 400 }
      );
    }

    if (file.size > MAX_TEST_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_TEST_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    console.log(`[test/extract] Processing file: ${file.name} (${file.size} bytes)`);

    // Parse PDF
    const parseStart = Date.now();
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parsePDF(buffer);
    const parseTime = Date.now() - parseStart;

    console.log(`[test/extract] Parsed PDF in ${parseTime}ms, text length: ${text.length}`);

    // Check for debug mode
    const debugMode = request.nextUrl.searchParams.get("debug");

    // =========================================================================
    // DEBUG MODE: HEURISTIC (fast, local)
    // =========================================================================
    if (debugMode === "heuristic") {
      console.log(`[test/extract] Debug mode: heuristic only`);
      const sanitizedText = sanitizeForLLM(text);
      const heuristicStart = Date.now();
      const heuristicResult = extractCandidatesHeuristically(sanitizedText);
      const heuristicTime = Date.now() - heuristicStart;

      return NextResponse.json({
        success: true,
        mode: "heuristic_debug",
        meta: {
          fileName: file.name,
          fileSize: file.size,
          textLength: text.length,
          sanitizedTextLength: sanitizedText.length,
          parseTimeMs: parseTime,
          heuristicTimeMs: heuristicTime,
        },
        stats: {
          totalCandidates: heuristicResult.candidates.length,
          numberedCandidates: heuristicResult.stats.numberedCandidates,
          questionCandidates: heuristicResult.stats.questionCandidates,
          majorSectionsDetected: heuristicResult.stats.majorSectionsDetected,
        },
        majorSections: Array.from(heuristicResult.majorSections.entries()).map(([k, v]) => ({
          key: k,
          number: v.number,
          title: v.title,
        })),
        sampleCandidates: heuristicResult.candidates.slice(0, 20).map(c => ({
          sectionNumber: c.sectionNumber,
          majorSection: c.majorSection,
          rawTextPreview: c.rawText.substring(0, 150),
        })),
      });
    }

    // =========================================================================
    // DEBUG MODE: CLASSIFIED (fast, local)
    // =========================================================================
    if (debugMode === "classified") {
      console.log(`[test/extract] Debug mode: heuristic + classification (no LLM)`);
      const sanitizedText = sanitizeForLLM(text);
      const classifyStart = Date.now();
      const classifiedResult = extractAndClassifyHeuristically(sanitizedText);
      const classifyTime = Date.now() - classifyStart;

      const typeCounts: Record<string, number> = {};
      const confidenceByType: Record<string, number[]> = {};
      const domainCounts: Record<string, number> = { FEATURE: 0, PROCESS: 0, LEGAL: 0 };
      let attestationCount = 0;

      for (const req of classifiedResult.requirements) {
        typeCounts[req.type] = (typeCounts[req.type] || 0) + 1;
        if (!confidenceByType[req.type]) confidenceByType[req.type] = [];
        confidenceByType[req.type].push(req.typeConfidence);
        if (req.isAttestation) attestationCount++;
        domainCounts[req.domainContext] = (domainCounts[req.domainContext] || 0) + 1;
      }

      const avgConfidenceByType: Record<string, number> = {};
      for (const [type, confidences] of Object.entries(confidenceByType)) {
        avgConfidenceByType[type] = Math.round(
          confidences.reduce((a, b) => a + b, 0) / confidences.length
        );
      }

      return NextResponse.json({
        success: true,
        mode: "heuristic_classified",
        meta: {
          fileName: file.name,
          fileSize: file.size,
          textLength: text.length,
          classifyTimeMs: classifyTime,
        },
        stats: classifiedResult.stats,
        typeCounts,
        domainCounts,
        attestationCount,
        avgConfidenceByType,
        lowConfidenceCount: classifiedResult.lowConfidenceIds.length,
        samplesByType: Object.keys(typeCounts).reduce((acc, type) => {
          acc[type] = classifiedResult.requirements
            .filter(r => r.type === type)
            .slice(0, 5)
            .map(r => ({
              section: r.sectionNumber,
              text: r.text.substring(0, 200),
              confidence: r.typeConfidence,
              domain: r.domainContext,
              isAttestation: r.isAttestation,
            }));
          return acc;
        }, {} as Record<string, unknown[]>),
      });
    }

    // =========================================================================
    // DEBUG MODE: REFINED (uses LLM for low-confidence only)
    // =========================================================================
    if (debugMode === "refined") {
      console.log(`[test/extract] Debug mode: heuristic + LLM refinement`);
      const sanitizedText = sanitizeForLLM(text);

      const classifyStart = Date.now();
      const classifiedResult = extractAndClassifyHeuristically(sanitizedText);
      const classifyTime = Date.now() - classifyStart;

      const requirements: ExtractedRequirement[] = classifiedResult.requirements.map(req => ({
        section: req.sectionNumber,
        sectionGroup: req.sectionGroup,
        text: req.text,
        type: req.type,
        isMandatory: req.isMandatory,
        domainContext: req.domainContext,
        wordLimit: null,
        characterLimit: null,
        isAttestation: req.isAttestation,
        typeConfidence: req.typeConfidence,
        mandatoryConfidence: req.mandatoryConfidence,
      }));

      const lowConfidenceReqs = requirements.filter(
        r => (r.typeConfidence && r.typeConfidence < 70) ||
             (r.mandatoryConfidence && r.mandatoryConfidence < 70)
      );

      const refineStart = Date.now();
      const refinedReqs = await refineLowConfidenceRequirements(lowConfidenceReqs);
      const refineTime = Date.now() - refineStart;

      const refinedMap = new Map(refinedReqs.map(r => [r.section, r]));
      const finalRequirements = requirements.map(req =>
        refinedMap.has(req.section) ? refinedMap.get(req.section)! : req
      );

      const typeCounts: Record<string, number> = {};
      let attestationCount = 0;

      for (const req of finalRequirements) {
        typeCounts[req.type] = (typeCounts[req.type] || 0) + 1;
        if (req.isAttestation) attestationCount++;
      }

      return NextResponse.json({
        success: true,
        mode: "heuristic_refined",
        meta: {
          fileName: file.name,
          fileSize: file.size,
          textLength: text.length,
          classifyTimeMs: classifyTime,
          refineTimeMs: refineTime,
        },
        before: {
          total: classifiedResult.requirements.length,
          lowConfidenceCount: classifiedResult.lowConfidenceIds.length,
        },
        after: {
          total: finalRequirements.length,
          refinedCount: refinedReqs.length,
        },
        typeCounts,
        attestationCount,
        refinedSamples: refinedReqs.slice(0, 10).map(r => ({
          section: r.section,
          text: r.text.substring(0, 200),
          type: r.type,
        })),
      });
    }

    // =========================================================================
    // NORMAL MODE: ASYNC VIA FLY.IO
    // =========================================================================
    console.log(`[test/extract] Normal mode: async extraction via Fly.io`);

    // Generate job ID and create job in memory
    const jobId = generateJobId();
    createTestJob(jobId);

    // Build webhook URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    const webhookUrl = `${baseUrl}/api/test/extract/webhook`;

    // Call Fly.io worker async
    const workerUrl = `${EXTRACTION_CONFIG.WORKER_URL}/extract-async`;
    console.log(`[test/extract] Calling worker at ${workerUrl}, jobId=${jobId}`);

    const sanitizedText = sanitizeForLLM(text);

    try {
      const workerResponse = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Key": process.env.EXTRACTION_WORKER_KEY || "",
        },
        body: JSON.stringify({
          documentText: sanitizedText,
          jobId,
          webhookUrl,
          model: EXTRACTION_CONFIG.EXTRACTION_MODEL,
        }),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        throw new Error(`Worker returned ${workerResponse.status}: ${errorText}`);
      }

      const workerResult = await workerResponse.json();
      console.log(`[test/extract] Worker accepted job: ${workerResult.accepted}`);

      return NextResponse.json({
        success: true,
        mode: "async",
        jobId,
        message: "Extraction started. Poll /api/test/extract/status?jobId=... for results.",
        meta: {
          fileName: file.name,
          fileSize: file.size,
          textLength: sanitizedText.length,
          parseTimeMs: parseTime,
        },
      });
    } catch (workerError) {
      console.error("[test/extract] Worker call failed:", workerError);
      return NextResponse.json(
        {
          success: false,
          error: workerError instanceof Error ? workerError.message : "Worker call failed",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[test/extract] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Extraction failed",
      },
      { status: 500 }
    );
  }
}
