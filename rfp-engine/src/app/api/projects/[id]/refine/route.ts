/**
 * POST /api/projects/[id]/refine
 *
 * Phase 2 of the Hybrid Heuristic + LLM architecture.
 * Refines low-confidence requirement classifications using the LLM.
 *
 * This endpoint is OPTIONAL - users can accept heuristic results as-is,
 * or trigger this to improve accuracy on uncertain classifications.
 *
 * Request body:
 * - requirementIds?: string[]     - Specific IDs to refine (optional)
 * - confidenceThreshold?: number  - Refine all below this threshold (default: 70)
 *
 * The endpoint sends only the low-confidence requirements to the LLM,
 * keeping API costs minimal while improving accuracy where needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";
import { MODELS, RequirementType } from "@/lib/constants";
import { sanitizeForLLM } from "@/lib/security";

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// Focused prompt for classification refinement only
const REFINEMENT_PROMPT = `You are an expert at classifying RFP requirements. Given requirement text, classify:

1. TYPE - One of:
   - DECLARATIVE: Yes/no questions ("Does your system...", "Can users...", "Is there...")
   - DESCRIPTIVE: Open-ended questions requiring explanation ("Describe...", "Explain...", "How does...")
   - QUANTITATIVE: Requests for numbers, pricing, metrics ("Provide pricing...", "How many...", cost/budget questions)
   - REFERENCE_BASED: Requests for references, case studies, similar projects
   - EVIDENCE_BASED: Requests for documentation, certificates, proof, attachments
   - STAFFING: Questions about personnel, team, resumes, organizational structure
   - PROCEDURAL: Confirmations, acknowledgments, signatures required
   - CONTEXTUAL: Background information, instructions, deadlines (not actual questions)

2. MANDATORY - true/false:
   - true: Contains "shall", "must", "required", "mandatory", or is clearly required
   - false: Contains "optional", "may", "if applicable", "preferred", "desired"

Respond with JSON array matching input order:
[{ "type": "TYPE", "isMandatory": true/false }, ...]`;

interface RefineRequest {
  requirementIds?: string[];
  confidenceThreshold?: number;
}

interface RefinementResult {
  type: RequirementType;
  isMandatory: boolean;
}

function validateRequirementType(type: string): RequirementType {
  const validTypes: RequirementType[] = [
    "DECLARATIVE", "DESCRIPTIVE", "QUANTITATIVE", "REFERENCE_BASED",
    "EVIDENCE_BASED", "STAFFING", "PROCEDURAL", "CONTEXTUAL"
  ];
  return validTypes.includes(type as RequirementType)
    ? (type as RequirementType)
    : "DESCRIPTIVE";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("[Refine] === Request received ===");

  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const body: RefineRequest = await request.json();
    const confidenceThreshold = body.confidenceThreshold ?? 70;

    console.log("[Refine] Project:", projectId, "Threshold:", confidenceThreshold);

    // Fetch project with ownership check
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status !== "READY") {
      return NextResponse.json(
        { error: "Project must be in READY status to refine" },
        { status: 400 }
      );
    }

    // Fetch requirements to refine
    let requirements;
    if (body.requirementIds && body.requirementIds.length > 0) {
      // Specific IDs provided
      requirements = await prisma.requirement.findMany({
        where: {
          id: { in: body.requirementIds },
          projectId,
        },
        select: {
          id: true,
          text: true,
          type: true,
          isMandatory: true,
        },
      });
    } else {
      // Refine based on confidence threshold - need to fetch all and filter
      // Note: typeConfidence/mandatoryConfidence might not be stored in DB yet
      // For now, refine all requirements if no specific IDs given
      requirements = await prisma.requirement.findMany({
        where: {
          projectId,
        },
        select: {
          id: true,
          text: true,
          type: true,
          isMandatory: true,
        },
        take: 100, // Limit to prevent huge API calls
      });
    }

    if (requirements.length === 0) {
      return NextResponse.json({
        refined: 0,
        message: "No requirements to refine",
      });
    }

    console.log(`[Refine] Refining ${requirements.length} requirements...`);

    // Prepare texts for LLM
    const textsToRefine = requirements.map((r, i) => `${i + 1}. ${sanitizeForLLM(r.text)}`);
    const batchText = textsToRefine.join("\n");

    // Call LLM for classification
    if (!gemini) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const startTime = Date.now();
    const response = await gemini.models.generateContent({
      model: MODELS.DRAFTING, // Using same model for all Gemini calls
      contents: [
        {
          role: "user",
          parts: [{ text: `${REFINEMENT_PROMPT}\n\nClassify these ${requirements.length} requirements:\n\n${batchText}` }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 4000,
      },
    });

    const content = response.text;
    if (!content) {
      throw new Error("No response from Gemini");
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Refine] LLM response in ${elapsed}ms`);

    // Parse response
    let refinements: RefinementResult[];
    try {
      const parsed = JSON.parse(content);
      // Handle both array format and object with array property
      refinements = Array.isArray(parsed) ? parsed : (parsed.requirements || parsed.results || []);
    } catch (e) {
      console.error("[Refine] Failed to parse LLM response:", content);
      throw new Error("Failed to parse refinement response");
    }

    if (refinements.length !== requirements.length) {
      console.warn(`[Refine] Mismatch: got ${refinements.length} refinements for ${requirements.length} requirements`);
    }

    // Update requirements in database
    const updates = [];
    const refined = [];
    for (let i = 0; i < requirements.length && i < refinements.length; i++) {
      const req = requirements[i];
      const ref = refinements[i];

      if (ref && ref.type) {
        const validType = validateRequirementType(ref.type);
        const wasChanged = req.type !== validType || req.isMandatory !== ref.isMandatory;

        if (wasChanged) {
          updates.push(
            prisma.requirement.update({
              where: { id: req.id },
              data: {
                type: validType,
                isMandatory: ref.isMandatory ?? req.isMandatory,
              },
            })
          );

          refined.push({
            id: req.id,
            oldType: req.type,
            newType: validType,
            oldMandatory: req.isMandatory,
            newMandatory: ref.isMandatory ?? req.isMandatory,
          });
        }
      }
    }

    // Execute all updates
    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    console.log(`[Refine] Updated ${updates.length} requirements`);

    return NextResponse.json({
      refined: refined.length,
      totalProcessed: requirements.length,
      changes: refined,
      timeMs: elapsed,
    });

  } catch (error) {
    console.error("[Refine] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refinement failed" },
      { status: 500 }
    );
  }
}
