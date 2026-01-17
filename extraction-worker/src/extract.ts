import OpenAI from 'openai';

// =============================================================================
// TYPES
// =============================================================================

export interface ExtractedRequirement {
  section: string | null;
  sectionGroup: string | null;
  text: string;
  type: RequirementType;
  isMandatory: boolean;
  domainContext: 'FEATURE' | 'PROCESS' | 'LEGAL' | null;
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

export type RequirementType =
  | 'CONTEXTUAL'
  | 'PROCEDURAL'
  | 'DECLARATIVE'
  | 'DESCRIPTIVE'
  | 'EVIDENCE_BASED'
  | 'QUANTITATIVE'
  | 'REFERENCE_BASED'
  | 'STAFFING';

interface ExtractionOptions {
  model?: string;
}

// =============================================================================
// EXTRACTION PROMPT
// This is the complete prompt from the main application
// =============================================================================

const EXTRACTION_PROMPT = `You are an expert at analyzing RFP (Request for Proposal) and tender documents. Your task is to extract ALL questions, requirements, and mandatory items from the document.

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

      CRITICAL - SECTION NUMBER FORMATTING:
      ==============================================================================
      Section numbers MUST be a single string WITHOUT newlines or extra whitespace.
      If the document shows a section number split across lines (e.g., "3." on one line
      and "12.5" on the next), you MUST combine them into "3.12.5".

      CORRECT: "3.12.5", "4.3.1", "A.1.2"
      WRONG: "3.\\n12.5", "12.5" (missing the 3), "3. 12.5" (extra space)

      Never drop the leading number - "3.12.5" must stay "3.12.5", not become "12.5".
      ==============================================================================

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
- When uncertain between types, default to DESCRIPTIVE

==============================================================================
SECTIONS TO SKIP (DO NOT EXTRACT)
==============================================================================
The following sections are BOILERPLATE and should NOT be extracted as requirements:

1. FEDERAL CONTRACT CLAUSES / COMPLIANCE BOILERPLATE:
   - Title VI Civil Rights provisions
   - Nondiscrimination Acts and Authorities lists
   - Federal Fair Labor Standards Act references
   - Occupational Safety and Health Act references
   - Domestic Preference clauses
   - Standard FAR/CFR clause references
   - Environmental justice executive orders
   - ADA compliance boilerplate

   HOW TO IDENTIFY: These sections typically:
   - Reference specific laws by citation (42 USC §, 49 CFR part, PL 100-259)
   - List multiple acts/statutes in sequence
   - Contain standard legal language about discrimination, compliance
   - Are labeled "Federal Contract Clauses" or similar

   SKIP THESE ENTIRELY - they are standard legal text, not project-specific requirements.

2. FILL-IN FORMS WITH BLANK LINES:
   - Fee Submittal forms with underscores (______) for pricing
   - Signature pages with blank lines
   - Forms that are purely blank fields to complete

   HOW TO IDENTIFY: Multiple consecutive lines with underscores or blank fields.

   SKIP THESE - or if pricing info is needed, extract individual line items separately
   (e.g., "Cost per hour for PM Services" as one requirement, not the entire form as one blob).

3. STANDARD TERMS AND CONDITIONS:
   - Rights to proposal materials
   - General indemnification clauses
   - Standard liability limitations
   - Boilerplate contract termination language

==============================================================================
CRITICAL: EXTRACT THE COMPLETE DOCUMENT - DO NOT STOP EARLY
==============================================================================
You MUST extract requirements from the ENTIRE document, including:
- The LAST subsection of each section (e.g., if section 3 has 3.1 through 3.17, extract ALL of them including 3.17)
- The FINAL requirements in the document (do not stop at 90% - finish the full 100%)
- Small sections that appear between larger ones (e.g., 3.2 between large 3.1 and 3.3)

*** SECTION HIERARCHY - UNDERSTAND THIS ***
Documents use multi-level numbering like:
  3.0  (major section - contains 3.1, 3.2, 3.3, ..., 3.N)
    3.1  (subsection - contains 3.1.1, 3.1.2, ..., 3.1.N)
      3.1.1, 3.1.2, 3.1.3... (individual requirements)
    3.2  (ANOTHER subsection - you MUST continue here!)
      3.2.1, 3.2.2, 3.2.3...
    3.3, 3.4, 3.5... (continue through ALL subsections)
  4.0  (ANOTHER major section - you MUST continue here!)
    4.1, 4.2, 4.3...

*** DO NOT STOP AT SECTION BOUNDARIES ***
When you finish extracting 3.1.N (the last item in subsection 3.1), you are NOT done!
Look for 3.2, 3.3, 3.4, etc. - these are ADDITIONAL subsections with MORE requirements.
When you finish section 3.N, look for section 4.0, 5.0, etc.

COMMON FAILURE MODES TO AVOID:
- Stopping after 3.1.20 when 3.2, 3.3, ... 3.17 exist (MAJOR ERROR)
- Stopping at 3.15 when there's a 3.16, 3.17, etc.
- Missing small subsections (3.2 only has 2 items but must still be extracted)
- Skipping the last 2-3 requirements of a subsection
- Not extracting section 4.0 after finishing section 3.0

VERIFICATION: Before finishing, confirm you have extracted from ALL sections numbered in the document.
If you see "3.17" in the document, you should have requirements from 3.1 through 3.17.
If you see "4.6" in the document, you should have requirements from 4.1 through 4.6.

Extract to the ABSOLUTE END of the provided text. Count your extracted items and verify coverage.
==============================================================================`;

// =============================================================================
// DOCUMENT STRUCTURE DETECTION
// =============================================================================

/**
 * Detect section structure in document to help guide complete extraction.
 * Returns a summary of all sections found (e.g., "3.1 through 3.17, 4.1 through 4.6")
 */
function detectDocumentSections(text: string): string {
  // Find all section patterns like 3.1, 3.1.1, 4.2.3, etc.
  const sectionPattern = /\b(\d+)\.(\d+)(?:\.(\d+))?\b/g;
  const sections = new Map<string, Set<number>>();

  let match;
  while ((match = sectionPattern.exec(text)) !== null) {
    const major = match[1];
    const minor = parseInt(match[2], 10);

    if (!sections.has(major)) {
      sections.set(major, new Set());
    }
    sections.get(major)!.add(minor);
  }

  if (sections.size === 0) {
    return '';
  }

  // Build summary
  const summaryParts: string[] = [];
  const sortedMajors = Array.from(sections.keys()).sort((a, b) => parseInt(a) - parseInt(b));

  for (const major of sortedMajors) {
    const minors = Array.from(sections.get(major)!).sort((a, b) => a - b);
    if (minors.length > 0) {
      const min = minors[0];
      const max = minors[minors.length - 1];
      if (min === max) {
        summaryParts.push(`Section ${major}.${min}`);
      } else {
        summaryParts.push(`Section ${major}: subsections ${major}.${min} through ${major}.${max}`);
      }
    }
  }

  return summaryParts.join('; ');
}

// =============================================================================
// EXTRACTION FUNCTION
// =============================================================================

export async function extractRequirements(
  documentText: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const model = options.model || 'gpt-4o-mini';
  const startTime = Date.now();

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  console.log(`[extract] Starting extraction with model ${model}`);
  console.log(`[extract] Document length: ${documentText.length} chars`);

  // Detect document structure to help guide extraction
  const sectionSummary = detectDocumentSections(documentText);
  console.log(`[extract] Detected sections: ${sectionSummary || 'none detected'}`);

  // Build user message with structure guidance if detected
  let userMessage = documentText;
  if (sectionSummary) {
    userMessage = `DOCUMENT STRUCTURE DETECTED:
${sectionSummary}

You MUST extract requirements from ALL of these sections - do not stop early!

---BEGIN DOCUMENT---
${documentText}
---END DOCUMENT---`;
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for consistent extraction
    });

    const content = response.choices[0]?.message?.content;
    const finishReason = response.choices[0]?.finish_reason;

    console.log(`[extract] Finish reason: ${finishReason}`);

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Warn if output was truncated
    if (finishReason === 'length') {
      console.warn(`[extract] WARNING: Output was truncated due to token limit!`);
    }

    const result = JSON.parse(content) as ExtractionResult;
    const elapsed = Date.now() - startTime;

    console.log(`[extract] Complete: ${result.requirements?.length || 0} requirements in ${elapsed}ms`);
    console.log(`[extract] Tokens used: ${response.usage?.total_tokens || 'unknown'}`);

    // Valid requirement types (must match Prisma schema)
    const VALID_TYPES: RequirementType[] = [
      'CONTEXTUAL',
      'PROCEDURAL',
      'DECLARATIVE',
      'DESCRIPTIVE',
      'EVIDENCE_BASED',
      'QUANTITATIVE',
      'REFERENCE_BASED',
      'STAFFING',
    ];

    // Normalize the response
    return {
      deadline: result.deadline || null,
      deadlineText: result.deadlineText || null,
      requirements: (result.requirements || []).map(req => {
        // Validate and fix type - LLM sometimes returns invalid types like "LEGAL"
        let type = req.type || 'DESCRIPTIVE';
        if (!VALID_TYPES.includes(type as RequirementType)) {
          console.warn(`[extract] Invalid type "${type}" for requirement, defaulting to CONTEXTUAL`);
          type = 'CONTEXTUAL';
        }

        return {
          section: req.section || null,
          sectionGroup: req.sectionGroup || null,
          text: req.text || '',
          type: type as RequirementType,
          isMandatory: req.isMandatory !== false, // Default to true
          domainContext: req.domainContext || 'FEATURE',
          wordLimit: req.wordLimit || null,
          characterLimit: req.characterLimit || null,
          isAttestation: req.isAttestation || false,
        };
      }),
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    console.error(`[extract] Failed after ${elapsed}ms:`, error);
    throw error;
  }
}
