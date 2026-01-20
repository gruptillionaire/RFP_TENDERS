import { GoogleGenAI } from "@google/genai";

// =============================================================================
// TYPE MAPPINGS (compact output -> full types)
// =============================================================================

const TYPE_MAP: Record<number, RequirementType> = {
  1: 'DECLARATIVE',
  2: 'DESCRIPTIVE',
  3: 'PROCEDURAL',
  4: 'QUANTITATIVE',
  5: 'REFERENCE_BASED',
  6: 'EVIDENCE_BASED',
  7: 'STAFFING',
  8: 'CONTEXTUAL',
};

const DOMAIN_MAP: Record<number, 'FEATURE' | 'PROCESS' | 'LEGAL'> = {
  1: 'FEATURE',
  2: 'PROCESS',
  3: 'LEGAL',
};

// =============================================================================
// TYPES
// =============================================================================

export type RequirementType =
  | 'CONTEXTUAL'
  | 'PROCEDURAL'
  | 'DECLARATIVE'
  | 'DESCRIPTIVE'
  | 'EVIDENCE_BASED'
  | 'QUANTITATIVE'
  | 'REFERENCE_BASED'
  | 'STAFFING';

export interface ExtractedRequirement {
  section: string | null;
  sectionGroup: string | null;
  text: string;
  type: RequirementType;
  isMandatory: boolean;
  domainContext: 'FEATURE' | 'PROCESS' | 'LEGAL';
  wordLimit: number | null;
  characterLimit: number | null;
  isAttestation: boolean;
}

export interface ExtractionResult {
  deadline: string | null;
  deadlineText: string | null;
  requirements: ExtractedRequirement[];
  warnings?: string[];
}

interface ExtractionOptions {
  model?: string;
}

// Compact format from LLM
interface CompactRequirement {
  s: string | null;  // section
  g: string | null;  // sectionGroup
  t: string;         // text
  y: number;         // type code
  m: number;         // mandatory (0/1)
  d: number;         // domain code
  a: number;         // attestation (0/1)
  w: number | null;  // wordLimit
  c: number | null;  // charLimit
}

interface CompactResult {
  dl: string | null;  // deadline
  dt: string | null;  // deadlineText
  r: CompactRequirement[];
}

// =============================================================================
// EXTRACTION PROMPT
// =============================================================================

const EXTRACTION_PROMPT = `You are an expert RFP (Request for Proposal) analyst. Extract ALL requirements from the complete document.

## OUTPUT FORMAT - CRITICAL: USE COMPACT KEYS EXACTLY AS SHOWN

Return JSON object with ONLY these keys:
{"dl":"ISO deadline or null","dt":"deadline text or null","r":[...requirements]}

CRITICAL: Each requirement MUST use these EXACT compact single-letter keys (NOT full names):
- "s": section reference (e.g., "3.1.2", "A.1", null if none)
- "g": section group (e.g., "3: Technical Requirements", null if none)
- "t": requirement text (full text, no section numbers)
- "y": type code (integer 1-8, see below)
- "m": mandatory (integer: 1=yes, 0=optional)
- "d": domain code (integer 1-3, see below)
- "a": attestation (integer: 1=yes/no, 0=narrative)
- "w": word limit (integer or null)
- "c": character limit (integer or null)

WRONG: {"section":"3.1", "text":"...", "type":"DECLARATIVE"}
RIGHT: {"s":"3.1", "t":"...", "y":1}

## TYPE CODES (y)

1 = DECLARATIVE - Yes/no capability questions
    Pattern: "Does your...", "Can the...", "Is there...", "Will you..."
    Short answers expected, simple confirmation

2 = DESCRIPTIVE - Open-ended narrative questions
    Pattern: "Describe...", "Explain...", "What is your approach..."
    Detailed written response required

3 = PROCEDURAL - Process/methodology/timeline questions
    Pattern: "How will you...", "What is your process for..."
    Keywords: methodology, approach, workflow, timeline, schedule, implementation

4 = QUANTITATIVE - Pricing, costs, numbers, financial
    Pattern: Price tables, cost breakdowns, quantities
    Keywords: price, cost, fee, rate, budget, £/$, numeric values

5 = REFERENCE_BASED - Past performance, case studies, references
    Pattern: "Provide references...", "Describe similar projects..."
    Keywords: reference, case study, past performance, previous client

6 = EVIDENCE_BASED - Certifications, compliance proof, documentation
    Pattern: "Provide evidence of...", "Demonstrate compliance..."
    Keywords: certification, ISO, SOC, audit, compliance evidence

7 = STAFFING - Personnel, team composition, qualifications
    Pattern: "Provide CVs...", "Describe team structure..."
    Keywords: staff, personnel, team, CV, resume, qualifications, FTE

8 = CONTEXTUAL - Section headers, titles (usually filtered)
    Short title-case text without question marks or imperatives

## DOMAIN CODES (d)

1 = FEATURE (default) - Technical capabilities, functionality
    System features, integrations, technical specifications

2 = PROCESS - Methodology, implementation, operations
    How things are done, timelines, project management
    Keywords: how will you, methodology, approach, process, procedure

3 = LEGAL - Compliance, regulatory, contracts, insurance
    Keywords: comply, regulation, GDPR, liability, insurance, indemnify,
    terms and conditions, intellectual property, NDA, warranty

## ATTESTATION DETECTION (a)

Set a=1 (attestation/yes-no) when:
- Starts with: Does, Do, Can, Is, Are, Has, Have, Will, Would
- Expects simple yes/no or confirmation
- Short capability check (<200 chars typically)
- Pattern: "Does your system support X?"

Set a=0 (narrative) when:
- Starts with: Describe, Explain, How, What, Provide, Detail
- Requires written explanation
- Contains: "describe", "explain", "detail", "outline"
- Pattern: "Describe your approach to X"

## MANDATORY DETECTION (m)

Default m=1 (mandatory) UNLESS text contains:
- "optional", "if desired", "if applicable", "not required"
- "nice to have", "desirable but not", "may choose"
- "bonus", "preferred but not required"

Note: "optional" describing CONTENT (e.g., "optional features") ≠ optional requirement

## WHAT TO EXTRACT

1. QUESTIONS - Any sentence ending with "?"
   - Capability: "Does your solution support...?"
   - Process: "How will you handle...?"
   - Approach: "What is your approach to...?"

2. CAPABILITY REQUESTS - Sentences starting with imperatives:
   - "Describe...", "Explain...", "Provide...", "List..."
   - "Demonstrate...", "Detail...", "Outline..."
   - "Include...", "Submit...", "Specify..."

3. OBLIGATION STATEMENTS - Sentences containing:
   - "shall", "must", "will", "should"
   - "is required to", "are expected to"
   - "The vendor/contractor/proposer shall..."

4. YES/NO ATTESTATIONS - Questions expecting yes/no:
   - "Does the...", "Can the...", "Is the..."
   - "Has the...", "Will the...", "Would the..."

## WHAT TO SKIP (Do NOT extract)

- Table of contents, page numbers, headers, footers
- Section titles without questions/imperatives (y=8 if extracted)
- Instructions about proposal FORMAT (font, margins, page limits)
- Evaluation criteria descriptions (how scoring works)
- Award process descriptions (selection methodology)
- Terms and conditions boilerplate
- Contact information, submission addresses
- Transmittal letter instructions
- RFP timeline/process information

CRITICAL - These are NOT requirements (do NOT extract):
- "Preferred Qualifications" or "Desired Capabilities" sections - these describe what the buyer WANTS in a vendor, not questions to answer
- Scope/background descriptions like "The organization requires..." or "This project will..." - these are context, not questions
- Statements describing what the buyer needs (background info) vs questions asking vendors to respond
- Only extract items that require a RESPONSE from the vendor (questions, requests for information, attestations)

## EXTRACTION RULES

1. KEEP MULTI-PART QUESTIONS TOGETHER
   - "Does X? How is this achieved? Why?" = ONE requirement (keep together under same section)
   - Do NOT split questions that share the same section number
   - The full text of a numbered item (e.g., 3.1.8) should be one requirement

2. SECTION DETECTION
   - Look for section ID on same line or 1-2 lines before
   - Formats: "3.1.2", "A.1", "III.B", "(a)", "Q5"
   - Copy exactly as written, null if not found

3. SECTION GROUP DETECTION (g field)
   - Find the parent section header for each requirement
   - Example: If requirement is "3.5.2", look for header like "3.5 Integrations" or "3.0 Technical Questions"
   - Format as "3.5: Integrations" or "3: Technical Questions"
   - This provides context for what category the requirement belongs to

4. WORD/CHARACTER LIMITS
   - Extract from: "maximum 500 words", "(2500 word limit)"
   - Set w for word limits, c for character limits

5. NO DUPLICATES
   - You have the complete document - extract each requirement once
   - Same text with different section numbers = extraction error, keep first

## EXAMPLE OUTPUT

{"dl":"2024-03-15","dt":"Responses due by 5pm GMT on March 15, 2024","r":[
  {"s":"3.1.1","g":"3.1: Design and Templates","t":"Does your system support single sign-on (SSO)?","y":1,"m":1,"d":1,"a":1,"w":null,"c":null},
  {"s":"3.1.2","g":"3.1: Design and Templates","t":"Describe your approach to data encryption at rest and in transit.","y":2,"m":1,"d":1,"a":0,"w":500,"c":null},
  {"s":"3.5.4","g":"3.5: Integrations","t":"Does the system integrate with Salesforce? How is this configured? What data can be synchronized?","y":1,"m":1,"d":1,"a":0,"w":null,"c":null},
  {"s":"4.1.1","g":"4.1: Technical Architecture","t":"Provide a detailed project timeline including key milestones.","y":3,"m":1,"d":2,"a":0,"w":null,"c":null},
  {"s":"5.2.1","g":"5.2: Pricing","t":"Provide pricing for Year 1, Year 2, and Year 3 of the contract.","y":4,"m":1,"d":1,"a":0,"w":null,"c":null}
]}`;

// =============================================================================
// MAIN EXTRACTION FUNCTION
// =============================================================================

export async function extractRequirements(
  documentText: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const model = options.model || "gemini-2.5-flash";
  const startTime = Date.now();

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  console.log(`[extract] Starting extraction with ${model}`);
  console.log(`[extract] Document: ${documentText.length} chars`);

  if (!documentText || documentText.trim().length < 100) {
    return {
      deadline: null,
      deadlineText: null,
      requirements: [],
      warnings: ['Document too short for meaningful extraction'],
    };
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: `${EXTRACTION_PROMPT}\n\n## DOCUMENT\n\n${documentText}` }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 65536,
        thinkingConfig: {
          thinkingBudget: 0, // Disable thinking to use full token budget for output
        },
      },
    });

    // Log response metadata for debugging
    console.log(`[extract] Response candidates:`, response.candidates?.length || 0);
    if (response.candidates?.[0]) {
      const candidate = response.candidates[0];
      console.log(`[extract] Finish reason: ${candidate.finishReason}`);
      console.log(`[extract] Token count:`, response.usageMetadata);

      // Check for truncation
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.error(`[extract] WARNING: Response was truncated due to max tokens`);
      }
    }

    const content = response.text;
    if (!content) {
      throw new Error('Empty response from Gemini');
    }

    console.log(`[extract] Response length: ${content.length} chars`);

    // Check if JSON is complete
    if (!content.trim().endsWith('}') && !content.trim().endsWith(']')) {
      console.error(`[extract] WARNING: JSON appears truncated. Ends with: ${content.slice(-50)}`);
      throw new Error(`Response JSON truncated (${content.length} chars). Model may have hit output limit.`);
    }

    // Parse compact JSON response
    const compact: CompactResult = JSON.parse(content);
    const elapsed = Date.now() - startTime;

    // Decode compact format to full format
    const requirements = compact.r
      .map(decodeRequirement)
      .filter(r => r.type !== 'CONTEXTUAL') // Filter section headers
      .filter(r => r.text && r.text.trim().length > 10) // Filter empty/short items
      .sort(sortBySection);

    // Deduplicate by text (shouldn't be needed but safety net)
    const seen = new Set<string>();
    const dedupedRequirements = requirements.filter(r => {
      const normalized = r.text.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(normalized)) {
        console.log(`[extract] Removing duplicate: ${r.section}`);
        return false;
      }
      seen.add(normalized);
      return true;
    });

    console.log(`[extract] Complete: ${dedupedRequirements.length} requirements in ${elapsed}ms`);

    return {
      deadline: compact.dl,
      deadlineText: compact.dt,
      requirements: dedupedRequirements,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[extract] Error after ${elapsed}ms:`, error);
    throw error;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Decode compact requirement format to full ExtractedRequirement
 */
function decodeRequirement(r: CompactRequirement): ExtractedRequirement {
  return {
    section: r.s,
    sectionGroup: r.g,
    text: r.t,
    type: TYPE_MAP[r.y] || 'DESCRIPTIVE',
    isMandatory: r.m === 1,
    domainContext: DOMAIN_MAP[r.d] || 'FEATURE',
    isAttestation: r.a === 1,
    wordLimit: r.w,
    characterLimit: r.c,
  };
}

/**
 * Sort requirements by section number
 * Handles numeric (3.1.2), alpha (A.1), and roman numeral (III.B) formats
 */
function sortBySection(a: ExtractedRequirement, b: ExtractedRequirement): number {
  if (!a.section && !b.section) return 0;
  if (!a.section) return 1;
  if (!b.section) return -1;

  const parse = (s: string): number => {
    const n = parseInt(s, 10);
    if (!isNaN(n)) return n;
    // Single letter sections (A, B, C)
    if (/^[A-Z]$/i.test(s)) return 1000 + s.toUpperCase().charCodeAt(0) - 65;
    // Roman numerals
    const romanMap: Record<string, number> = {
      'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
      'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
    };
    if (romanMap[s.toUpperCase()]) return 2000 + romanMap[s.toUpperCase()];
    return 0;
  };

  const aParts = a.section.split(/[.\-]/).map(parse);
  const bParts = b.section.split(/[.\-]/).map(parse);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const diff = (aParts[i] || 0) - (bParts[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
