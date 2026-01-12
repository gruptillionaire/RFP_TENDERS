import OpenAI from "openai";
import { MODELS, TOKEN_LIMITS, RequirementType } from "./constants";
import { sanitizeForLLM } from "./security";
import { matchTemplate } from "./templates";
import { DomainContext, detectDomainContext, getDomainPromptModifier, applyDomainRules, DOMAIN_RULES } from "./domain-context";

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
2. Whether it is MANDATORY or OPTIONAL - use these rules:
   - DEFAULT to isMandatory: false (most requirements are optional unless explicitly stated)
   - Set isMandatory: true ONLY if the text contains explicit mandatory language: "must", "shall", "required", "mandatory", "essential", "critical"
   - Set isMandatory: false if the text contains optional language: "should", "may", "can", "could", "preferred", "desirable", "optional", "recommended", "if possible", "where applicable"
   - When unclear, default to isMandatory: false
3. The FULL section reference (extract the complete identifier):
   - Look for: "A1", "A25", "B2.4", "Section 3.1.2", "1.2.3", "Part II.A", "Q15", etc.
   - Include the full alphanumeric reference (e.g., "A25" not just "A")
   - Include sub-section numbers (e.g., "3.1.2" not just "3")
   - Preserve exact format from document (e.g., "II.B.3", "Appendix A.2")
   - If no section identifier, use descriptive name (e.g., "Introduction", "Technical Requirements")
4. The REQUIREMENT TYPE - classify each requirement into ONE of these categories:

==============================================================================
REQUIREMENT TYPES (with TRIGGER KEYWORDS - match keywords FIRST, then context)
==============================================================================

■ QUANTITATIVE
  TRIGGER KEYWORDS (if ANY present, strongly consider QUANTITATIVE):
  £, $, €, price, pricing, cost, costing, budget, fee, rate, quote, tender sum,
  total, TCO, ROI, SLA, uptime, %, percent, percentage, capacity, volume,
  quantity, metric, measurement, KPI, target, threshold, benchmark

  USE WHEN: Requirement involves money, pricing, numerical targets, or measurable SLAs
  INCLUDES: Yes/no questions about pricing (e.g., "Does your total come in under £X?")
  Examples:
  • "Provide detailed pricing breakdown" → QUANTITATIVE
  • "Does your three-year total come in under £150k?" → QUANTITATIVE (pricing question)
  • "What is your system uptime SLA?" → QUANTITATIVE
  • "List your performance metrics" → QUANTITATIVE

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
  TRIGGER KEYWORDS (if ANY present, strongly consider STAFFING):
  personnel, staff, team, resource, FTE, headcount, resume, CV, qualifications,
  project manager, key personnel, roles, responsibilities, org chart, bio,
  experience of staff, dedicated resource

  USE WHEN: About team composition, individual qualifications, or personnel
  Examples:
  • "Identify key personnel for this project" → STAFFING
  • "Provide CVs of proposed team members" → STAFFING
  • "Describe your project manager's qualifications" → STAFFING

■ CONTEXTUAL
  ==============================================================================
  ACID TEST: Does this require a WRITTEN RESPONSE in the proposal?
  → If NO written response is needed in the proposal document → CONTEXTUAL
  → If YES a written answer/statement is needed → NOT CONTEXTUAL (use another type)
  ==============================================================================

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
     These TELL you what to do procedurally; they don't ask for written proposal content.

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

>>> STEP 1: CHECK FOR CONTEXTUAL FIRST (highest priority) <<<
Ask: "Does this require the respondent to WRITE something in the proposal?"

CONTEXTUAL (no written response needed) - Check for these patterns FIRST:
  ✓ Contains "Failure to [X] may/will result in..." → CONTEXTUAL (warning)
  ✓ Contains "If not [provided/included], [consequence]" → CONTEXTUAL (warning)
  ✓ Contains "shall/should/must [notify/submit/ensure/include/deliver/send]" → CONTEXTUAL (process instruction)
  ✓ Contains "submissions/responses shall include [document]" → CONTEXTUAL (instruction)
  ✓ Background paragraph about the organization → CONTEXTUAL
  ✓ Deadline statement without a question → CONTEXTUAL
  ✓ Contains "We require/need/are looking for [X]" (buyer stating needs, no question mark) → CONTEXTUAL
  ✓ Contains "The [selected/chosen] provider is expected to..." → CONTEXTUAL (buyer expectation)
  ✓ Subject is BUYER describing their requirements (not asking bidder to explain) → CONTEXTUAL

If ANY of the above match → classify as CONTEXTUAL and STOP.

>>> STEP 2: IF NOT CONTEXTUAL, check other types in order <<<
3. EVIDENCE_BASED: Asks to attach/include/submit/upload a file, sample, or document
4. QUANTITATIVE: Contains £/$, pricing, cost, budget, fee, SLA, %, or numerical metrics
5. REFERENCE_BASED: Asks for references, past performance, client contacts
6. STAFFING: Asks for team, personnel, staff, qualifications, CVs
7. DESCRIPTIVE: Contains "describe/explain/outline" or lists 3+ items to address
8. DECLARATIVE: Yes/no compliance question (NOT about pricing - that's QUANTITATIVE)
9. PROCEDURAL: Simple confirmation or acknowledgment needed
10. Default → DESCRIPTIVE

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
      "section": "Full section reference (e.g., 'A25', 'B2.4', 'Section 3.1.2') or descriptive name, or null",
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
- COMPLETE TEXT EXTRACTION (CRITICAL):
  * Extract the ENTIRE requirement text, including ALL parts
  * If a paragraph introduces context followed by a numbered question (e.g., "1. Does your..."), include BOTH the context AND the question
  * Never truncate at the preamble - always include the actual question being asked
  * If there's a word count limit mentioned (e.g., "Maximum word count 2,500"), include that in the extracted text
  * The "text" field must contain everything the responder needs to understand and answer the requirement
- TABLE FORMAT: Documents may contain structured tables in this format:
  * [TABLE START] / [TABLE END] markers indicate table boundaries
  * [HEADER] indicates column headers
  * [ROW N] indicates data rows
  * [Col N] indicates column values
  * When extracting from tables, combine relevant columns into a coherent requirement (e.g., if Col 1 is "Ref" and Col 2 is "Requirement", combine them logically)
- Do not summarize or paraphrase - extract the actual text from the document
- Classify EVERY requirement with the most appropriate type
- When uncertain between types, default to DESCRIPTIVE`;

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
- List key personnel with roles and qualifications
- Include relevant experience and certifications
- Describe availability/dedication level
- Mention backup/succession plans if relevant

EXAMPLE FORMAT:
[COMPANY NAME] proposes the following team:

**[ROLE]: [NAME]**
- Qualifications: [DEGREES, CERTIFICATIONS]
- Experience: [X years in DOMAIN]
- Role: [SPECIFIC RESPONSIBILITIES]
- Availability: [PERCENTAGE] dedicated

[ATTACH resumes as Appendix X]

CRITICAL: NEVER wrap response in quotation marks.`,
};

// =============================================================================
// TYPES
// =============================================================================
export interface ExtractedRequirement {
  text: string;
  isMandatory: boolean;
  section: string | null;
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
}

// =============================================================================
// EXTRACTION FUNCTION
// =============================================================================
export async function extractRequirements(documentText: string): Promise<ExtractionResult> {
  // Sanitize input to prevent prompt injection
  const sanitizedText = sanitizeForLLM(documentText);

  // Truncate if too long
  const maxLength = 100000;
  const truncatedText =
    sanitizedText.length > maxLength
      ? sanitizedText.substring(0, maxLength) + "\n\n[Document truncated due to length]"
      : sanitizedText;

  // Create abort controller for timeout (2 minutes)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  let response;
  try {
    response = await openai.chat.completions.create(
      {
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
      },
      { signal: controller.signal }
    );
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error("Extraction timed out after 2 minutes. Try a smaller document.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  try {
    const parsed = JSON.parse(content);

    // Build the result with deadline and requirements
    const result: ExtractionResult = {
      deadline: parsed.deadline || null,
      deadlineText: parsed.deadlineText || null,
      requirements: (parsed.requirements || []).map((req: ExtractedRequirement) => ({
        ...req,
        type: validateRequirementType(req.type),
        // Use LLM-provided domain context or fallback to heuristic detection
        domainContext: validateDomainContext(req.domainContext) || detectDomainContext(req.text),
        wordLimit: typeof req.wordLimit === 'number' ? req.wordLimit : null,
        characterLimit: typeof req.characterLimit === 'number' ? req.characterLimit : null,
        isAttestation: req.isAttestation === true, // Default to false if not specified
      })),
    };

    return result;
  } catch {
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

  const response = await openai.chat.completions.create({
    model: MODELS.DRAFTING,
    messages,
    temperature: 0.7,
    max_tokens: tokenLimits.max * 2, // Allow buffer, prompts guide actual length
  });

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
