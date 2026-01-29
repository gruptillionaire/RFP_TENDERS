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
//
// ⭐ BEST EXTRACTION METHOD - Gemini 2.5 Flash with thinking disabled
//
// This prompt has been iteratively refined to:
// - Eliminate false positives (evaluation criteria, scope descriptions)
// - Properly detect section groups (e.g., "3.1: Design and Templates")
// - Correctly classify requirement types (DECLARATIVE for factual, DESCRIPTIVE for explanations)
// - Handle "if applicable" at end = optional, vs "optional" in content = mandatory
// - Keep multi-part questions together under same section number
// - Use compact JSON keys to maximize output within token limits
//
// Model: gemini-2.5-flash with thinkingBudget: 0 (disables thinking, full tokens for output)
// Limits: ~4.2M chars input, ~262K chars output (~2000 requirements max)
// Cost: ~$0.04-0.05 per extraction
//
// =============================================================================

const EXTRACTION_PROMPT = `You are an expert RFP (Request for Proposal) analyst. Extract ALL requirements from the complete document.

## CRITICAL: SKIP SCOPE OF WORK DELIVERABLES

DO NOT extract bullet points from "Scope of Work" sections that describe WHAT to build/deliver:
- "Develop a website..." → SKIP (deliverable)
- "Create content..." → SKIP (deliverable)
- "Integrate features..." → SKIP (deliverable)
- "Implement security..." → SKIP (deliverable)
- "Design a system..." → SKIP (deliverable)

ONLY extract items that ask the vendor to WRITE something in their proposal:
- "Describe your approach..." → EXTRACT
- "Provide examples of..." → EXTRACT
- "Explain how you will..." → EXTRACT

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

1 = DECLARATIVE - Yes/no OR direct factual questions
    Pattern: "Does your...", "Can the...", "Is there...", "Will you..."
    Also: "What is...", "Where is...", "In what location...", "Which..." (factual answers)
    Short/direct answers expected, not detailed narratives

2 = DESCRIPTIVE - Open-ended narrative questions requiring explanation
    Pattern: "Describe...", "Explain...", "What is your approach...", "How do you..."
    Requires detailed written explanation, not just a fact
    Keywords: describe, explain, detail, outline, elaborate

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

8 = CONTEXTUAL - Context that does NOT require a vendor response
    Includes: section headers, contract obligation statements, specification terms,
    scope descriptions, background info, submission instructions, cross-references,
    document overviews, tender process instructions
    "The Contractor shall...", "The Provider must..." → y=8 if no written response requested
    "Tenderers must submit via..." → y=8 (submission instruction)
    "Please see Section 4 for..." → y=8 (cross-reference)
    Key test: Does this require the vendor to WRITE something in their proposal? If no → y=8

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

Default m=1 (mandatory). Only set m=0 when the REQUIREMENT ITSELF is optional to respond to.

Set m=0 ONLY when these phrases appear AT THE END or modify THE WHOLE REQUIREMENT:
- "...if applicable" or "...if applicable." at END → m=0
- "...if desired" at END → m=0
- "This requirement is optional" → m=0
- "Respondents may optionally..." → m=0

KEEP m=1 (mandatory) when these words describe CONTENT being asked about:
- "Is there an optional sign-up bonus?" → m=1 (asking about optional feature)
- "Describe any optional modules" → m=1 (asking about optional modules)
- "What optional features are available?" → m=1 (asking about optional features)

The key distinction:
- "Detail hardware requirements if applicable" → m=0 (whole requirement is conditional)
- "Does the system support optional plugins?" → m=1 (asking about optional plugins)

## WHAT TO EXTRACT - THE KEY TEST

For EVERY item, apply this gate:
  "Does this require the tenderer to WRITE CONTENT in their proposal response?"
  If YES → extract it. If NO → skip it or mark y=8.

Submission instructions, process rules, cross-references, document summaries, and contract
obligations all FAIL this test. They tell the tenderer what to DO (submit, comply, read) not
what to WRITE (describe, explain, provide details, answer a question).

1. QUESTIONS - Any sentence ending with "?" that asks for vendor input
   - Capability: "Does your solution support...?"
   - Process: "How will you handle...?"
   - Approach: "What is your approach to...?"

2. PROPOSAL RESPONSE REQUESTS - Sentences asking vendor to WRITE something in their proposal:
   - "Describe...", "Explain...", "Provide [details/evidence/examples]...", "List..."
   - "Demonstrate...", "Detail...", "Outline..."
   - "Please provide a written submission..."
   - NOT delivery verbs like "Develop", "Build", "Create", "Implement", "Integrate", "Design"
   - NOT submission verbs like "Submit [the form]", "Complete [and return]", "Return [by date]"
   - Those describe what to BUILD or how to SUBMIT, not what to WRITE in the proposal

3. OBLIGATION STATEMENTS THAT REQUEST A RESPONSE:
   Only extract "shall/must/will" statements that ask the vendor to WRITE, DESCRIBE, EXPLAIN, or PROVIDE something in their proposal:
   - "The vendor shall describe their approach to..." → EXTRACT
   - "Respondents must provide evidence of..." → EXTRACT

   DO NOT extract pure contract obligations stating what the vendor must DO under contract:
   - "The Contractor shall maintain insurance of £5M" → SKIP (contract term)
   - "The Provider shall comply with GDPR" → SKIP (obligation)
   - "Services must be delivered within 30 days" → SKIP (contract timeline)
   - "The successful bidder will provide 24/7 support" → SKIP (deliverable)
   - "All data shall be stored within the UK" → SKIP (specification constraint)
   - "The Concessionaire shall ensure staff are DBS checked" → SKIP (contract obligation)
   Test: Does this "shall/must" statement ask for a WRITTEN RESPONSE? If not → SKIP or y=8

   DO NOT extract tender submission instructions disguised as "must" statements:
   - "Tenderers must complete and return all relevant Sections" → SKIP (submission instruction)
   - "Tenderers must submit via The Chest" → SKIP (submission method)
   - "An electronic submission must be submitted" → SKIP (submission format)
   - "Tenders must be received by 5pm" → SKIP (deadline)
   Test: Does this "must" statement tell the tenderer HOW/WHEN/WHERE to submit? → SKIP

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
- Contract obligation statements that do NOT ask for a response:
  - "The Contractor shall...", "The Provider must..." (unless asking to WRITE/DESCRIBE/EXPLAIN)
  - Specification constraints ("All data shall be stored in...", "Services must comply with...")
  - Compliance obligations ("The vendor shall adhere to...", "Staff must hold valid DBS checks")
  - Performance obligations ("The contractor shall deliver within...", "SLA of 99.9% uptime")
- Contact information, submission addresses
- Transmittal letter instructions
- RFP timeline/process information

CRITICAL - SKIP TENDER SUBMISSION & PROCESS INSTRUCTIONS:
These tell tenderers HOW, WHEN, and WHERE to submit. They are NOT questions requiring a written response:
- Submission method: "Submit via [portal/email/post]", "An electronic submission must be submitted via..."
- Submission deadline: "Return by 5.00pm on [date]", "Tender related queries no later than..."
- Tender examination: "The Tenderer is required to examine the Tender Documents..."
- Completeness instructions: "Tenderers must complete and return all relevant Sections..."
- Discrepancy reporting: "Should the Tenderer find discrepancies... notify the Procurement Officer..."
- Reserved rights: "RBH reserves the right to require additional information..."
- Clarification process: "Tenderers shall communicate all queries via [portal]..."
- General compliance: "The Tenderer shall be deemed to have satisfied itself as to the correctness..."
These appear in sections like "Instructions to Tenderers", "Submission Requirements", "General Conditions".
Test: Does this instruct the tenderer about the SUBMISSION PROCESS rather than ask for CONTENT? → SKIP

CRITICAL - SKIP OR MARK y=8 FOR DOCUMENT OVERVIEWS, SUMMARIES, AND CROSS-REFERENCES:
- Table-of-contents items: "Tenderers Must Complete and submit a CDP form" → y=8 (summary bullet, not a question)
- Overview bullets describing what sections to complete (these are navigation aids, not questions) → y=8
- Cross-references: "Please include a response to the question at Section 4" → y=8 (points elsewhere)
- Section summaries: "This section covers...", "The following sections outline..." → y=8
- Items from "ITT Document Summary", "Tender Summary", "Document Overview" sections → ALWAYS y=8
- These items summarise what to do ("Complete the form", "Read the spec", "Sign the certificate")
  but do NOT ask for written content. They are checklists/navigation, not questions.
Test: Does this summarise or point to content elsewhere instead of asking a question? → SKIP or y=8

CRITICAL - These are NOT requirements (do NOT extract):
- "Preferred Qualifications" or "Desired Capabilities" sections - these describe what the buyer WANTS in a vendor, not questions to answer
- Scope/background descriptions like "The organization requires..." or "This project will..." - these are context, not questions
- Statements describing what the buyer needs (background info) vs questions asking vendors to respond
- Only extract items that require a RESPONSE from the vendor (questions, requests for information, attestations)
- Scope of Work DELIVERABLES - bullet points describing desired features/outcomes without asking a question:
  - "Develop a modern, responsive website design" → SKIP (deliverable description)
  - "Integrate online banking features" → SKIP (deliverable description)
  - "Reflect the organization's brand identity" → SKIP (deliverable description)
  - These describe WHAT the buyer wants built, not questions for the proposal to answer
  - ONLY extract from Scope of Work if it asks HOW, requests a description, or requires vendor input

CRITICAL - SKIP ADMINISTRATIVE FORMS (these are forms to FILL OUT, not proposal questions):
- CONFLICT OF INTEREST QUESTIONNAIRE fields (Yes/No checkboxes about business relationships)
- Exhibit/Attachment forms (EXHIBIT A, EXHIBIT B, ATTACHMENT A, etc.) that are:
  - Acknowledgment forms with signature blocks
  - Certification forms with checkbox attestations
  - Questionnaires with Yes/No checkboxes to be checked
  - Forms asking for name, date, signature fields
- Form field prompts like:
  - "Name of local government officer..."
  - "Name of vendor who has a business relationship..."
  - Checkbox questions: "yes [ ] no [ ]" or "☐ Yes ☐ No"
- Signature blocks and certification statements at end of forms

The distinction:
- "Does your system support SSO?" → EXTRACT (proposal question asking about capability)
- "Do you have a business relationship with local government officer? yes [ ] no [ ]" → SKIP (form checkbox)
- "Describe your approach to security" → EXTRACT (proposal question)
- "I certify that the above information is correct. Signature: ___" → SKIP (form attestation)

CRITICAL - SKIP COMPANY INFORMATION FORM FIELDS:
These are administrative form fields asking for basic vendor identification data, NOT proposal questions:
- "Full name of the potential supplier submitting the information" → SKIP
- "Registered office address (if applicable)" → SKIP
- "Company registration number (if applicable)" → SKIP
- "Head office DUNS number (if applicable)" → SKIP
- "Registered VAT number" → SKIP
- "Date of registration in country of origin" → SKIP
- "Trading name(s) that will be used" → SKIP
- "Details of immediate parent company" → SKIP
- "Details of ultimate parent company" → SKIP
- "Details of Persons of Significant Control (PSC)" → SKIP
- "Relevant classifications (VCSE, Sheltered Workshop, etc.)" → SKIP
- "Trading status (limited company, partnership, etc.)" → SKIP

These are typically in sections titled "Company Information", "Vendor Information", "Bidder Information".

HOWEVER, DO extract substantive questions even in these sections:
- "Is your organisation registered with the appropriate professional or trade register?" → EXTRACT
- "Is it a legal requirement for you to possess a particular authorisation?" → EXTRACT
- "Are you a Small, Medium or Micro Enterprise (SME)?" → EXTRACT

The distinction: Form fields request static company data to fill in. Questions require evaluation or a yes/no answer about compliance/status.

NOTE: This does NOT apply to pricing/commercial sections. ALWAYS extract:
- Pricing requirements ("Tender Price for...", "Costs shall be...", "Prices must include...")
- Commercial terms ("Payment within X days", "Prices valid for X months")
- VAT/tax statements ("Price does not include VAT")
These are legitimate requirements even if they appear in form-like sections.

## EXTRACTION RULES

1. KEEP MULTI-PART QUESTIONS TOGETHER
   - "Does X? How is this achieved? Why?" = ONE requirement (keep together under same section)
   - Do NOT split questions that share the same section number
   - The full text of a numbered item (e.g., 3.1.8) should be one requirement

2. SECTION DETECTION
   - Look for section ID on same line or 1-2 lines before
   - Formats: "3.1.2", "A.1", "III.B", "(a)", "Q5"
   - Copy exactly as written
   - If NO numbered sections exist, use a short descriptive reference from the parent heading (e.g., "Pricing", "Technical", "References")
   - Only use null if truly no section context exists

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

6. PRESERVE TEXT FORMATTING AND STRUCTURE
   When requirement text contains lists, bullet points, sub-items, or hierarchical content,
   preserve the structure using newlines (\\n) in the "t" field. Do NOT flatten structured
   content into a single run-on paragraph.

   WRONG (text vomit):
   "t": "Data Protection The Contractor shall: Comply with GDPR Process data only as instructed Appoint a DPO Maintain records of processing activities"

   RIGHT (structure preserved):
   "t": "Data Protection\\n\\nThe Contractor shall:\\n- Comply with GDPR\\n- Process data only as instructed\\n- Appoint a DPO\\n- Maintain records of processing activities"

   WRONG (sub-items lost):
   "t": "Describe your approach to: a) Security architecture b) Data encryption c) Access controls d) Incident response"

   RIGHT (sub-items preserved):
   "t": "Describe your approach to:\\na) Security architecture\\nb) Data encryption\\nc) Access controls\\nd) Incident response"

   Rules:
   - Bullet lists: Use "\\n- " or "\\n• " between items
   - Numbered lists: Use "\\n1. ", "\\n2. " etc.
   - Lettered sub-items: Use "\\na) ", "\\nb) " etc.
   - Paragraph breaks: Use "\\n\\n"
   - Section sub-headers within a requirement: Preserve on their own line

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
