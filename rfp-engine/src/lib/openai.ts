import OpenAI from "openai";
import crypto from "crypto";
import { MODELS, TOKEN_LIMITS, RequirementType } from "./constants";
import { sanitizeForLLM } from "./security";
import { matchTemplate } from "./templates";
import { DomainContext, detectDomainContext, getDomainPromptModifier, applyDomainRules, DOMAIN_RULES } from "./domain-context";
import {
  detectConcatenatedRequirements,
  splitConcatenatedRequirement,
  isSectionHeader,
  formatListInRequirement,
  detectAllSectionNumbers,
} from "./parsers/text-preprocessor";
import {
  chunkDocumentBySections,
  SectionChunk,
  ChunkingResult,
} from "./parsers/section-chunker";

// =============================================================================
// OPENAI RETRY WRAPPER WITH EXPONENTIAL BACKOFF
// =============================================================================
interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  timeout?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,  // 1 second
  maxDelay: 10000,     // 10 seconds
  timeout: 120000,     // 2 minutes
};

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    let timeoutId: NodeJS.Timeout | undefined;

    if (attempt > 0) {
      console.log(`[withRetry] Attempt ${attempt + 1}/${opts.maxRetries + 1}...`);
    }

    try {
      // Create timeout promise with clearable timer
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          console.error(`[withRetry] Request timed out after ${opts.timeout}ms`);
          reject(new Error("OpenAI request timed out"));
        }, opts.timeout);
      });

      // Race between the operation and timeout
      const result = await Promise.race([fn(), timeoutPromise]);

      // Clear timeout on success to prevent memory leak
      if (timeoutId) clearTimeout(timeoutId);

      return result;
    } catch (error) {
      // Clear timeout on failure to prevent memory leak
      if (timeoutId) clearTimeout(timeoutId);

      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-retryable errors
      const errorMessage = lastError.message.toLowerCase();
      if (
        errorMessage.includes("invalid api key") ||
        errorMessage.includes("authentication") ||
        errorMessage.includes("quota exceeded") ||
        errorMessage.includes("insufficient_quota") ||
        errorMessage.includes("billing") ||
        errorMessage.includes("rate_limit_exceeded")
      ) {
        throw lastError;
      }

      // If we've exhausted retries, throw
      if (attempt >= opts.maxRetries) {
        console.error(`OpenAI call failed after ${opts.maxRetries + 1} attempts:`, lastError.message);
        throw lastError;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        opts.initialDelay * Math.pow(2, attempt) + Math.random() * 1000,
        opts.maxDelay
      );

      console.warn(`OpenAI call failed (attempt ${attempt + 1}/${opts.maxRetries + 1}), retrying in ${Math.round(delay)}ms:`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Unknown error in retry logic");
}

// =============================================================================
// CONTENT-HASH CACHING FOR EXTRACTIONS
// =============================================================================

// Increment this version when EXTRACTION_PROMPT or extraction logic changes
// This ensures stale cached results are not returned after prompt updates
// v3: Added hierarchical section handling, concatenation splitting, list preservation
const EXTRACTION_VERSION = "v3";

interface CacheEntry<T> {
  result: T;
  timestamp: number;
}

// Simple in-memory cache with TTL (1 hour)
const extractionCache = new Map<string, CacheEntry<ExtractionResult>>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_SIZE = 50; // Limit memory usage

function getContentHash(content: string): string {
  // Include version in hash to invalidate cache when extraction logic changes
  return crypto.createHash("sha256").update(`${EXTRACTION_VERSION}:${content}`).digest("hex").substring(0, 16);
}

function getCachedExtraction(hash: string): ExtractionResult | null {
  const entry = extractionCache.get(hash);
  if (!entry) return null;

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    extractionCache.delete(hash);
    return null;
  }

  return entry.result;
}

function setCachedExtraction(hash: string, result: ExtractionResult): void {
  // Simple LRU-like eviction: if at capacity, remove oldest entries
  if (extractionCache.size >= CACHE_MAX_SIZE) {
    const entries = Array.from(extractionCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    // Remove oldest 25%
    const toRemove = Math.ceil(CACHE_MAX_SIZE * 0.25);
    for (let i = 0; i < toRemove; i++) {
      extractionCache.delete(entries[i][0]);
    }
  }

  extractionCache.set(hash, { result, timestamp: Date.now() });
}

// Validate OpenAI API key
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("CRITICAL: OPENAI_API_KEY environment variable is not set");
}
if (apiKey && !apiKey.startsWith("sk-")) {
  console.error("WARNING: OPENAI_API_KEY does not appear to be a valid OpenAI key format");
}

export const openai = new OpenAI({
  apiKey: apiKey || "missing-key", // Provide fallback to prevent crash, but log error above
});

// =============================================================================
// EXTRACTION PROMPT - With requirement type classification
// =============================================================================
export const EXTRACTION_PROMPT = `You are an expert at analyzing RFP (Request for Proposal) and tender documents. Your task is to extract ALL questions, requirements, and mandatory items from the document.

For each item extracted, identify:
1. The exact text of the requirement or question
2. Whether it is MANDATORY or OPTIONAL - use these rules IN ORDER:

   ==============================================================================
   MANDATORY/OPTIONAL CLASSIFICATION (CHECK IN THIS ORDER - FIRST MATCH WINS)
   ==============================================================================

   === STEP 1: CHECK FOR EXPLICIT OPTIONAL SIGNALS ===
   Set isMandatory: false ONLY IF the text contains EXPLICIT optional language:
   - "optional", "if desired", "if applicable", "where applicable"
   - "at your discretion", "you may choose to", "not required"
   - "bonus points", "nice to have", "desirable but not essential"
   - "preferred but not mandatory", "encouraged but not required"
   - "you may include" (permissive language, not consequence)

   If ANY of these are present → isMandatory: false, STOP.

   === STEP 2: CHECK FOR WARNING/CONSEQUENCE PATTERNS ===
   Set isMandatory: true IF the text contains consequence warnings:
   - "Failure to [X] may/will result in..."
   - "Failure to [X] may render [submission/response] invalid"
   - "If not [provided/submitted/included], [consequence]..."
   - "Non-compliance with [X] may/will result in..."
   - "Proposals/submissions that do not [X] will be [rejected/disqualified]"
   - "Incomplete [submissions/responses] may be [rejected/not considered]"

   WARNING PATTERNS OVERRIDE "should" and "may" - these are MANDATORY.
   If ANY warning pattern is present → isMandatory: true, STOP.

   === STEP 3: CHECK FOR STRONG MANDATORY SIGNALS ===
   Set isMandatory: true IF the text contains:
   - "must", "shall", "required", "mandatory", "essential", "critical", "obligatory"
   - "will" as commitment: "Respondents will provide...", "Proposals will include..."
   - "are required to", "is required", "must be provided", "shall include"

   If ANY of these are present → isMandatory: true, STOP.

   === STEP 4: CHECK FOR STRUCTURAL MANDATORY SIGNALS ===
   Set isMandatory: true IF the text contains:
   - Word/character limits: "maximum X words", "X word limit", "not to exceed X"
   - Direct questions (contains "?") requesting specific information
   - Request language: "Please provide...", "Describe your...", "Explain your...",
     "State your...", "Outline your...", "Detail your..."

   If ANY structural signal is present → isMandatory: true, STOP.

   === STEP 5: CONTEXT-AWARE "should" INTERPRETATION ===
   "should" in RFP context is typically a POLITE IMPERATIVE (mandatory):

   "should" is MANDATORY when:
   - Requests specific information: "should state", "should provide", "should describe"
   - Precedes deadline/action: "should notify by", "should submit by"
   - Describes expected content: "should include", "should address"
   - No explicit optional alternative is provided

   "should" is OPTIONAL only when:
   - Paired with optional language: "should, if possible, include"
   - Alternative provided: "should do X, but may do Y instead"
   - Explicit preference: "Ideally, respondents should..."

   If "should" is present without optional context → isMandatory: true

   === STEP 6: DEFAULT TO MANDATORY ===
   If none of the above rules determined classification:
   → isMandatory: true (DEFAULT)

   RATIONALE: In professional RFPs, all questions and requirements expect a response.
   Optional items are the EXCEPTION and are explicitly marked as such.

   CONTEXT FOR "may":
   - "you may include additional..." = OPTIONAL (permission)
   - "failure to X may result in Y" = MANDATORY (consequence warning)
   - "respondents may" without consequence = OPTIONAL (permission)
   - Always check the full sentence context for "may"
3. Section references - TWO SEPARATE FIELDS:
   ==============================================================================
   You must provide BOTH "section" AND "sectionGroup" for each requirement:
   ==============================================================================

   a) "section" - The SPECIFIC subsection reference where this requirement appears:
      • This is the exact location/number in the document
      • Examples: "A.1.2", "3.4.1", "B.2", "5.1.3", "II.A"
      • Just the number/reference, NOT the title
      • If the requirement appears under "A.1.2 Staffing Requirements", use "A.1.2"

   b) "sectionGroup" - The PARENT/MAJOR section with its TITLE:
      • Look for the nearest major heading (A, B, 1, 2, etc.) and include its title
      • Format: "NUMBER: TITLE"
      • Examples: "A: REQUIRED BANKING SERVICES", "3: TECHNICAL REQUIREMENTS"
      • This is used for grouping/filtering requirements by major category

   EXAMPLES:
   • Document has "A. REQUIRED BANKING SERVICES" then "A.1.2 Staffing" underneath:
     → section: "A.1.2"
     → sectionGroup: "A: REQUIRED BANKING SERVICES"

   • Document has "3. Technical Requirements" then "3.4.1 Security":
     → section: "3.4.1"
     → sectionGroup: "3: Technical Requirements"

   • Document has just "5. Pricing" with no subsections:
     → section: "5"
     → sectionGroup: "5: Pricing"

   IMPORTANT: sectionGroup should ALWAYS include the title if one exists.
4. The REQUIREMENT TYPE - classify each requirement into ONE of these categories:

==============================================================================
REQUIREMENT TYPES (with TRIGGER KEYWORDS - match keywords FIRST, then context)
==============================================================================

■ QUANTITATIVE
  ==============================================================================
  ACID TEST: Is the PRIMARY PURPOSE to obtain ACTUAL NUMBERS (prices, %, values)?
  → If YES (asking for specific prices, costs, percentages) → QUANTITATIVE
  → If NO (numbers are incidental, or asking about process/compliance) → Other type
  ==============================================================================

  STRICT TRIGGER KEYWORDS (MUST contain at least one):
  £, $, €, ¥, price, pricing, cost, costing, fee, fees, rate, rates,
  budget, tender sum, quote, quotation, TCO, ROI,
  %, percent, percentage

  STRONG INDICATORS (phrases that signal QUANTITATIVE):
  • "what is the cost", "provide pricing", "your fees for"
  • "what percentage", "how much" (when asking for specific numbers)
  • "provide figures", "provide numbers", "breakdown of costs"
  • Currency amounts or % values being requested

  USE WHEN: Asking for ACTUAL PRICES, COSTS, PERCENTAGES, or NUMERIC VALUES

  Examples - QUANTITATIVE:
  • "Provide detailed pricing breakdown" → QUANTITATIVE (asks for prices)
  • "What is your cost per user per month?" → QUANTITATIVE (specific cost)
  • "What percentage uptime do you guarantee?" → QUANTITATIVE (asks for %)
  • "Does your three-year total come in under £150k?" → QUANTITATIVE (pricing)

  ==============================================================================
  NOT QUANTITATIVE - Common False Positives (use correct type instead):
  ==============================================================================
  • "Describe your approach to metrics" → DESCRIPTIVE (asks HOW, not values)
  • "How do you measure success?" → DESCRIPTIVE (asks for explanation)
  • "Do you comply with SLA requirements?" → DECLARATIVE (compliance question)
  • "Provide 3 client references" → REFERENCE_BASED (count is incidental)
  • "How many FTEs will be dedicated?" → STAFFING (personnel question)
  • "What are your key performance indicators?" → DESCRIPTIVE (asks to describe)

■ EVIDENCE_BASED
  TRIGGER KEYWORDS (if ANY present, strongly consider EVIDENCE_BASED):
  attach, attached, include, included, submit, upload, enclose, provide copy,
  sample, example, specimen, mock-up, template, certificate, certification,
  license, insurance, bond, evidence, proof, documentation, appendix

  USE WHEN: Response requires a FILE or ATTACHMENT, not just written text
  Examples:
  • "Include a sample monthly report" → EVIDENCE_BASED
  • "Attach proof of insurance" → EVIDENCE_BASED
  • "Provide copies of certifications" → EVIDENCE_BASED

■ REFERENCE_BASED
  TRIGGER KEYWORDS (if ANY present, strongly consider REFERENCE_BASED):
  reference, references, past performance, similar project, previous client,
  client contact, customer reference, case study, track record, experience with

  USE WHEN: Asks for client contacts, project history, or verifiable references
  Examples:
  • "Provide 3 client references" → REFERENCE_BASED
  • "Describe similar projects completed" → REFERENCE_BASED
  • "List your experience with comparable implementations" → REFERENCE_BASED

■ STAFFING
  ==============================================================================
  STAFFING HAS PRIORITY OVER CONTEXTUAL when asking for person contact info!
  ==============================================================================

  TRIGGER KEYWORDS (if ANY present, strongly consider STAFFING):
  personnel, staff, team, resource, FTE, headcount, resume, CV, qualifications,
  project manager, key personnel, roles, responsibilities, org chart, bio,
  experience of staff, dedicated resource, contact person, contact details,
  name and address, email address, telephone number, individual with authority

  USE WHEN: About team composition, individual qualifications, personnel, OR contact information

  STAFFING BEATS CONTEXTUAL - Even if text contains "shall submit" or "must provide":
  ==============================================================================
  When asking for a PERSON'S name/email/phone/contact info → ALWAYS use STAFFING
  The fact that it says "shall submit" does NOT make it CONTEXTUAL.
  ==============================================================================

  Examples:
  • "Identify key personnel for this project" → STAFFING
  • "Provide CVs of proposed team members" → STAFFING
  • "Describe your project manager's qualifications" → STAFFING
  • "Submit the name, address, email, and telephone of an individual with authority to answer questions" → STAFFING
  • "Banks shall submit the name, address, email address, and telephone number of an individual" → STAFFING
    (Even though it says "shall submit", it's asking for person contact info → STAFFING)

  CRITICAL: Requests for CONTACT INFORMATION of a person are STAFFING, not CONTEXTUAL:
  • "Provide name and contact details of your project lead" → STAFFING
  • "Submit contact information for clarification questions" → STAFFING
  • "Shall submit name, address, and email of authorized representative" → STAFFING

■ CONTEXTUAL
  ==============================================================================
  ACID TEST: Does this require a WRITTEN RESPONSE in the proposal?
  → If NO written response is needed in the proposal document → CONTEXTUAL
  → If YES a written answer/statement is needed → NOT CONTEXTUAL (use another type)
  ==============================================================================

  *** EXCEPTION: NEVER classify as CONTEXTUAL if asking for person contact info! ***
  If text asks for name, email, telephone, address of a PERSON → use STAFFING instead
  (See STAFFING section for details)

  MANDATORY CONTEXTUAL - These patterns are ALWAYS CONTEXTUAL regardless of other signals:

  A. CONSEQUENCE/WARNING PATTERNS (ALWAYS CONTEXTUAL):
     • "Failure to [verb] may/will result in..."
     • "Failure to [verb] may render [the RFP/submission/response] invalid..."
     • "If not [provided/submitted/included], you will/may be [excluded/disqualified/eliminated]..."
     • "Non-compliance with [X] may result in..."
     These are WARNING STATEMENTS about process rules, NOT questions requiring answers.

  B. PROCESS INSTRUCTION PATTERNS (ALWAYS CONTEXTUAL):
     • "You should/shall/must [notify/submit/ensure/return/deliver/send/direct]..."
     • "RFP [Respondents/Submissions] shall/should/must [process verb]..."
     • "Respondents are [required/expected/advised] to [process action]..."
     • "[Submissions/Responses] must be [delivered/received/sent/submitted] [by/to]..."
     • "[Submissions/Responses] shall include [document X]" (instruction, not asking for content)
     • "[Entity] shall/must/should answer/respond to ALL [questions/requirements]..."
     These TELL you what to do procedurally; they don't ask for written proposal content.

     CRITICAL: Meta-instructions about HOW to respond to the RFP are CONTEXTUAL:
     • "Banks shall answer ALL questions in this RFP" → CONTEXTUAL (tells you to answer OTHER questions, not THIS one)
     • "Respondents must address each requirement" → CONTEXTUAL (instruction about process)
     • "Failure to respond to each requirement may result in rejection" → CONTEXTUAL (warning)
     These are INSTRUCTIONS ABOUT the RFP process, not questions requiring answers themselves.

  C. DEADLINE/TIMING INSTRUCTIONS (ALWAYS CONTEXTUAL when not asking a question):
     • "[Action] by [date]" - e.g., "Submit by Friday 7 February"
     • "Deadline for [X] is [date]"
     • "Responses/Submissions due by..."
     • "Notify us of your intention by [date]"

  D. BACKGROUND/INTRODUCTORY CONTENT (ALWAYS CONTEXTUAL):
     • Describes the issuing organization
     • Explains purpose/scope of the RFP
     • Provides project background information
     • "Clarifications may be submitted to...", "Questions should be directed to..."

  E. BUYER REQUIREMENTS/EXPECTATIONS (ALWAYS CONTEXTUAL):
     • "We require [X]" - declarative statement of need
     • "We need [X]" - organizational requirement
     • "We are looking for [X]" - procurement intention
     • "We expect [capability]" - buyer's expectation
     • "The selected/chosen provider should/will/is expected to [have/offer/provide]..."
     • "Our requirements include..."
     • "Requirements for [X]: [capability list]"

     THE ACID TEST: Is the RFP TELLING the bidder what the buyer wants?
     → If BUYER DECLARING needs (no question mark) → CONTEXTUAL
     → If ASKING BIDDER to explain/describe → NOT CONTEXTUAL

     CRITICAL: Mentioning capabilities in a buyer's needs statement does NOT make it DESCRIPTIVE.
     - "We require omnichannel tools" → CONTEXTUAL (buyer stating their requirement)
     - "Describe your omnichannel tools" → DESCRIPTIVE (asking bidder to explain)

  ==============================================================================
  CRITICAL: CONTEXTUAL vs DECLARATIVE - Common Confusion Points
  ==============================================================================

  The word "shall" does NOT automatically mean DECLARATIVE. Look at the SUBJECT and VERB:

  CONTEXTUAL (process instruction - no written response):
  • "RFP submissions SHALL INCLUDE a signed Form of Tender" → Telling you what to include
  • "Respondents SHALL ENSURE all information is supplied" → Telling you to do something
  • "You SHOULD NOTIFY us by [date]" → Telling you to take an action

  DECLARATIVE (asks for written statement - needs response):
  • "CONFIRM you will include a signed Form of Tender" → Asking for confirmation statement
  • "STATE whether you can ensure all information is supplied" → Asking for a statement
  • "Will you notify us by [date]?" → Direct question requiring answer

  THE DIFFERENCE: CONTEXTUAL uses imperative/instructive language telling you WHAT TO DO.
  DECLARATIVE asks you to WRITE something (confirm, state, declare, answer yes/no).

  ==============================================================================
  CRITICAL: CONTEXTUAL vs DESCRIPTIVE - WHO IS THE SUBJECT?
  ==============================================================================
  This is the #1 misclassification source for buyer requirements.

  CONTEXTUAL (buyer stating needs - NO response needed):
  • "We require a fixed ESP to provide X features"
  • "The organization expects Y capability"
  • "Our needs include Z functionality"
  • "The chosen provider is expected to offer robust tools"

  DESCRIPTIVE (asking bidder to explain - RESPONSE needed):
  • "Describe your ESP features"
  • "Explain how you provide X capability"
  • "How do you deliver Y functionality?"

  The key: WHO is the subject doing the describing/providing?
  - BUYER describing THEIR needs → CONTEXTUAL (background, no response)
  - BIDDER describing THEIR solution → DESCRIPTIVE (response required)

  ==============================================================================

  NOT CONTEXTUAL (these require written responses - use other types):
  ✗ "Describe your approach to..." → DESCRIPTIVE
  ✗ "Confirm you will comply with..." → DECLARATIVE (asks for confirmation)
  ✗ "Will you be able to...?" → DECLARATIVE (direct question)
  ✗ "How do you ensure...?" → DESCRIPTIVE
  ✗ "Provide evidence of..." → EVIDENCE_BASED
  ✗ "State your policy on..." → DECLARATIVE

  EXAMPLES - CONTEXTUAL:
  • "The Treasurer of X County is soliciting proposals for..." → CONTEXTUAL (background)
  • "ABC Organization serves 50,000 customers annually" → CONTEXTUAL (background)
  • "RFP Responses should be submitted by email by 12:00pm Friday" → CONTEXTUAL (process)
  • "You should notify of your intention to make a submission by [date]" → CONTEXTUAL (process)
  • "Failure to provide all information may render the RFP invalid" → CONTEXTUAL (warning)
  • "RFP Respondents shall ensure that all information is supplied" → CONTEXTUAL (process instruction)
  • "RFP submissions shall include a signed copy of the Form of Tender. If not provided you will be excluded." → CONTEXTUAL (process instruction with warning)
  • "Respondents seeking clarifications may do so in writing" → CONTEXTUAL (process)
  • "We require a fixed, permanent ESP to cover the next three years." → CONTEXTUAL (buyer requirement)
  • "The chosen provider is expected to offer a robust set of omnichannel marketing tools." → CONTEXTUAL (buyer expectation)
  • "We are looking for a solution that integrates with our existing systems." → CONTEXTUAL (buyer need)
  • "Banks shall answer ALL questions in this RFP. Failure to respond to each of the requirements in this RFP may be the basis for rejecting a response." → CONTEXTUAL (meta-instruction + warning about process, NOT a question itself)

■ DESCRIPTIVE
  INDICATORS (classify as DESCRIPTIVE if ANY apply):
  • Contains "describe", "explain", "outline", "detail", "elaborate", "discuss"
  • Contains a comma-separated list of 3+ features/capabilities to address
  • Starts with "Please provide information on..."
  • Asks about platform/system capabilities or features
  • Contains phrases like "ability to cover:", "capabilities for:", "support for:"

  USE WHEN: Requires detailed written explanation, multiple items, or comprehensive response
  Examples:
  • "Describe your approach to data migration" → DESCRIPTIVE
  • "Explain your methodology for quality assurance" → DESCRIPTIVE
  • "Please provide information on the platform's ability to cover: X, Y, Z" → DESCRIPTIVE

■ DECLARATIVE
  USE WHEN: Simple yes/no compliance question about POLICIES or STATUS (not pricing!)
  IMPORTANT: If the yes/no question is about PRICING → use QUANTITATIVE instead
  Examples:
  • "Do you comply with ISO 27001?" → DECLARATIVE (compliance status)
  • "Confirm you accept the terms and conditions" → DECLARATIVE
  • "State your data protection policy" → DECLARATIVE

■ PROCEDURAL
  USE WHEN: Simple confirmation or acknowledgment that requires a brief response
  NOTE: If telling you HOW/WHEN to submit (no response needed) → CONTEXTUAL instead
  Examples:
  • "Confirm receipt of this RFP" → PROCEDURAL
  • "Sign the attached form" → PROCEDURAL
  • "Provide your contact details" → PROCEDURAL

==============================================================================
CLASSIFICATION PRIORITY (FIRST MATCH WINS - CHECK IN THIS ORDER)
==============================================================================

>>> STEP 0: CHECK FOR STAFFING CONTACT KEYWORDS FIRST (HIGHEST PRIORITY) <<<
CRITICAL EXCEPTION: When asking for PERSON CONTACT INFORMATION, this is STAFFING even if
it contains process verbs like "shall submit" or "must provide".

STAFFING OVERRIDE KEYWORDS - If the text contains ANY of these, classify as STAFFING:
  • "name, address" OR "name and address" (person's contact info)
  • "email address" combined with "name" or "telephone" or "individual"
  • "telephone number" or "phone number" combined with person-related words
  • "individual with authority" or "individual with the authority"
  • "contact person" or "contact details" for a specific person
  • "submit the name" or "provide the name" of a person

Example that MUST be STAFFING (not CONTEXTUAL):
  "Banks shall submit the name, address, email address, and telephone number of an
   individual with the authority to answer questions" → STAFFING
   WHY: It's asking for a PERSON'S contact information to include in the proposal.

If STAFFING OVERRIDE KEYWORDS are present → classify as STAFFING and STOP.

>>> STEP 1: CHECK FOR CONTEXTUAL (high priority) <<<
Ask: "Does this require the respondent to WRITE something in the proposal?"

CONTEXTUAL (no written response needed) - Check for these patterns:
  ✓ Contains "Failure to [X] may/will result in..." → CONTEXTUAL (warning)
  ✓ Contains "If not [provided/included], [consequence]" → CONTEXTUAL (warning)
  ✓ Contains "shall/should/must [notify/submit/ensure/include/deliver/send]" → CONTEXTUAL (process instruction)
      EXCEPTION: NOT CONTEXTUAL if asking for person contact info (see STEP 0 above)
  ✓ Contains "submissions/responses shall include [document]" → CONTEXTUAL (instruction)
  ✓ Background paragraph about the organization → CONTEXTUAL
  ✓ Deadline statement without a question → CONTEXTUAL
  ✓ Contains "We require/need/are looking for [X]" (buyer stating needs, no question mark) → CONTEXTUAL
  ✓ Contains "The [selected/chosen] provider is expected to..." → CONTEXTUAL (buyer expectation)
  ✓ Subject is BUYER describing their requirements (not asking bidder to explain) → CONTEXTUAL

If ANY of the above match (and STEP 0 didn't match) → classify as CONTEXTUAL and STOP.

>>> STEP 2: IF NOT CONTEXTUAL, check other types in order <<<

IMPORTANT: Check subject-specific types BEFORE generic ones to avoid false positives!
CRITICAL: Classification is based on WHAT you're asking for (subject), NOT HOW you're asking (verb).

3. EVIDENCE_BASED: Asks to attach/include/submit/upload a file, sample, or document
4. REFERENCE_BASED: Asks for references, past performance, client contacts, case studies
5. STAFFING: Asks for team, personnel, staff, qualifications, CVs, FTEs
6. QUANTITATIVE: Subject matter is NUMERICAL - asking for rates, fees, prices, costs, percentages, or specific numeric data
   QUANTITATIVE TRIGGERS (if ANY present, classify as QUANTITATIVE regardless of verb):
   - Financial terms: rate, rates, earnings, interest, fee, fees, pricing, cost, price, charge, charges, index
   - Currency/percentage symbols: £, $, €, %
   - Temporal numeric requests: "last X months", "monthly rates", "annual", "quarterly figures"
   - Numeric listing requests: "list the rates", "provide the figures", "state the percentages"
   Example: "Describe what index the earnings rate would be pegged to, listing the last six months' rates" → QUANTITATIVE (subject: rates/numbers)
7. DESCRIPTIVE: Contains "describe/explain/outline/how do you" about NON-NUMERICAL topics (processes, approaches, capabilities)
   Example: "Describe your approach to customer service" → DESCRIPTIVE (subject: approach, not numbers)
8. DECLARATIVE: Yes/no compliance question (about policy/status, NOT pricing)
9. PROCEDURAL: Simple confirmation or acknowledgment needed
10. Default → DESCRIPTIVE

NOTE: The verb "describe" does NOT automatically mean DESCRIPTIVE. Check the SUBJECT first:
- "Describe your rates" → QUANTITATIVE (subject: rates = numbers)
- "Describe your process" → DESCRIPTIVE (subject: process = narrative)

==============================================================================
CRITICAL: CONTEXTUAL vs DECLARATIVE - The "shall/should" Trap
==============================================================================

Many misclassifications occur because "shall" appears in both types. THE KEY IS:
- Is it TELLING you to do something (process)? → CONTEXTUAL
- Is it ASKING you to write/confirm something? → DECLARATIVE

CONTEXTUAL (instructions - no written answer):
• "RFP submissions shall include a signed Form of Tender" → Instruction
• "Respondents shall ensure all information is supplied" → Instruction
• "Failure to [X] may render the RFP invalid" → Warning
• "You should notify us by [date]" → Instruction

DECLARATIVE (questions - requires written answer):
• "Confirm you will include a signed Form of Tender" → Asks for confirmation
• "State whether you will ensure all information is supplied" → Asks for statement
• "Do you agree to [terms]?" → Question
• "Will you notify us by [date]?" → Question (note the question mark)

==============================================================================
YES/NO QUESTIONS - Subject Matter Determines Type
==============================================================================
The question FORMAT (yes/no) does NOT determine the type. The SUBJECT determines type:

• "Does your price come in under £150k?" → QUANTITATIVE (subject: pricing)
• "Do you comply with ISO 27001?" → DECLARATIVE (subject: compliance status)
• "Will you submit by the deadline?" → DECLARATIVE (question requiring answer)
• "Can you provide three references?" → REFERENCE_BASED (subject: references)
• "Do you have certified project managers?" → STAFFING (subject: personnel)

But STATEMENTS about process (not questions) are CONTEXTUAL:
• "Submit your response by [date]" → CONTEXTUAL (instruction, no answer needed)
• "Failure to submit by [date] will result in disqualification" → CONTEXTUAL (warning)

5. The DOMAIN CONTEXT - classify into ONE of these domains:

DOMAIN CONTEXTS:
- LEGAL: Mentions data, regulation, compliance, GDPR, privacy, terms, liability, security, certification, audit, ISO, SOC, breach, retention, processor, controller, DPA, SLA, indemnity, contract
- PROCESS: Asks "how", mentions process, approach, steps, methodology, workflow, timeline, implementation, migration, onboarding, training, support, deployment
- FEATURE: Default - describes capabilities, features, integrations, functionality (use when not clearly Legal or Process)

DOMAIN CLASSIFICATION PRIORITY:
1. If mentions data protection, compliance, GDPR, security certifications, legal terms → LEGAL
2. If asks "how" something works, or mentions process/steps/timeline/implementation → PROCESS
3. Otherwise → FEATURE (default)

6. WORD/CHARACTER LIMITS - For each requirement, detect if there are response length limits:
- Look for patterns: "maximum X words", "not to exceed X characters", "in X words or less", "limit: X words", "X word limit"
- Extract numeric values for wordLimit and/or characterLimit
- If no limit mentioned, set to null

7. ATTESTATION CLASSIFICATION - Determine if the requirement is suitable for binary attestation (Compliant/Non-Compliant checkbox) vs requiring a written response:

ATTESTATION ELIGIBLE (isAttestation: true):
- Status/credential verification: "must hold", "must maintain", "must be certified", "must be licensed"
- Procedural/timeline: "must submit by", "shall deliver to", "responses due", "due by"
- Standard regulatory compliance: references specific statute, FAR clause, CFR, regulation
- Simple yes/no compliance with no explanation requested
- Standard insurance, licensing, bonding requirements

NOT ATTESTATION (isAttestation: false):
- Contains "describe", "explain", "detail", "demonstrate", "outline", "discuss"
- Invites alternatives: "or equivalent", "if applicable", "may propose", "alternative"
- Requests approach, methodology, or strategy
- Compound requirements with multiple conditions needing explanation
- Requires samples, attachments, or documentation

When uncertain, default to NOT attestation (isAttestation: false) - this is the safer assumption.

Return your response as a JSON object with this structure:
{
  "deadline": "ISO 8601 date string (YYYY-MM-DDTHH:mm:ss) or null if no deadline found",
  "deadlineText": "Original deadline text from document (e.g., '5pm Friday 14 February 2025') or null",
  "requirements": [
    {
      "text": "The COMPLETE requirement text including context, numbered questions, and word limits. Example: if document says 'We have a budget of £150k. 1. Does your total come in under this? (Max 2500 words)' then text should be 'We have a budget of £150k. 1. Does your total come in under this? (Max 2500 words)' - never truncate to just the first sentence.",
      "isMandatory": true/false,
      "section": "Specific subsection reference (e.g., 'A.1.2', '3.4.1', 'B.2') - just the number, NOT the title",
      "sectionGroup": "Parent section with title (e.g., 'A: REQUIRED BANKING SERVICES', '3: Technical Requirements')",
      "type": "CONTEXTUAL" | "PROCEDURAL" | "DECLARATIVE" | "DESCRIPTIVE" | "EVIDENCE_BASED" | "QUANTITATIVE" | "REFERENCE_BASED" | "STAFFING",
      "domainContext": "FEATURE" | "PROCESS" | "LEGAL",
      "wordLimit": number or null,
      "characterLimit": number or null,
      "isAttestation": true/false (binary attestation eligible)
    }
  ]
}

CRITICAL INSTRUCTIONS:
- DEADLINE: Search the ENTIRE document for submission deadline. Look for: "submit by", "due date", "deadline", "responses due", "closing date", "must be received by". Extract the most specific deadline found.
- Be thorough - extract ALL questions, requirements, deliverables, and compliance items
- Include direct questions, mandatory requirements, deliverables, timelines, compliance requirements, technical specifications, and pricing requirements

==============================================================================
HIERARCHICAL SECTION HANDLING (CRITICAL - READ CAREFULLY)
==============================================================================
Documents often use multi-level numbering systems. You MUST understand the hierarchy:

LEVEL 1 - Major Section (X.0 or X):
  Examples: "3.0 Direct Query Questions" or "4. Technical Requirements"
  → Extract as type: CONTEXTUAL (provides context, no response needed)
  → This is a SECTION HEADER introducing what follows

LEVEL 2 - Subsection (X.Y):
  Examples: "3.1 Design, Form, and Templates" or "4.2 Security Requirements"
  → Extract as type: CONTEXTUAL (subsection header, no response needed)
  → This is a SUBSECTION HEADER grouping related requirements
  → The text is typically SHORT (just a title)

LEVEL 3 - Individual Requirement (X.Y.Z):
  Examples: "3.1.1 Does the solution provide..." or "4.2.3 Describe your approach..."
  → Extract as INDIVIDUAL requirements with appropriate type
  → Each numbered item (3.1.1, 3.1.2, 3.1.3...) is a SEPARATE requirement

*** CRITICAL ERROR TO AVOID ***
NEVER combine a subsection header with its requirements into one item.
WRONG: "3.1 Design, Form, and Templates: 3.1.1 Does the solution... 3.1.2 Does the WCMS..."
RIGHT: Extract THREE separate items:
  1. "3.1 Design, Form, and Templates" (section: "3.1", type: CONTEXTUAL)
  2. "Does the solution provide..." (section: "3.1.1", type: DESCRIPTIVE or appropriate)
  3. "Does the WCMS provide..." (section: "3.1.2", type: DESCRIPTIVE or appropriate)

How to detect subsection headers:
- Short text (usually under 50 characters)
- Contains only a title, no question marks
- Followed by multiple X.Y.Z numbered items
- Marked with [SUBSECTION] tag in preprocessed text

==============================================================================
REQUIREMENT SEPARATION (NEVER CONCATENATE)
==============================================================================
Each numbered item must be its own requirement. When you see:
  "3.1.1 First question? 3.1.2 Second question? 3.1.3 Third question?"
You MUST create THREE separate requirements, NOT one requirement with all text.

Signs you're incorrectly concatenating:
- Your requirement text contains multiple X.Y.Z patterns (e.g., "3.1.1...3.1.2...3.1.3")
- Your requirement text has multiple question marks with numbered items between them
- The text is extremely long (>500 characters) with multiple distinct questions

If you see multiple numbered items in one text block, SPLIT THEM.

==============================================================================
LIST PRESERVATION IN REQUIREMENTS
==============================================================================
When a requirement contains a list (bullets or numbers), preserve the formatting:
- Keep bullet points (•, -, *) on separate lines
- Keep numbered sub-items (a), b), 1., 2.) on separate lines
- Preserve the list structure in your extracted text

EXAMPLE:
Original: "Please describe your approach to: • Security measures • Access controls • Audit logging"
Extracted text should be:
"Please describe your approach to:
• Security measures
• Access controls
• Audit logging"

NOT flattened to: "Please describe your approach to: • Security measures • Access controls • Audit logging"

==============================================================================

- COMPLETE TEXT EXTRACTION (CRITICAL):
  * Extract the ENTIRE requirement text, including ALL parts
  * If a paragraph introduces context followed by a numbered question (e.g., "1. Does your..."), include BOTH the context AND the question
  * Never truncate at the preamble - always include the actual question being asked
  * If there's a word count limit mentioned (e.g., "Maximum word count 2,500"), include that in the extracted text
  * The "text" field must contain everything the responder needs to understand and answer the requirement
  * BUT: If you see multiple X.Y.Z numbered items, extract each as a SEPARATE requirement
- TABLE FORMAT: Documents may contain structured tables in this format:
  * [TABLE START] / [TABLE END] markers indicate table boundaries
  * [HEADER] indicates column headers
  * [ROW N] indicates data rows
  * [Col N] indicates column values
  * When extracting from tables, combine relevant columns into a coherent requirement (e.g., if Col 1 is "Ref" and Col 2 is "Requirement", combine them logically)
- STRUCTURE MARKERS: The document may contain preprocessing markers:
  * [PAGE N] indicates page boundaries
  * [SUBSECTION] indicates a subsection header (extract as CONTEXTUAL)
  * ════════ lines indicate major section boundaries
  * ────── lines indicate subsection boundaries
  Use these markers to understand document structure, but do not include them in extracted text.
- Do not summarize or paraphrase - extract the actual text from the document
- Classify EVERY requirement with the most appropriate type
- When uncertain between types, default to DESCRIPTIVE`;

// =============================================================================
// SECTION-BASED EXTRACTION PROMPT (DEPRECATED - kept for reference)
// =============================================================================
/**
 * DEPRECATED: This condensed prompt caused massive type misclassification.
 * Kept for reference. The chunked extraction now uses the full EXTRACTION_PROMPT.
 *
 * Problem: The condensed format lacked the detailed examples and edge case handling
 * that the LLM needs for accurate STAFFING, REFERENCE_BASED, etc. classification.
 */
export const SECTION_EXTRACTION_PROMPT = `You are an expert at analyzing RFP/tender documents. Extract ALL requirements from this SECTION.

OUTPUT FORMAT (JSON):
{
  "requirements": [
    {
      "text": "Full requirement text with lists on separate lines",
      "section": "3.1.1",
      "sectionGroup": "Technical Requirements",
      "isMandatory": true,
      "type": "DESCRIPTIVE",
      "wordLimit": null,
      "characterLimit": null,
      "isAttestation": false
    }
  ]
}

REQUIREMENT TYPES - Choose ONE (8 types):
1. CONTEXTUAL - Background info, not answerable (org description, project context)
2. PROCEDURAL - Yes/No compliance questions ("Can you confirm...?", "Do you comply...?")
3. DECLARATIVE - Acknowledge/attest to conditions ("By submitting you acknowledge...")
4. DESCRIPTIVE - Describe approach, methodology, experience ("Describe your...", "Explain how...")
5. QUANTITATIVE - Specific numbers/prices/dates ("Provide pricing for...", "What are your rates?")
6. EVIDENCE_BASED - Attach documents/certifications ("Provide copies of...", "Attach ISO certificate")
7. REFERENCE_BASED - Request for references/case studies ("Provide client references", "List similar projects")
8. STAFFING - Team, personnel, qualifications, CVs, FTEs ("Identify key personnel", "Provide team CVs")

TYPE DECISION RULES:
- "Does your system..." / "Can you..." / "Please confirm..." → PROCEDURAL
- "Describe your approach to..." → DESCRIPTIVE (even if topic is pricing/costs)
- "Provide your pricing for..." / "What is the cost?" → QUANTITATIVE
- "Please provide your ISO certification" / "Attach documents" → EVIDENCE_BASED
- "Provide client references" / "List similar projects completed" → REFERENCE_BASED
- Team/personnel/staff/qualifications/CVs/FTEs questions → STAFFING
- Attestation language ("By submitting...", "The bidder acknowledges...") → DECLARATIVE + isAttestation: true

STAFFING PRIORITY: If text asks for personnel, team members, CVs, qualifications, or contact info of staff → use STAFFING
REFERENCE PRIORITY: If text asks for client references, case studies, or project examples → use REFERENCE_BASED

CRITICAL - SECTION NUMBER PRESERVATION:
- The section context header tells you what major section this content is from
- If header says "FROM SECTION 4", requirements should be numbered 4.X.X, NOT 3.X
- Preserve the EXACT section numbers as they appear in the document
- Do NOT renumber or interpret - use the literal numbers from the text

EXTRACTION RULES:
- Extract EVERY numbered item (X.Y.Z) as a SEPARATE requirement
- Include section headers (3.1, 3.2) as CONTEXTUAL type
- Extract COMPLETE text including any listed items/bullets
- PRESERVE LIST FORMATTING: Put each list item on a new line with proper indentation
- Preserve word/character limits if mentioned
- Do NOT include document markers ([PAGE], [SUBSECTION], ════, etc.) in text
- Extract to the END of the section - don't stop early

LIST FORMATTING EXAMPLE:
If the requirement has a list like "a. Name b. Title c. Email", extract as:
"Provide the following information:
a. Name
b. Title
c. Email"

Extract ALL requirements from the section below - especially the LAST few items.`;

// =============================================================================
// DRAFT PROMPTS - Type-specific, RFP-focused (NOT email-style)
// =============================================================================
const DRAFT_PROMPT_BASE = `You are writing a formal RFP (Request for Proposal) response.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. You are writing a FORMAL RFP RESPONSE, NOT an email
2. Do NOT start with "Dear", "Hi", "Hello", "Subject:", or any greeting
3. Do NOT end with "Best regards", "Sincerely", "Kind regards", or any sign-off
4. Do NOT repeat or restate the requirement text in your response
5. Write in third person referring to "[COMPANY NAME]" or "the Respondent"
6. Be direct, professional, and concise
7. Use placeholders like [COMPANY NAME], [DATE], [SPECIFIC DETAILS] where needed
8. Information irrelevant to the current response should NEVER be added.
9. You should never assume the channels nor operation of the Company, and never oversell what they do.

BANNED FILLER PHRASES - ABSOLUTELY NEVER USE:
- "We are pleased to...", "It is our pleasure to..."
- "Additionally...", "Furthermore...", "Moreover..."
- "It is worth noting that...", "It should be noted that..."
- "As mentioned previously...", "As stated above..."
- "Moving forward...", "Going forward..."
- "At the end of the day...", "When all is said and done..."
- "In terms of...", "With respect to...", "In this regard..."
- "For your consideration...", "Please be advised that..."
- "Needless to say...", "It goes without saying..."
- "As a matter of fact...", "In fact..."
- "We would like to take this opportunity..."
- "We are confident that...", "Rest assured..."
- "Aligning with the requirements...", "In accordance with..."
- "We believe that...", "We feel that..."
- "It is important to note...", "It is essential to..."
- "In conclusion...", "To summarize...", "To conclude..."
- "Please do not hesitate to...", "Should you have any questions..."
- Any phrase starting with "We are happy to...", "We are delighted to..."

EVERY WORD MUST ADD VALUE. If a sentence works without a phrase, remove that phrase.

ANTI-OVERCLAIMING RULES (CRITICAL - LEGAL RISK):
- NEVER claim capabilities without using conditional language
- NEVER use absolute terms: "guarantee", "always", "never", "100%", "best", "leading", "unmatched", "unparalleled", "industry-leading", "best-in-class"
- ALWAYS use hedged language: "typically", "generally", "subject to configuration", "in most cases", "designed to"
- Use "[CONFIRM capability]" placeholder for any specific feature you're uncertain about
- Say "standard approach includes" NOT "we do"
- Say "supports" or "capability exists for" NOT "provides" or "offers"
- End capability claims with: "Specific configurations to be confirmed during discovery."
- For integrations, say "supports integration with" NOT "integrates with"
- For compliance, say "designed to support compliance with" NOT "complies with" or "certified"
- NEVER make claims about specific SLAs, uptime, or performance metrics without placeholders

FORMATTING RULES (PROFESSIONAL RFP STANDARDS):
- NEVER use markdown table syntax (| characters, --- separators)
- Use bullet points (•) or simple lists instead of tables
- Keep formatting clean and professional - no excessive symbols
- Responses will be copy-pasted into formal documents, so avoid any formatting that looks amateur`;

const DRAFT_PROMPTS: Record<RequirementType, string> = {
  CONTEXTUAL: "", // No draft needed for contextual requirements
  PROCEDURAL: `${DRAFT_PROMPT_BASE}

FOR THIS PROCEDURAL REQUIREMENT:
- Confirm compliance in 1-2 sentences MAXIMUM
- Be extremely brief and direct
- Use simple confirmation language: "[COMPANY NAME] confirms...", "[COMPANY NAME] acknowledges...", "The Respondent will comply..."
- Do NOT over-explain or add unnecessary detail

CRITICAL: NEVER wrap your response in quotation marks (""). Output the response text directly.

GOOD EXAMPLE: [COMPANY NAME] confirms that this RFP response will be submitted by email no later than 12:00pm on Friday 14 February 2020, in accordance with the RFP instructions.

BAD EXAMPLE (too long, email-style): Dear Sir/Madam, We are pleased to confirm that we have received your RFP and will ensure submission by the deadline...`,

  DECLARATIVE: `${DRAFT_PROMPT_BASE}

FOR THIS DECLARATIVE REQUIREMENT:
- State compliance position clearly in 2-3 sentences
- Include brief supporting statement if needed
- Use clear compliance language: "[COMPANY NAME] complies with...", "[COMPANY NAME] confirms that...", "The Respondent maintains..."
- Reference any relevant certifications or policies briefly

CRITICAL: NEVER wrap your response in quotation marks (""). Output the response text directly.

GOOD EXAMPLE: [COMPANY NAME] confirms that all information requested in this RFP has been supplied. Each section of the response directly addresses the corresponding requirements and questions outlined in the RFP document.

BAD EXAMPLE: Starting with greetings or including unnecessary preamble about being "pleased to confirm"`,

  DESCRIPTIVE: `${DRAFT_PROMPT_BASE}

FOR THIS DESCRIPTIVE REQUIREMENT:

FORMATTING RULES:
- ALWAYS use bullet points (•) when the requirement asks multiple questions or lists items
- Mirror the requirement's terminology VERBATIM (if they say "mobile optimisations", use that exact term)
- DO NOT miss any items from the list - address EVERY item mentioned in the requirement
- Aim for 150-250 words

CRITICAL - INDICATIVE BULLET POINTS:
Each bullet point MUST start with an action verb in brackets to indicate what the user needs to provide:
- For "how" questions → Start with "[EXPLAIN how..."
- For capability questions → Start with "[DESCRIBE your..."
- For metrics/data questions → Start with "[PROVIDE your..."
- For process questions → Start with "[OUTLINE your..."

HANDLING EXAMPLES IN REQUIREMENTS:
- When examples are given (e.g., "such as", "e.g.", "for example"), treat them as EXAMPLES only
- Use placeholder language for examples the user must customize
- Do NOT claim to support specific examples as firm commitments

STRUCTURE FOR QUESTION-BASED REQUIREMENTS:
[COMPANY NAME]'s [AREA] includes:

• [EXPLAIN how your process for X works]
• [DESCRIBE your success metrics for Y]
• [PROVIDE your typical timeframe for Z]
• [OUTLINE your approach to handling A]

[One sentence with soft qualification if claims could vary]

STRUCTURE FOR LIST-BASED REQUIREMENTS:
[COMPANY NAME] supports the following [CAPABILITY AREA]:

• [Item 1 from requirement - exact wording]
• [Item 2 from requirement - exact wording]
• [Item 3 from requirement - exact wording]
[continue for ALL items]

[One sentence about optional/emerging items if mentioned, with soft qualification]

SOFT QUALIFICATION RULE:
If claims could vary by region/configuration/license tier, add ONE sentence:
"[Specific capability] availability may vary by region and configuration."

BANNED PHRASES - NEVER USE:
- "We are pleased to..."
- "Additionally..."
- "Furthermore..."
- "Aligning with the requirements..."
- "In accordance with..."
- "Our platform covers..." (too casual)
- "confirms comprehensive capability" (fluffy opener)
- "confirms a comprehensive capability" (fluffy opener)
- "confirms capability" (fluffy opener)
- Any email-style language

EXAMPLE INPUT:
"Can you explain how you warm new IP addresses, how successfully you do this, your average time frame for this plan, and if/how you're able to navigate the transition period?"

CRITICAL: NEVER wrap your response in quotation marks (""). Output the response text directly.

EXAMPLE OUTPUT:
[COMPANY NAME]'s IP warming and transition management includes:

• [EXPLAIN how your IP warming process works, including warm-up methodology]
• [DESCRIBE your success rate and metrics for IP warming campaigns]
• [PROVIDE your average timeframe for completing an IP warming plan]
• [OUTLINE your approach to managing a transition period with provider overlap]

Actual timeframes may vary based on volume, sending frequency, and recipient engagement levels.`,

  EVIDENCE_BASED: `${DRAFT_PROMPT_BASE}

FOR THIS EVIDENCE-BASED REQUIREMENT:

DETERMINE THE TYPE:
1. SAMPLE/ATTACHMENT REQUEST - asks for: sample, copy, example, document, file
2. CERTIFICATION REQUEST - asks for: certificate, certification, proof, references

FOR SAMPLE/ATTACHMENT REQUESTS:
- Start with: [ATTACH requested sample/document as Appendix X or upload as separate document]
- Follow with 1 sentence confirming the attachment
- Keep to 2 sentences MAXIMUM
- Do NOT add narrative or explain capabilities

EXAMPLE (sample):
[ATTACH sample monthly account analysis report as Appendix X]
A sample report has been included as a separate attachment.

FOR CERTIFICATION REQUESTS:
- Reference documents: "Please refer to Appendix [X]"
- List certifications with dates/numbers
- Keep to 3-5 sentences

EXAMPLE (certification):
[COMPANY NAME] provides the following evidence:
- [Certification Name], Certificate #[NUMBER], valid until [DATE]
- [Document Name] - attached as Appendix [X]

CRITICAL: NEVER wrap response in quotation marks. For samples, be CONCISE.`,

  QUANTITATIVE: `${DRAFT_PROMPT_BASE}

FOR THIS QUANTITATIVE REQUIREMENT:

FIRST, DETERMINE THE TYPE:
1. SIMPLE YES/NO QUESTION - asks if pricing/budget meets a threshold (e.g., "Does your total come in under £X?")
2. DETAILED BREAKDOWN REQUEST - asks for itemized pricing, metrics, or numerical data

FOR SIMPLE YES/NO QUESTIONS:
- Provide a direct confirmation in 2-3 sentences
- State the compliance position clearly
- Do NOT create tables or elaborate pricing breakdowns
- Add a placeholder for the actual figure if needed

EXAMPLE (simple yes/no):
[COMPANY NAME] confirms that the proposed three-year total, inclusive of VAT, falls within the stated budget of £150,000. The total contract value is £[CONFIRM FIGURE WITH FINANCE TEAM], which includes the initial two-year contract and the additional extension year.

FOR DETAILED BREAKDOWN REQUESTS:
- Use clear prose with bullet points, NOT markdown tables
- Never use | or - characters to create tables (these look unprofessional)
- Present pricing as a simple itemized list
- Include assumptions as a separate paragraph
- Flag items requiring finance/pricing team review

EXAMPLE (detailed breakdown):
[COMPANY NAME] proposes the following pricing structure:

• Initial two-year contract: £[AMOUNT]
• Extension year (Year 3): £[AMOUNT]
• Total three-year cost (inclusive of VAT): £[AMOUNT]

These figures are based on the following assumptions:
• [ASSUMPTION 1]
• [ASSUMPTION 2]

[CONFIRM all figures with finance team before submission]

CRITICAL: NEVER use markdown table syntax (| or ---). NEVER wrap response in quotation marks.`,

  REFERENCE_BASED: `${DRAFT_PROMPT_BASE}

FOR THIS REFERENCE REQUIREMENT:
- Use structured format for each reference
- Include: Client name, project scope, dates, relevance, contact info
- Keep descriptions concise but specific
- Note that contacts should be confirmed before submission

EXAMPLE FORMAT:
[COMPANY NAME] provides the following references:

**Reference 1: [CLIENT NAME]**
- Project: [TITLE]
- Scope: [BRIEF DESCRIPTION]
- Period: [DATES]
- Relevance: [HOW THIS RELATES]
- Contact: [NAME], [TITLE], [EMAIL/PHONE]

[CONFIRM all references are willing to be contacted]

CRITICAL: NEVER wrap response in quotation marks.`,

  STAFFING: `${DRAFT_PROMPT_BASE}

FOR THIS STAFFING REQUIREMENT:

FIRST, DETERMINE THE TYPE:

1. CONTACT INFORMATION REQUEST - requirement says "submit", "shall submit", "provide", or "must provide"
   followed by a specific list of contact details (name, address, email, telephone, phone, contact)

2. TEAM/PERSONNEL DESCRIPTION - requirement asks to "describe", "explain", "detail", or "outline"
   team structure, qualifications, experience, or personnel

==============================================================================
FOR CONTACT INFORMATION REQUESTS (Type 1):
==============================================================================
Generate ONLY the requested fields as simple placeholders. NO preamble, NO narrative.

RULES:
- Do NOT start with "[COMPANY NAME] proposes..." or any introduction
- Do NOT add unrequested fields (no qualifications, experience, availability, certifications)
- ONLY include fields explicitly requested + Job Title (always appropriate for contacts)
- Format as a simple list with placeholders

EXAMPLE - If requirement asks for "name, address, email, telephone":

Name: [FULL NAME]
Job Title: [JOB TITLE]
Address: [ADDRESS]
Email: [EMAIL]
Telephone: [PHONE NUMBER]

That's it. Nothing else.

==============================================================================
FOR TEAM/PERSONNEL DESCRIPTIONS (Type 2):
==============================================================================
Provide structured team information with context.

- Use "[COMPANY NAME] proposes the following team:" as opener
- List key personnel with roles
- Include qualifications and experience only if explicitly requested
- Do NOT include "availability" percentages or "dedication" levels (overselling)
- Do NOT include backup/succession plans unless requested

EXAMPLE FORMAT:
[COMPANY NAME] proposes the following team:

[ROLE]: [NAME]
• Qualifications: [DEGREES, CERTIFICATIONS]
• Experience: [X years in DOMAIN]
• Responsibilities: [SPECIFIC RESPONSIBILITIES]

[ATTACH resumes as Appendix X if CVs/resumes are requested]

CRITICAL: NEVER wrap response in quotation marks.
CRITICAL: For contact info requests, keep it minimal - just the fields, no fluff.`,
};

// =============================================================================
// TYPES
// =============================================================================
export interface ExtractedRequirement {
  text: string;
  isMandatory: boolean;
  section: string | null;        // Specific subsection: "A.1.2"
  sectionGroup: string | null;   // Parent section with title: "A: REQUIRED BANKING SERVICES"
  type: RequirementType;
  domainContext: DomainContext;
  wordLimit: number | null;
  characterLimit: number | null;
  isAttestation: boolean;
}

export interface ExtractionResult {
  deadline: string | null;       // ISO 8601 date string
  deadlineText: string | null;   // Original text from RFP
  requirements: ExtractedRequirement[];
  warnings?: {
    wasTruncated?: boolean;
    missingSections?: string[];
  };
}

// =============================================================================
// POST-PROCESSING: SECTION DATA ENRICHMENT
// =============================================================================

/**
 * Extract the major category from a section reference.
 *
 * SIMPLE RULE: If it starts with a SINGLE letter followed by a NON-letter, extract that letter.
 * Otherwise, return the whole string (it's a full title like "MANDATORY REQUIREMENTS").
 *
 * Examples:
 *   "A.1.2" → "A" (letter + non-letter)
 *   "A: TITLE" → "A" (letter + non-letter)
 *   "A15" → "A" (letter + non-letter digit)
 *   "3.4.1" → "3" (number + non-letter)
 *   "III.2" → "III" (Roman numeral)
 *   "MANDATORY REQUIREMENTS" → "MANDATORY REQUIREMENTS" (letter + letter = full title)
 */
function extractMajorCategory(section: string): string {
  const trimmed = section.trim();
  if (!trimmed) return trimmed;

  const firstChar = trimmed[0];
  const secondChar = trimmed[1] || '';

  // 1. Starts with digit → extract leading number
  if (/\d/.test(firstChar)) {
    const numMatch = trimmed.match(/^(\d+)/);
    return numMatch ? numMatch[1] : trimmed;
  }

  // 2. Starts with letter
  if (/[A-Z]/i.test(firstChar)) {
    // If second char is NOT a letter, it's a single-letter section
    // Matches: "A:", "A.", "A-", "A1", "A ", or just "A"
    if (!/[A-Z]/i.test(secondChar)) {
      return firstChar.toUpperCase();
    }

    // Second char IS a letter - check for Roman numerals (I, II, III, IV, V, etc.)
    const romanMatch = trimmed.match(/^([IVX]+)(?:[^A-Z]|$)/i);
    if (romanMatch) {
      return romanMatch[1].toUpperCase();
    }

    // Not a single letter, not a Roman numeral
    // It's a full title like "MANDATORY REQUIREMENTS" - return as-is
    return trimmed;
  }

  return trimmed;
}

/**
 * Post-process to enrich sectionGroup with titles from document structure.
 * If LLM didn't provide a sectionGroup or it lacks a title, derive it from the document.
 */
function enrichSectionData(requirements: ExtractedRequirement[], documentText: string): void {
  // Build a map of major section numbers to their titles from document headings
  const sectionTitleMap = new Map<string, string>();

  // DEBUG: Log that enrichSectionData is being called
  console.log("[enrichSectionData] Starting section enrichment...");

  // ===========================================================================
  // MULTI-PATTERN HEADING EXTRACTION
  // We try multiple patterns to handle different document formats:
  // 1. Markdown format from DOCX parser: "# A: REQUIRED BANKING SERVICES"
  // 2. Plain text format from PDF parser: "A. REQUIRED BANKING SERVICES" or "A: REQUIRED BANKING"
  // 3. All-caps section headers: "SECTION A: REQUIRED BANKING SERVICES"
  // 4. Numbered sections: "1. Introduction" or "1: INTRODUCTION"
  // ===========================================================================

  const headingPatterns = [
    // Pattern 1: Markdown headings (from DOCX parser)
    // Matches: "# A: REQUIRED BANKING", "## 3: Technical Requirements"
    /#+\s*([A-Z]|[IVXLC]+|\d+)[.:\)]*\s*[:\-.\s]\s*([A-Z][A-Za-z\s,&\-]+)/gi,

    // Pattern 2: Plain text section headers with colon separator
    // Matches: "A: REQUIRED BANKING SERVICES", "3: Technical Requirements"
    // Must be at start of line (^) or after newline
    /(?:^|\n)\s*([A-Z]|[IVXLC]+|\d+)[.:\)]*\s*:\s*([A-Z][A-Za-z\s,&\-]{3,})/gi,

    // Pattern 3: Plain text section headers with period separator
    // Matches: "A. REQUIRED BANKING SERVICES", "3. Technical Requirements"
    /(?:^|\n)\s*([A-Z]|[IVXLC]+|\d+)\.\s+([A-Z][A-Za-z\s,&\-]{3,})/gi,

    // Pattern 4: "SECTION X:" format
    // Matches: "SECTION A: REQUIRED BANKING", "Section 3: Requirements"
    /(?:^|\n)\s*SECTION\s+([A-Z]|\d+)[.:\)]*\s*[:\-.\s]\s*([A-Z][A-Za-z\s,&\-]+)/gi,

    // Pattern 5: Parenthetical section markers
    // Matches: "(A) REQUIRED BANKING SERVICES"
    /(?:^|\n)\s*\(([A-Z]|\d+)\)\s+([A-Z][A-Za-z\s,&\-]{3,})/gi,

    // Pattern 6: All-caps title following section number (common in RFPs)
    // Matches: "A  REQUIRED BANKING SERVICES" (multiple spaces after letter)
    /(?:^|\n)\s*([A-Z])\s{2,}([A-Z][A-Z\s,&\-]{5,})/g,
  ];

  // Try each pattern and collect all matches
  for (const pattern of headingPatterns) {
    for (const match of documentText.matchAll(pattern)) {
      const num = match[1].toUpperCase();
      const title = match[2].trim();
      // Only add if we found a valid title and haven't already found one for this section
      if (title.length > 2 && !sectionTitleMap.has(num)) {
        sectionTitleMap.set(num, title);
        console.log(`[enrichSectionData] Found section title: ${num} -> "${title}"`);
      }
    }
  }

  // DEBUG: Log total section titles found
  console.log(`[enrichSectionData] Found ${sectionTitleMap.size} section titles in document`);
  if (sectionTitleMap.size > 0) {
    console.log("[enrichSectionData] Section title map:", Object.fromEntries(sectionTitleMap));
  }

  // Enrich each requirement's sectionGroup
  for (const req of requirements) {
    // Skip if no section reference at all
    if (!req.section && !req.sectionGroup) continue;

    // Extract major category from section (A.1.2 → A)
    const majorCategory = req.section
      ? extractMajorCategory(req.section)
      : (req.sectionGroup ? extractMajorCategory(req.sectionGroup) : null);

    if (!majorCategory) continue;

    // Check if sectionGroup needs enrichment:
    // - Missing entirely
    // - Just a letter/number (no title): "A", "3", "IV"
    // - A subsection reference (should be parent section): "A15", "A.1.2", "3.4"
    // - sectionGroup looks like a specific reference instead of parent section with title
    const sectionGroupTrimmed = (req.sectionGroup || '').trim();
    const needsEnrichment =
      !req.sectionGroup ||
      /^([A-Z]|\d+|[IVXLC]+)[.:\)\s]*$/i.test(sectionGroupTrimmed) || // Just a number/letter: "A", "3"
      /^[A-Z]\d+$/i.test(sectionGroupTrimmed) || // Letter+number like "A15"
      /^[A-Z][.\-]\d/i.test(sectionGroupTrimmed) || // Subsection like "A.1" or "A-1"
      /^\d+\.\d/i.test(sectionGroupTrimmed) || // Numeric subsection like "3.4"
      // NEW: sectionGroup equals section (LLM didn't differentiate)
      (req.section && req.sectionGroup === req.section) ||
      // NEW: sectionGroup doesn't contain a colon (missing the ": TITLE" part)
      (!sectionGroupTrimmed.includes(':') && sectionGroupTrimmed.length < 20);

    // DEBUG: Log enrichment check for first few requirements
    if (requirements.indexOf(req) < 3) {
      console.log(`[enrichSectionData] Requirement section="${req.section}" sectionGroup="${req.sectionGroup}" majorCategory="${majorCategory}" needsEnrichment=${needsEnrichment}`);
    }

    if (needsEnrichment) {
      const title = sectionTitleMap.get(majorCategory.toUpperCase());
      if (title) {
        const oldValue = req.sectionGroup;
        req.sectionGroup = `${majorCategory}: ${title}`;
        console.log(`[enrichSectionData] Enriched: "${oldValue}" -> "${req.sectionGroup}"`);
      } else if (!req.sectionGroup || !req.sectionGroup.includes(':')) {
        // No title found, at least set the major category
        req.sectionGroup = majorCategory;
      }
    }
  }
}

// =============================================================================
// POST-EXTRACTION: SPLIT CONCATENATED REQUIREMENTS
// =============================================================================

/**
 * Post-process extracted requirements to split any that were incorrectly concatenated.
 * The LLM sometimes groups multiple numbered requirements (3.1.1, 3.1.2, etc.) into one.
 * This function detects and splits them.
 */
function splitConcatenatedRequirementsPostProcess(
  requirements: ExtractedRequirement[]
): ExtractedRequirement[] {
  const result: ExtractedRequirement[] = [];
  let splitCount = 0;

  for (const req of requirements) {
    // Check for multiple requirement numbers in the text
    const detectedNumbers = detectConcatenatedRequirements(req.text);

    // If 2+ requirement numbers found, this needs splitting
    if (detectedNumbers.length >= 2) {
      console.log(`[splitConcatenatedRequirements] Detected ${detectedNumbers.length} concatenated requirements in section ${req.section}:`, detectedNumbers);

      const splitParts = splitConcatenatedRequirement(req.text);

      for (const part of splitParts) {
        // Skip empty parts
        if (!part.text.trim()) continue;

        // Check if this part is actually a section header (not a requirement)
        if (isSectionHeader(part.text)) {
          result.push({
            ...req,
            text: part.text,
            section: part.section || req.section,
            type: "CONTEXTUAL", // Section headers are contextual
          });
        } else {
          result.push({
            ...req,
            text: formatListInRequirement(part.text), // Preserve list formatting
            section: part.section || req.section,
            // Re-detect type based on the actual requirement text
            type: validateRequirementType(req.type),
          });
        }
        splitCount++;
      }
    } else {
      // No concatenation detected, but still format lists
      result.push({
        ...req,
        text: formatListInRequirement(req.text),
      });
    }
  }

  if (splitCount > 0) {
    console.log(`[splitConcatenatedRequirements] Split ${splitCount} concatenated requirements. Total requirements: ${result.length}`);
  }

  return result;
}

/**
 * Detect and classify section headers that the LLM might have missed marking as CONTEXTUAL.
 * Subsection titles (e.g., "3.1 Design, Form, and Templates") should be CONTEXTUAL, not DESCRIPTIVE.
 */
function reclassifySectionHeaders(requirements: ExtractedRequirement[]): void {
  for (const req of requirements) {
    // Skip if already CONTEXTUAL
    if (req.type === "CONTEXTUAL") continue;

    // Check if this looks like a section header
    if (isSectionHeader(req.text)) {
      console.log(`[reclassifySectionHeaders] Reclassifying "${req.text.substring(0, 50)}..." from ${req.type} to CONTEXTUAL`);
      req.type = "CONTEXTUAL";
    }
  }
}

/**
 * Validate that extraction captured all sections present in the document.
 * Compares section numbers found in document text vs extracted requirements.
 */
function validateExtractedSections(
  documentText: string,
  extractedRequirements: ExtractedRequirement[]
): { missingCount: number; missingSections: string[] } {
  const documentSections = detectAllSectionNumbers(documentText);
  const extractedSections = new Set(
    extractedRequirements
      .map(r => r.section)
      .filter((s): s is string => s !== null && s !== undefined)
  );

  const missingSections: string[] = [];

  for (const section of documentSections) {
    // Check if this section or a child of it was extracted
    // e.g., if we have "3.1.1", we don't need "3.1" separately
    const found = [...extractedSections].some(s =>
      s === section || s.startsWith(section + ".") || section.startsWith(s + ".")
    );
    if (!found) {
      missingSections.push(section);
    }
  }

  // Sort for consistent output
  missingSections.sort((a, b) => {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const diff = (aParts[i] || 0) - (bParts[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  return {
    missingCount: missingSections.length,
    missingSections: missingSections.slice(0, 20), // Limit for logging
  };
}

// =============================================================================
// SECTION-BASED EXTRACTION (for large documents)
// =============================================================================

/**
 * Calculate Jaccard similarity between two strings (word-based)
 * Used for deduplication of requirements at section boundaries
 */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return intersection / union;
}

/**
 * Extract requirements from a single document chunk.
 * Uses the FULL EXTRACTION_PROMPT for accurate type classification.
 *
 * KEY DESIGN DECISION: We use the complete prompt instead of a condensed version
 * because the detailed examples and edge cases are essential for accurate classification.
 * The slight increase in tokens is worth the dramatic improvement in classification accuracy.
 */
async function extractSectionRequirements(
  chunk: SectionChunk
): Promise<ExtractedRequirement[]> {
  const startTime = Date.now();

  console.log(`[extractSection] START chunk ${chunk.sectionNumber}: ${chunk.sectionTitle} (${chunk.content.length} chars)`);

  try {
    // Use the FULL EXTRACTION_PROMPT - the condensed version caused massive type misclassification
    const response = await withRetry(
      () => openai.chat.completions.create({
        model: MODELS.EXTRACTION,
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            // Simple instruction - let the LLM preserve section numbers as-is
            content: `Please extract all requirements and questions from this document section:\n\n${chunk.content}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 16000,
      }),
      { timeout: 120000 } // 2 minutes per section
    );

    const elapsed = Date.now() - startTime;
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error(`[extractSection] No response for chunk ${chunk.sectionNumber} after ${elapsed}ms`);
      return [];
    }

    const parsed = JSON.parse(content);
    const requirements = Array.isArray(parsed.requirements) ? parsed.requirements : [];

    // NO section number "correction" - the LLM extracts what's in the document
    // Previous correction logic was CAUSING the X.Y.Z → Y.Z bug

    console.log(`[extractSection] DONE chunk ${chunk.sectionNumber}: ${requirements.length} requirements in ${elapsed}ms`);
    return requirements;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[extractSection] FAILED chunk ${chunk.sectionNumber} after ${elapsed}ms:`, error instanceof Error ? error.message : error);
    return []; // Return empty array to continue with other sections
  }
}

/**
 * Merge and deduplicate requirements from multiple section extractions
 */
function mergeExtractionResults(
  sectionResults: ExtractedRequirement[][],
  originalText: string
): ExtractionResult {
  const allRequirements: ExtractedRequirement[] = [];

  // Flatten all section results
  for (const sectionReqs of sectionResults) {
    allRequirements.push(...sectionReqs);
  }

  console.log(`[mergeResults] Total requirements before dedup: ${allRequirements.length}`);

  // Deduplicate based on Jaccard similarity (catches near-duplicates at section boundaries)
  const dedupedRequirements: ExtractedRequirement[] = [];
  const SIMILARITY_THRESHOLD = 0.9;

  for (const req of allRequirements) {
    const isDuplicate = dedupedRequirements.some(
      existing => jaccardSimilarity(existing.text, req.text) > SIMILARITY_THRESHOLD
    );

    if (!isDuplicate) {
      dedupedRequirements.push(req);
    }
  }

  console.log(`[mergeResults] After dedup: ${dedupedRequirements.length} requirements`);

  // Sort by section number
  dedupedRequirements.sort((a, b) => {
    const sectionA = a.section || "";
    const sectionB = b.section || "";

    // Parse section numbers for proper numeric sorting (3.1.1 < 3.1.2 < 3.2.1)
    const partsA = sectionA.split(".").map(Number);
    const partsB = sectionB.split(".").map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const diff = (partsA[i] || 0) - (partsB[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  // Process and validate each requirement (same as single-pass extraction)
  const processedRequirements = dedupedRequirements.map((req) => ({
    ...req,
    section: req.section || null,
    sectionGroup: req.sectionGroup || null,
    type: correctQuantitativeType(req.text, validateRequirementType(req.type)),
    domainContext: detectDomainContext(req.text),
    wordLimit: typeof req.wordLimit === "number" ? req.wordLimit : null,
    characterLimit: typeof req.characterLimit === "number" ? req.characterLimit : null,
    isAttestation: req.isAttestation === true,
  }));

  // Extract deadline from original text (simple heuristic)
  const deadlineMatch = originalText.match(
    /(?:deadline|submission date|due date|closing date)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
  );

  return {
    deadline: deadlineMatch ? deadlineMatch[1] : null,
    deadlineText: deadlineMatch ? deadlineMatch[0] : null,
    requirements: processedRequirements,
  };
}

/**
 * Extract requirements using parallel section-based processing
 * Used for large documents that would exceed output token limits
 */
async function extractRequirementsChunked(
  sanitizedText: string,
  chunks: SectionChunk[]
): Promise<ExtractionResult> {
  console.log(`[extractChunked] Processing ${chunks.length} sections in parallel (max 3 concurrent)`);
  const startTime = Date.now();

  // Process sections with concurrency limit of 3 to avoid rate limits
  const CONCURRENCY_LIMIT = 3;
  const results: ExtractedRequirement[][] = [];

  for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
    const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
    console.log(`[extractChunked] Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(chunks.length / CONCURRENCY_LIMIT)}`);

    const batchResults = await Promise.all(
      batch.map(chunk => extractSectionRequirements(chunk))
    );

    results.push(...batchResults);
  }

  console.log(`[extractChunked] All sections processed in ${Date.now() - startTime}ms`);

  // Merge and deduplicate results
  const mergedResult = mergeExtractionResults(results, sanitizedText);

  // Run post-processing (same as single-pass)
  try {
    mergedResult.requirements = splitConcatenatedRequirementsPostProcess(mergedResult.requirements);
    reclassifySectionHeaders(mergedResult.requirements);
    enrichSectionData(mergedResult.requirements, sanitizedText);
  } catch (postProcessError) {
    console.error("[extractChunked] Post-processing failed:", postProcessError);
  }

  return mergedResult;
}

// =============================================================================
// EXTRACTION FUNCTION
// =============================================================================

export async function extractRequirements(documentText: string): Promise<ExtractionResult> {
  const timings: Record<string, number> = {};
  const startTotal = Date.now();

  // Step 1: Sanitize input to prevent prompt injection
  console.log("[extractRequirements] Step 1: Sanitizing input...");
  const startSanitize = Date.now();
  const sanitizedText = sanitizeForLLM(documentText);
  timings.sanitize = Date.now() - startSanitize;
  console.log(`[extractRequirements] Sanitization complete in ${timings.sanitize}ms`);

  // Truncate if too long - increased limit to handle larger documents
  // gpt-4o-mini supports 128k tokens (~400-500k characters), so 250k is safe
  const maxLength = 250000;
  const wasTruncated = sanitizedText.length > maxLength;
  const truncatedText = wasTruncated
    ? sanitizedText.substring(0, maxLength) + "\n\n[Document truncated due to length - some sections may be missing]"
    : sanitizedText;

  // Log truncation warning for debugging
  if (wasTruncated) {
    console.warn("[extractRequirements] Document truncated:", {
      originalLength: sanitizedText.length,
      truncatedLength: maxLength,
      charactersLost: sanitizedText.length - maxLength,
      percentageLost: ((sanitizedText.length - maxLength) / sanitizedText.length * 100).toFixed(1) + "%",
    });
  }

  // Step 2: Check cache first (saves API costs for duplicate uploads)
  console.log("[extractRequirements] Step 2: Checking cache...");
  const contentHash = getContentHash(truncatedText);
  const cachedResult = getCachedExtraction(contentHash);
  if (cachedResult) {
    console.log("[extractRequirements] Cache hit, returning cached result");
    return cachedResult;
  }
  console.log("[extractRequirements] Cache miss, proceeding with extraction");

  // Step 3: Determine extraction strategy (chunked vs single-pass)
  console.log("[extractRequirements] Step 3: Analyzing document structure...");
  const chunkResult = chunkDocumentBySections(truncatedText);
  console.log(`[extractRequirements] Document type: ${chunkResult.documentType}, chunks: ${chunkResult.chunks.length}, estimated tokens: ${chunkResult.estimatedTokens}`);

  // Large documents with detected sections: use chunked extraction
  if (chunkResult.wasChunked && chunkResult.chunks.length >= 2) {
    console.log("[extractRequirements] Using CHUNKED extraction for large document");
    const startChunked = Date.now();
    const result = await extractRequirementsChunked(truncatedText, chunkResult.chunks);
    timings.extraction = Date.now() - startChunked;
    timings.total = Date.now() - startTotal;

    console.log("[extractRequirements] Chunked extraction complete:", {
      timings,
      totalRequirements: result.requirements.length,
      byType: result.requirements.reduce((acc, req) => {
        acc[req.type] = (acc[req.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });

    // Validate and warn about missing sections
    const validation = validateExtractedSections(truncatedText, result.requirements);
    if (validation.missingCount > 0) {
      console.warn("[extractRequirements] Missing sections after chunked extraction:", validation.missingSections);
      result.warnings = { ...result.warnings, missingSections: validation.missingSections };
    }

    // Cache the result
    setCachedExtraction(contentHash, result);
    return result;
  }

  // Small documents or failed section detection: use single-pass extraction
  console.log("[extractRequirements] Using SINGLE-PASS extraction");
  console.log("[extractRequirements] Step 4: Calling OpenAI API...");
  const startOpenAI = Date.now();
  const response = await withRetry(
    () => openai.chat.completions.create({
      model: MODELS.EXTRACTION,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: `Please extract all requirements and questions from this RFP document:\n\n${truncatedText}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 16000, // Ensure full extraction output
    }),
    { timeout: 120000 } // 2 minutes for extraction
  );
  timings.openai = Date.now() - startOpenAI;
  console.log(`[extractRequirements] OpenAI call complete in ${timings.openai}ms`);

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }
  console.log(`[extractRequirements] Response content length: ${content.length} chars`);

  // Step 4: Parse and validate response
  console.log("[extractRequirements] Step 4: Parsing response...");
  const startParse = Date.now();
  try {
    const parsed = JSON.parse(content);

    // Validate response structure
    if (!parsed || typeof parsed !== 'object') {
      console.error("OpenAI returned invalid response structure:", {
        contentType: typeof parsed,
        contentPreview: content.substring(0, 500),
      });
      throw new Error("Invalid response structure from OpenAI");
    }

    if (!Array.isArray(parsed.requirements)) {
      console.error("OpenAI response missing requirements array:", {
        hasRequirements: 'requirements' in parsed,
        requirementsType: typeof parsed.requirements,
        keys: Object.keys(parsed),
      });
      throw new Error("OpenAI response missing requirements array");
    }

    // Log if requirements array is empty (for debugging intermittent failures)
    if (parsed.requirements.length === 0) {
      console.warn("OpenAI returned empty requirements array:", {
        deadline: parsed.deadline,
        deadlineText: parsed.deadlineText,
        responseKeys: Object.keys(parsed),
        contentLength: content.length,
        contentPreview: content.substring(0, 1000),
      });
    }

    // Build the result with deadline and requirements
    const result: ExtractionResult = {
      deadline: parsed.deadline || null,
      deadlineText: parsed.deadlineText || null,
      requirements: parsed.requirements.map((req: ExtractedRequirement) => ({
        ...req,
        section: req.section || null,
        sectionGroup: req.sectionGroup || null,
        // Validate type, then apply heuristic correction for DESCRIPTIVE→QUANTITATIVE
        type: correctQuantitativeType(req.text, validateRequirementType(req.type)),
        // Always use heuristic detection for domain context (more reliable than LLM)
        domainContext: detectDomainContext(req.text),
        wordLimit: typeof req.wordLimit === 'number' ? req.wordLimit : null,
        characterLimit: typeof req.characterLimit === 'number' ? req.characterLimit : null,
        isAttestation: req.isAttestation === true, // Default to false if not specified
      })),
    };
    timings.parse = Date.now() - startParse;
    console.log(`[extractRequirements] Parsed ${result.requirements.length} requirements in ${timings.parse}ms`);

    // Step 5: Post-processing - wrapped in try-catch to prevent failures
    console.log("[extractRequirements] Step 5: Post-processing...");
    const startPostProcess = Date.now();
    try {
      // Post-processing Step 1: Split any concatenated requirements
      // The LLM sometimes groups multiple numbered requirements (3.1.1, 3.1.2, etc.) into one
      result.requirements = splitConcatenatedRequirementsPostProcess(result.requirements);

      // Post-processing Step 2: Reclassify any section headers that weren't marked CONTEXTUAL
      reclassifySectionHeaders(result.requirements);

      // Post-processing Step 3: Enrich section data (fill in missing sectionGroup titles)
      enrichSectionData(result.requirements, documentText);
      timings.postProcess = Date.now() - startPostProcess;
      console.log(`[extractRequirements] Post-processing complete in ${timings.postProcess}ms`);
    } catch (postProcessError) {
      timings.postProcess = Date.now() - startPostProcess;
      console.error("[extractRequirements] Post-processing failed, using raw extraction results:", postProcessError);
      // Continue with unprocessed results rather than failing
    }

    // Step 6: Validate extraction completeness
    console.log("[extractRequirements] Step 6: Validating extraction completeness...");
    const validation = validateExtractedSections(documentText, result.requirements);
    if (validation.missingCount > 0) {
      console.warn("[extractRequirements] Missing sections detected:", {
        missingCount: validation.missingCount,
        missingSections: validation.missingSections,
      });
      result.warnings = {
        ...result.warnings,
        missingSections: validation.missingSections,
      };
    } else {
      console.log("[extractRequirements] All detected sections were extracted successfully");
    }

    // Log extraction stats and total timing
    timings.total = Date.now() - startTotal;
    console.log("[extractRequirements] Extraction complete:", {
      timings,
      totalRequirements: result.requirements.length,
      byType: result.requirements.reduce((acc, req) => {
        acc[req.type] = (acc[req.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      deadline: result.deadline,
    });

    // Cache the result for future duplicate uploads
    setCachedExtraction(contentHash, result);

    return result;
  } catch (error) {
    console.error("Failed to parse extraction response:", {
      error: error instanceof Error ? error.message : String(error),
      contentLength: content.length,
      contentPreview: content.substring(0, 500),
      contentEnd: content.substring(content.length - 200),
    });
    throw new Error("Failed to parse extraction response");
  }
}

// =============================================================================
// POST-PROCESSING: FLUFF REMOVAL
// =============================================================================
const FLUFF_PATTERNS: RegExp[] = [
  /\bIt is worth noting that\s*/gi,
  /\bIt should be noted that\s*/gi,
  /\bAs mentioned previously,?\s*/gi,
  /\bAs stated above,?\s*/gi,
  /\bMoving forward,?\s*/gi,
  /\bGoing forward,?\s*/gi,
  /\bAt the end of the day,?\s*/gi,
  /\bIn terms of\s*/gi,
  /\bWith respect to\s*/gi,
  /\bIn this regard,?\s*/gi,
  /\bFor your consideration,?\s*/gi,
  /\bPlease be advised that\s*/gi,
  /\bNeedless to say,?\s*/gi,
  /\bIt goes without saying that\s*/gi,
  /\bAs a matter of fact,?\s*/gi,
  /\bIn fact,?\s*/gi,
  /\bWe would like to take this opportunity to\s*/gi,
  /\bWe are confident that\s*/gi,
  /\bRest assured,?\s*/gi,
  /\bAdditionally,?\s*/gi,
  /\bFurthermore,?\s*/gi,
  /\bMoreover,?\s*/gi,
  /\bWe are pleased to\s*/gi,
  /\bIt is our pleasure to\s*/gi,
  /\bWe believe that\s*/gi,
  /\bWe feel that\s*/gi,
  /\bIt is important to note that\s*/gi,
  /\bIt is essential to\s*/gi,
  /\bIn conclusion,?\s*/gi,
  /\bTo summarize,?\s*/gi,
  // Fluffy capability confirmations
  /\bconfirms a? ?comprehensive capability in\s*/gi,
  /\bconfirms capability in\s*/gi,
  /\bconfirms full capability in\s*/gi,
  /\bResponse details:?\s*/gi,
  /\bTo conclude,?\s*/gi,
  /\bPlease do not hesitate to\s*/gi,
  /\bShould you have any questions,?\s*/gi,
  /\bWe are happy to\s*/gi,
  /\bWe are delighted to\s*/gi,
  /\bAligning with the requirements,?\s*/gi,
  /\bIn accordance with\s*/gi,
];

function removeFluff(draft: string): string {
  let result = draft;
  for (const pattern of FLUFF_PATTERNS) {
    result = result.replace(pattern, '');
  }
  // Clean up multiple horizontal spaces (preserve newlines)
  result = result.replace(/[^\S\n]+/g, ' ');
  result = result.replace(/^ +/gm, '');
  result = result.replace(/ +$/gm, '');
  // Remove excessive newlines (3+ becomes 2)
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

// =============================================================================
// POST-PROCESSING: ANTI-OVERCLAIMING GUARDRAILS
// =============================================================================
const OVERCLAIM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bwe guarantee\b/gi, "[COMPANY NAME] is committed to"],
  [/\bguarantees?\b/gi, "is designed to support"],
  [/\b100% uptime\b/gi, "high availability [CONFIRM SLA]"],
  [/\b100% secure\b/gi, "robust security measures"],
  [/\bindustry-leading\b/gi, "comprehensive"],
  [/\bbest-in-class\b/gi, "robust"],
  [/\bbest in class\b/gi, "robust"],
  [/\bunmatched\b/gi, "comprehensive"],
  [/\bunparalleled\b/gi, "extensive"],
  [/\bwe always\b/gi, "[COMPANY NAME] typically"],
  [/\bwe never\b/gi, "[COMPANY NAME] is designed to avoid"],
  [/\bfully compliant\b/gi, "designed to support compliance"],
  [/\bfully certified\b/gi, "[CONFIRM certification status]"],
  [/\bensures compliance\b/gi, "supports compliance efforts"],
  [/\bintegrates with\b/gi, "supports integration with"],
  [/\bprovides seamless\b/gi, "supports"],
  [/\bseamlessly\b/gi, ""],
  [/\beffortlessly\b/gi, ""],
  [/\bworld-class\b/gi, "comprehensive"],
  [/\bcutting-edge\b/gi, "modern"],
  [/\bstate-of-the-art\b/gi, "current"],
];

function applyGuardrails(draft: string): string {
  let result = draft;
  for (const [pattern, replacement] of OVERCLAIM_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  // Clean up multiple horizontal spaces (preserve newlines)
  result = result.replace(/[^\S\n]+/g, ' ');
  return result;
}

// =============================================================================
// POST-PROCESSING: FINAL NEWLINE NORMALIZER
// =============================================================================
// This is the single final normalizer - consolidates all newline handling
function normalizeNewlines(draft: string): string {
  let result = draft;

  // Ensure consistent blank line before bullet lists (when preceded by non-bullet text)
  result = result.replace(/([^\n•\-\*])[ \t]*\n?([•\-\*])/g, '$1\n\n$2');

  // Ensure consistent blank line after bullet lists before new paragraph (capital letter)
  result = result.replace(/([•\-\*][^\n]+)\n([A-Z])/g, '$1\n\n$2');

  // Collapse 3+ newlines to exactly 2 (one blank line)
  result = result.replace(/\n{3,}/g, '\n\n');

  // Clean up any trailing whitespace on lines
  result = result.replace(/[ \t]+$/gm, '');

  return result.trim();
}

// =============================================================================
// POST-PROCESSING: REMOVE MARKDOWN TABLES
// =============================================================================
function removeMarkdownTables(draft: string): string {
  let result = draft;

  // Remove table header separator lines (|---|---|---)
  result = result.replace(/^\|[-:\s|]+\|$/gm, '');

  // Convert table rows to bullet points
  // Match lines that start and end with | and have content between
  result = result.replace(/^\|(.+)\|$/gm, (match, content) => {
    // Split by | and filter empty cells
    const cells = content.split('|').map((c: string) => c.trim()).filter((c: string) => c);
    if (cells.length === 0) return '';
    // Convert to bullet point with key-value pairs
    if (cells.length === 1) return `• ${cells[0]}`;
    if (cells.length === 2) return `• ${cells[0]}: ${cells[1]}`;
    return `• ${cells.join(' - ')}`;
  });

  // Clean up any stray | characters at line starts/ends
  result = result.replace(/^\s*\|\s*/gm, '');
  result = result.replace(/\s*\|\s*$/gm, '');

  // Clean up excessive newlines left by removed table separators
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

// =============================================================================
// DRAFT GENERATION FUNCTION
// =============================================================================
export interface GenerateDraftResult {
  draft: string;
  requiresReview: boolean;
}

export async function generateDraft(
  requirement: string,
  requirementType: RequirementType = "DECLARATIVE",
  domainContext: DomainContext = "FEATURE",
  context?: string
): Promise<GenerateDraftResult> {
  // Check for template match first (saves AI costs)
  const template = matchTemplate(requirement);
  if (template) {
    // Template already includes [DRAFT] tag
    return {
      draft: template.response,
      requiresReview: domainContext === "LEGAL",
    };
  }

  const tokenLimits = TOKEN_LIMITS[requirementType];
  const basePrompt = DRAFT_PROMPTS[requirementType];
  const domainModifier = getDomainPromptModifier(domainContext);

  // Combine Layer 1 (type) and Layer 2 (domain) prompts
  const systemPrompt = `${basePrompt}\n\n${domainModifier}`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  if (context) {
    messages.push({
      role: "user",
      content: `Here is some context from previous responses that may be relevant:\n\n${context}`,
    });
  }

  messages.push({
    role: "user",
    content: `Generate a draft response for this RFP requirement:\n\n"${requirement}"\n\nREMEMBER: Do NOT repeat this requirement text in your response. Do NOT write an email. Be concise and direct.`,
  });

  // OpenAI call with retry logic and timeout
  const response = await withRetry(
    () => openai.chat.completions.create({
      model: MODELS.DRAFTING,
      messages,
      temperature: 0.7,
      max_tokens: tokenLimits.max * 2, // Allow buffer, prompts guide actual length
    }),
    { timeout: 60000 } // 1 minute for drafting
  );

  let content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  // Post-processing: Remove fluff phrases, apply guardrails, clean formatting
  content = removeFluff(content);
  content = applyGuardrails(content);
  content = applyDomainRules(content, domainContext);
  content = removeMarkdownTables(content);
  // Final normalizer - consolidates all newline handling
  content = normalizeNewlines(content);

  // Add [DRAFT] tag with consistent spacing (single blank line before tag)
  return {
    draft: content + "\n\n[DRAFT]",
    requiresReview: DOMAIN_RULES[domainContext].requiresManualReview,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
function validateRequirementType(type: string): RequirementType {
  const validTypes: RequirementType[] = [
    "CONTEXTUAL",
    "PROCEDURAL",
    "DECLARATIVE",
    "DESCRIPTIVE",
    "EVIDENCE_BASED",
    "QUANTITATIVE",
    "REFERENCE_BASED",
    "STAFFING",
  ];
  if (validTypes.includes(type as RequirementType)) {
    return type as RequirementType;
  }
  return "DESCRIPTIVE"; // Default fallback - matches "when uncertain → DESCRIPTIVE" guidance
}

function validateDomainContext(domain: string | undefined): DomainContext | null {
  const validDomains: DomainContext[] = ["FEATURE", "PROCESS", "LEGAL"];
  if (domain && validDomains.includes(domain as DomainContext)) {
    return domain as DomainContext;
  }
  return null; // Will fallback to heuristic detection
}

/**
 * Heuristic correction: DESCRIPTIVE → QUANTITATIVE for actual financial/numeric requirements
 *
 * STRICT LOGIC: Only classify as QUANTITATIVE when:
 * 1. Strong financial indicators present (currency symbols, pricing keywords)
 * 2. NOT asking about approach/methodology (those remain DESCRIPTIVE)
 * 3. Explicitly asking for numbers/figures
 *
 * This prevents over-classification when generic terms like "amount", "rate" appear
 * in non-financial contexts.
 */
function correctQuantitativeType(text: string, llmType: RequirementType): RequirementType {
  // Only correct DESCRIPTIVE classifications
  if (llmType !== "DESCRIPTIVE") return llmType;

  const lowerText = text.toLowerCase();

  // STEP 1: Require STRICT financial indicators (not generic words)
  const strictFinancialIndicators = [
    /[£$€¥]/,                           // Currency symbols
    /\b\d+(\.\d+)?\s*%/,                // Percentage with number (e.g., "5%", "10.5%")
    /\bpric(e|es|ing)\b/,               // Price (word boundary required)
    /\bcost(s|ing)?\b/,                 // Cost
    /\bfee(s)?\b/,                      // Fee
    /\bbudget\b/,                       // Budget
    /\bquot(e|ation)\b/,                // Quote/quotation
    /\btariff\b/,                       // Tariff
    /\b(hourly|daily|annual)\s+rate\b/, // Specific rate types
  ];

  const hasFinancialIndicator = strictFinancialIndicators.some(p => p.test(lowerText));

  // If no financial context at all, keep DESCRIPTIVE
  if (!hasFinancialIndicator) {
    return llmType;
  }

  // STEP 2: Exclude process/approach questions (these are DESCRIPTIVE even with financial terms)
  const processPatterns = [
    /\bapproach\s+to\s+(pricing|cost|fee)/i,
    /\bdescribe\s+(your\s+)?approach\b/i,
    /\bexplain\s+(your\s+)?approach\b/i,
    /\bexplain\s+how\s+you\b/i,
    /\bmethodology\s+(for|of)\b/i,
    /\bstrategy\s+for\b/i,
    /\bhow\s+do\s+you\s+(handle|manage|approach)\b/i,
    /\bdescribe\s+your\s+.{0,30}(process|method|approach|strategy)/i,
  ];

  if (processPatterns.some(p => p.test(lowerText))) {
    return llmType; // Asking about process, not specific numbers
  }

  // STEP 3: Require explicit "asking for numbers" pattern
  const askingForNumbersPatterns = [
    /\bprovide\s+(your\s+)?(pricing|costs?|fees?|rates?)\b/i,
    /\bwhat\s+(is|are)\s+(your|the)\s+(price|cost|fee|rate)\b/i,
    /\blist\s+(your\s+)?(pricing|rates?|fees?|costs?)\b/i,
    /\btotal\s+(cost|price|amount|fee)\b/i,
    /\bquote\s+(for|your)\b/i,
    /\bprovide\s+a\s+(breakdown|schedule)\s+of\b/i,
    /\bstate\s+(your|the)\s+(price|cost|fee|rate)\b/i,
  ];

  if (askingForNumbersPatterns.some(p => p.test(lowerText))) {
    return "QUANTITATIVE";
  }

  // Currency symbol followed by digit = definitely QUANTITATIVE
  if (/[£$€¥]\s*\d/.test(text)) {
    return "QUANTITATIVE";
  }

  // Has financial terms but not clearly asking for numbers - keep DESCRIPTIVE
  return llmType;
}
