/**
 * POST /api/test/extract
 *
 * Test endpoint for extraction - uses API key auth instead of session.
 * This allows testing extraction without logging in.
 *
 * Auth: Bearer token in Authorization header must match TEST_API_KEY env var
 *
 * Request: multipart/form-data with 'file' field containing PDF
 * Response: JSON with extraction results and stats
 *
 * Debug modes:
 * - ?debug=heuristic: Raw heuristic extraction (no classification)
 * - ?debug=classified: Heuristic extraction + classification (no LLM)
 * - ?debug=refined: Heuristic + LLM refinement for low-confidence items
 */

import { NextRequest, NextResponse } from "next/server";
import { parsePDF } from "@/lib/parsers/pdf";
import { extractRequirements, refineLowConfidenceRequirements, ExtractedRequirement } from "@/lib/openai";
import { extractCandidatesHeuristically, extractAndClassifyHeuristically } from "@/lib/parsers/heuristic-extractor";
import { sanitizeForLLM } from "@/lib/security";
import { detectDomainContext } from "@/lib/domain-context";
import { classifyAttestation } from "@/lib/attestation";

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check API key auth
    const authHeader = request.headers.get("Authorization");
    const testApiKey = process.env.TEST_API_KEY;

    if (!testApiKey) {
      return NextResponse.json(
        { error: "TEST_API_KEY not configured on server" },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing Authorization header. Use: Bearer <TEST_API_KEY>" },
        { status: 401 }
      );
    }

    const providedKey = authHeader.replace("Bearer ", "");
    if (providedKey !== testApiKey) {
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

    // Debug mode: return just heuristic extraction results
    if (debugMode === "heuristic") {
      console.log(`[test/extract] Debug mode: heuristic only`);
      const sanitizedText = sanitizeForLLM(text);
      const heuristicStart = Date.now();
      const heuristicResult = extractCandidatesHeuristically(sanitizedText);
      const heuristicTime = Date.now() - heuristicStart;

      // Debug: Check for X.Y.Z patterns directly in the text
      const xyzPattern = /\d+\.\d+\.\d+/g;
      const xyzMatches = sanitizedText.match(xyzPattern) || [];

      // Find first occurrence of "3.1.1" or similar
      const firstXyzIndex = sanitizedText.search(/\d+\.\d+\.\d+/);
      const xyzContext = firstXyzIndex >= 0
        ? sanitizedText.substring(Math.max(0, firstXyzIndex - 20), firstXyzIndex + 50)
        : "NOT FOUND";

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
        regexDebug: {
          xyzPatternsFound: xyzMatches.length,
          sampleXyzMatches: xyzMatches.slice(0, 10),
          firstXyzContext: xyzContext,
          textSample: sanitizedText.substring(0, 500),
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

    // Debug mode: return heuristic extraction WITH classification (no LLM)
    if (debugMode === "classified") {
      console.log(`[test/extract] Debug mode: heuristic + classification (no LLM)`);
      const sanitizedText = sanitizeForLLM(text);
      const classifyStart = Date.now();
      const classifiedResult = extractAndClassifyHeuristically(sanitizedText);
      const classifyTime = Date.now() - classifyStart;

      // Generate type counts
      const typeCounts: Record<string, number> = {};
      const confidenceByType: Record<string, number[]> = {};
      const domainCounts: Record<string, number> = { FEATURE: 0, PROCESS: 0, LEGAL: 0 };
      let mandatoryCount = 0;
      let attestationCount = 0;
      let totalTypeConfidence = 0;

      for (const req of classifiedResult.requirements) {
        typeCounts[req.type] = (typeCounts[req.type] || 0) + 1;
        if (!confidenceByType[req.type]) confidenceByType[req.type] = [];
        confidenceByType[req.type].push(req.typeConfidence);
        totalTypeConfidence += req.typeConfidence;
        if (req.isMandatory) mandatoryCount++;
        if (req.isAttestation) attestationCount++;
        // Count domain contexts
        domainCounts[req.domainContext] = (domainCounts[req.domainContext] || 0) + 1;
      }

      // Calculate average confidence per type
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
        writtenResponseCount: classifiedResult.requirements.length - attestationCount,
        avgConfidenceByType,
        lowConfidenceCount: classifiedResult.lowConfidenceIds.length,
        // Sample of requirements by type
        samplesByType: Object.keys(typeCounts).reduce((acc, type) => {
          acc[type] = classifiedResult.requirements
            .filter(r => r.type === type)
            .slice(0, 5)
            .map(r => ({
              section: r.sectionNumber,
              text: r.text.substring(0, 200),
              confidence: r.typeConfidence,
              pattern: r.typePattern,
              domain: r.domainContext,
              isAttestation: r.isAttestation,
            }));
          return acc;
        }, {} as Record<string, Array<{ section: string; text: string; confidence: number; pattern?: string; domain: string; isAttestation: boolean }>>),
        // Sample attestation-eligible requirements
        attestationSamples: classifiedResult.requirements
          .filter(r => r.isAttestation)
          .slice(0, 10)
          .map(r => ({
            section: r.sectionNumber,
            text: r.text.substring(0, 200),
            type: r.type,
            domain: r.domainContext,
          })),
        // Low confidence samples
        lowConfidenceSamples: classifiedResult.requirements
          .filter(r => r.typeConfidence < 70)
          .slice(0, 10)
          .map(r => ({
            section: r.sectionNumber,
            text: r.text.substring(0, 200),
            type: r.type,
            confidence: r.typeConfidence,
            pattern: r.typePattern,
            domain: r.domainContext,
            isAttestation: r.isAttestation,
          })),
      });
    }

    // Debug mode: heuristic extraction + LLM refinement for low-confidence items
    if (debugMode === "refined") {
      try {
        console.log(`[test/extract] Debug mode: heuristic + LLM refinement`);
        const sanitizedText = sanitizeForLLM(text);

        // Step 1: Heuristic classification
        const classifyStart = Date.now();
        const classifiedResult = extractAndClassifyHeuristically(sanitizedText);
        const classifyTime = Date.now() - classifyStart;

        // Step 2: Convert to ExtractedRequirement format
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

        // Step 3: Identify low-confidence items for refinement
        const lowConfidenceReqs = requirements.filter(
          r => (r.typeConfidence && r.typeConfidence < 70) ||
               (r.mandatoryConfidence && r.mandatoryConfidence < 70)
        );

        console.log(`[test/extract] Found ${lowConfidenceReqs.length} low-confidence items for refinement`);

        // Step 4: Refine low-confidence items with LLM
        const refineStart = Date.now();
        const refinedReqs = await refineLowConfidenceRequirements(lowConfidenceReqs);
        const refineTime = Date.now() - refineStart;

      // Step 5: Merge refined items back into full list
      const refinedMap = new Map(refinedReqs.map(r => [r.section, r]));
      const finalRequirements = requirements.map(req =>
        refinedMap.has(req.section) ? refinedMap.get(req.section)! : req
      );

      // Calculate stats after refinement
      const typeCounts: Record<string, number> = {};
      let mandatoryCount = 0;
      let attestationCount = 0;
      let highConfidenceCount = 0;

      for (const req of finalRequirements) {
        typeCounts[req.type] = (typeCounts[req.type] || 0) + 1;
        if (req.isMandatory) mandatoryCount++;
        if (req.isAttestation) attestationCount++;
        if ((req.typeConfidence || 0) >= 70) highConfidenceCount++;
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
          totalTimeMs: classifyTime + refineTime,
        },
        before: {
          total: classifiedResult.requirements.length,
          lowConfidenceCount: classifiedResult.lowConfidenceIds.length,
          avgTypeConfidence: classifiedResult.stats.avgTypeConfidence,
        },
        after: {
          total: finalRequirements.length,
          highConfidenceCount,
          lowConfidenceCount: finalRequirements.length - highConfidenceCount,
          refinedCount: refinedReqs.length,
        },
        typeCounts,
        attestationCount,
        // Sample of refined requirements
        refinedSamples: refinedReqs.slice(0, 10).map(r => ({
          section: r.section,
          text: r.text.substring(0, 200),
          type: r.type,
          typeConfidence: r.typeConfidence,
          isMandatory: r.isMandatory,
        })),
        _note: `Heuristic extraction + LLM refinement for ${refinedReqs.length} low-confidence items.`,
      });
      } catch (refineError) {
        console.error(`[test/extract] Refinement error:`, refineError);
        return NextResponse.json({
          success: false,
          mode: "heuristic_refined",
          error: refineError instanceof Error ? refineError.message : "Refinement failed",
        }, { status: 500 });
      }
    }

    // Extract requirements
    const extractStart = Date.now();
    const result = await extractRequirements(text);
    const extractTime = Date.now() - extractStart;

    console.log(`[test/extract] Extracted ${result.requirements.length} requirements in ${extractTime}ms`);

    // Generate stats
    const typeCounts: Record<string, number> = {};
    const sectionGroups: Record<string, number> = {};
    let mandatoryCount = 0;

    for (const req of result.requirements) {
      typeCounts[req.type] = (typeCounts[req.type] || 0) + 1;
      const group = req.sectionGroup || "No Section Group";
      sectionGroups[group] = (sectionGroups[group] || 0) + 1;
      if (req.isMandatory) mandatoryCount++;
    }

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      meta: {
        fileName: file.name,
        fileSize: file.size,
        textLength: text.length,
        parseTimeMs: parseTime,
        extractTimeMs: extractTime,
        totalTimeMs: totalTime,
      },
      stats: {
        totalRequirements: result.requirements.length,
        mandatory: mandatoryCount,
        optional: result.requirements.length - mandatoryCount,
        deadline: result.deadline,
        deadlineText: result.deadlineText,
      },
      typeCounts,
      sectionGroups,
      // Include all requirements
      requirements: result.requirements,
    });
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
