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
// LINE-REFERENCE EXTRACTION PROMPT
// Optimized to reduce output size by using line references instead of full text
// =============================================================================

const EXTRACTION_PROMPT = `You are an expert at analyzing RFP (Request for Proposal) and tender documents. Your task is to extract ALL questions, requirements, and mandatory items from the document.

IMPORTANT: The document has LINE NUMBERS at the start of each line (format: "L123: text").
Instead of outputting the full requirement text, output the START and END line numbers.
This dramatically reduces response size and prevents truncation.

For each item extracted, identify:
1. The LINE RANGE (startLine and endLine) where the requirement appears
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

==============================================================================
OUTPUT FORMAT - SIMPLIFIED (Classification done in post-processing)
==============================================================================

Return your response as a JSON object with this COMPACT structure:
{
  "d": "ISO 8601 deadline or null",
  "dt": "Original deadline text or null",
  "r": [
    [startLine, endLine, "section", "sectionGroup"],
    [startLine, endLine, "section", "sectionGroup"]
  ]
}

ARRAY FORMAT - each requirement is an array with 4 positions:
[0] startLine - integer, line where requirement starts
[1] endLine - integer, line where requirement ends
[2] section - string like "3.1.2" or "A.1" or null if no section number
[3] sectionGroup - string like "3: Technical Requirements" or null

EXAMPLE:
{"d":"2025-02-14T17:00:00","dt":"5pm Friday 14 February 2025","r":[
[12,12,"1.0","1: Introduction"],
[45,48,"3.1.2","3: Technical Requirements"],
[52,52,"3.1.3","3: Technical Requirements"],
[60,65,"3.2.1","3: Technical Requirements"],
[70,72,"4.1","4: Pricing"],
[80,82,"5.1","5: Optional Services"],
[90,93,"6.1","6: Staffing"]
]}

LINE REFERENCE RULES:
- startLine/endLine are integers from the "L123:" prefixes in the document
- For single-line requirements, startLine equals endLine
- For multi-line requirements, include ALL lines in the range
- DO NOT output requirement text - we extract it using line numbers

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

- COMPLETE LINE RANGE (CRITICAL):
  * Include ALL lines of the requirement in your startLine to endLine range
  * If a paragraph introduces context followed by a numbered question (e.g., "1. Does your..."), include BOTH the context AND the question lines
  * Never start at the question line if there's preamble context above it
  * If there's a word count limit mentioned (e.g., "Maximum word count 2,500"), include that line in the range
  * The line range must cover everything the responder needs to understand and answer the requirement
  * BUT: If you see multiple X.Y.Z numbered items, extract each as a SEPARATE requirement with its own line range
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
CRITICAL: EXTRACT THE COMPLETE DOCUMENT - DO NOT STOP EARLY
==============================================================================
You MUST extract requirements from the ENTIRE document, including:
- The LAST subsection of each section (e.g., if section 3 has 3.1 through 3.17, extract ALL of them including 3.17)
- The FINAL requirements in the document (do not stop at 90% - finish the full 100%)
- Small sections that appear between larger ones (e.g., 3.2 between large 3.1 and 3.3)

COMMON FAILURE MODES TO AVOID:
- Stopping at 3.15 when there's a 3.16, 3.17, etc.
- Missing small subsections (3.2 only has 2 items but must still be extracted)
- Skipping the last 2-3 requirements of a subsection

Extract to the ABSOLUTE END of the provided text. Count your extracted items and verify coverage.
==============================================================================`;

// =============================================================================
// DOCUMENT STRUCTURE DETECTION
// =============================================================================

/**
 * Detect section structure in document to help guide complete extraction.
 * Returns a detailed summary of all sections found with item counts per subsection.
 */
function detectDocumentSections(text: string): string {
  // Find all section patterns like 3.1.1, 3.1.2, 4.2.3, etc. (X.Y.Z format)
  const detailedPattern = /\b(\d+)\.(\d+)\.(\d+)\b/g;
  // Key: "major.minor" -> Set of tertiary numbers (3.1 -> {1,2,3,...,20})
  const subsectionItems = new Map<string, Set<number>>();
  // Key: "major" -> Set of minor numbers (3 -> {1,2,3,...,17})
  const majorSections = new Map<string, Set<number>>();

  let match;
  while ((match = detailedPattern.exec(text)) !== null) {
    const major = match[1];
    const minor = parseInt(match[2], 10);
    const tertiary = parseInt(match[3], 10);

    const subsectionKey = `${major}.${minor}`;
    if (!subsectionItems.has(subsectionKey)) {
      subsectionItems.set(subsectionKey, new Set());
    }
    subsectionItems.get(subsectionKey)!.add(tertiary);

    if (!majorSections.has(major)) {
      majorSections.set(major, new Set());
    }
    majorSections.get(major)!.add(minor);
  }

  if (majorSections.size === 0) {
    return '';
  }

  // Build detailed summary
  const summaryParts: string[] = [];
  const sortedMajors = Array.from(majorSections.keys()).sort((a, b) => parseInt(a) - parseInt(b));

  let totalExpectedItems = 0;

  for (const major of sortedMajors) {
    const minors = Array.from(majorSections.get(major)!).sort((a, b) => a - b);
    const minCount = minors[0];
    const maxCount = minors[minors.length - 1];

    // Build subsection detail
    const subsectionDetails: string[] = [];
    for (const minor of minors) {
      const subsectionKey = `${major}.${minor}`;
      const items = subsectionItems.get(subsectionKey);
      if (items && items.size > 0) {
        const itemsList = Array.from(items).sort((a, b) => a - b);
        const itemMax = itemsList[itemsList.length - 1];
        totalExpectedItems += items.size;
        subsectionDetails.push(`${subsectionKey} (${items.size} items: up to ${subsectionKey}.${itemMax})`);
      }
    }

    if (subsectionDetails.length > 0) {
      summaryParts.push(`Section ${major}: subsections ${major}.${minCount}-${major}.${maxCount}\n  ${subsectionDetails.join('\n  ')}`);
    }
  }

  summaryParts.push(`\nTOTAL EXPECTED: ~${totalExpectedItems} numbered items (plus section headers)`);

  return summaryParts.join('\n');
}

// =============================================================================
// HELPER FUNCTIONS (from main app)
// =============================================================================

/**
 * Detect if a requirement text contains multiple concatenated requirements
 * Returns the count of detected requirement numbers
 */
function detectConcatenatedRequirements(text: string): string[] {
  // Pattern for requirement numbers: 3.1.1, 3.1.2, A.1.1, etc.
  const reqNumberPattern = /\b(\d+\.\d+\.\d+|[A-Z]\.\d+\.\d+)\b/g;
  const matches = text.match(reqNumberPattern);
  return matches || [];
}

/**
 * Split a concatenated requirement text into individual requirements
 * Returns array of {section, text} objects
 */
function splitConcatenatedRequirement(text: string): Array<{ section: string; text: string }> {
  const results: Array<{ section: string; text: string }> = [];

  // Pattern to split on requirement numbers
  const splitPattern = /(\d+\.\d+\.\d+|\d+\.\d+\s*[a-z]\)|[A-Z]\.\d+\.\d+)\s+/g;

  // Find all requirement number positions
  const parts: Array<{ index: number; section: string }> = [];
  let match;

  while ((match = splitPattern.exec(text)) !== null) {
    parts.push({
      index: match.index,
      section: match[1].trim(),
    });
  }

  // If no splits found, return original as single item
  if (parts.length === 0) {
    return [{ section: '', text: text.trim() }];
  }

  // Extract text for each requirement
  for (let i = 0; i < parts.length; i++) {
    const start = parts[i].index + parts[i].section.length;
    const end = i < parts.length - 1 ? parts[i + 1].index : text.length;
    const reqText = text.substring(start, end).trim();

    if (reqText.length > 0) {
      results.push({
        section: parts[i].section,
        text: reqText,
      });
    }
  }

  return results;
}

/**
 * Check if text looks like a section header rather than a requirement
 * Section headers are typically short titles without question marks
 */
function isSectionHeader(text: string): boolean {
  const trimmed = text.trim();

  // Headers are typically short (under 100 chars)
  if (trimmed.length > 100) return false;

  // Headers don't contain question marks
  if (trimmed.includes('?')) return false;

  // Headers are usually title case or ALL CAPS
  const words = trimmed.split(/\s+/);
  const titleCaseWords = words.filter(w => /^[A-Z]/.test(w)).length;
  const isTitleCase = titleCaseWords / words.length > 0.5;

  // Headers often end with a colon or are just a title
  const endsWithColon = trimmed.endsWith(':');

  // Headers don't start with common requirement verbs
  const startsWithReqVerb = /^(Does|Do|Can|Will|Should|Must|Is|Are|Has|Have|Describe|Explain|Provide)/i.test(trimmed);

  return (isTitleCase || endsWithColon) && !startsWithReqVerb;
}

/**
 * Format a list within requirement text
 * Ensures proper line breaks and indentation for lists
 */
function formatListInRequirement(text: string): string {
  let result = text;

  // Ensure bullet points start on new lines
  result = result.replace(/([.?!])\s*(•)/g, '$1\n$2');

  // Ensure numbered items start on new lines
  result = result.replace(/([.?!])\s*(\d+\.|\([a-z]\)|[a-z]\))/g, '$1\n$2');

  // Add indentation to list items for clarity
  result = result.replace(/\n(•|\d+\.|\([a-z]\)|[a-z]\))/g, '\n  $1');

  return result;
}

/**
 * Extract major category from section reference
 * Examples:
 *   "A.1.2" → "A" (single letter)
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

// =============================================================================
// POST-PROCESSING FUNCTIONS (from main app)
// =============================================================================

/**
 * Validate requirement type, defaulting to DESCRIPTIVE if invalid
 */
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
  return "DESCRIPTIVE"; // Default fallback
}

/**
 * Heuristic correction: DESCRIPTIVE → QUANTITATIVE for actual financial/numeric requirements
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
 * Post-process to enrich sectionGroup with titles from document structure.
 * If LLM didn't provide a sectionGroup or it lacks a title, derive it from the document.
 */
function enrichSectionData(requirements: ExtractedRequirement[], documentText: string): void {
  // Build a map of major section numbers to their titles from document headings
  const sectionTitleMap = new Map<string, string>();

  console.log("[enrichSectionData] Starting section enrichment...");

  // Multi-pattern heading extraction for different document formats
  const headingPatterns = [
    // Pattern 1: Markdown headings (from DOCX parser)
    /#+\s*([A-Z]|[IVXLC]+|\d+)[.:\)]*\s*[:\-.\s]\s*([A-Z][A-Za-z\s,&\-]+)/gi,

    // Pattern 2: Plain text section headers with colon separator
    /(?:^|\n)\s*([A-Z]|[IVXLC]+|\d+)[.:\)]*\s*:\s*([A-Z][A-Za-z\s,&\-]{3,})/gi,

    // Pattern 3: Plain text section headers with period separator
    /(?:^|\n)\s*([A-Z]|[IVXLC]+|\d+)\.\s+([A-Z][A-Za-z\s,&\-]{3,})/gi,

    // Pattern 4: "SECTION X:" format
    /(?:^|\n)\s*SECTION\s+([A-Z]|\d+)[.:\)]*\s*[:\-.\s]\s*([A-Z][A-Za-z\s,&\-]+)/gi,

    // Pattern 5: Parenthetical section markers
    /(?:^|\n)\s*\(([A-Z]|\d+)\)\s+([A-Z][A-Za-z\s,&\-]{3,})/gi,

    // Pattern 6: All-caps title following section number
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

  console.log(`[enrichSectionData] Found ${sectionTitleMap.size} section titles in document`);

  // Enrich each requirement's sectionGroup
  for (const req of requirements) {
    // Skip if no section reference at all
    if (!req.section && !req.sectionGroup) continue;

    // Extract major category from section (A.1.2 → A)
    const majorCategory = req.section
      ? extractMajorCategory(req.section)
      : (req.sectionGroup ? extractMajorCategory(req.sectionGroup) : null);

    if (!majorCategory) continue;

    // Check if sectionGroup needs enrichment
    const sectionGroupTrimmed = (req.sectionGroup || '').trim();
    const needsEnrichment =
      !req.sectionGroup ||
      /^([A-Z]|\d+|[IVXLC]+)[.:\)\s]*$/i.test(sectionGroupTrimmed) || // Just a number/letter
      /^[A-Z]\d+$/i.test(sectionGroupTrimmed) || // Letter+number like "A15"
      /^[A-Z][.\-]\d/i.test(sectionGroupTrimmed) || // Subsection like "A.1"
      /^\d+\.\d/i.test(sectionGroupTrimmed) || // Numeric subsection like "3.4"
      (req.section && req.sectionGroup === req.section) || // sectionGroup equals section
      (!sectionGroupTrimmed.includes(':') && sectionGroupTrimmed.length < 20); // Missing ": TITLE"

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
// LINE NUMBER UTILITIES
// =============================================================================

/**
 * Add line numbers to document text.
 * Format: "L1: first line\nL2: second line\n..."
 */
function addLineNumbers(text: string): { numberedText: string; lines: string[] } {
  const lines = text.split('\n');
  const numberedLines = lines.map((line, i) => `L${i + 1}: ${line}`);
  return {
    numberedText: numberedLines.join('\n'),
    lines, // Keep original lines for text extraction
  };
}

/**
 * Extract text from document using line range.
 */
function extractTextFromLines(lines: string[], startLine: number, endLine: number): string {
  // Convert to 0-indexed
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length - 1, endLine - 1);

  if (start > end || start >= lines.length) {
    return '';
  }

  const rawText = lines.slice(start, end + 1).join('\n').trim();
  return stripSectionPrefix(rawText);
}

/**
 * Strip section number prefixes from requirement text.
 * Examples:
 *   "4.4.5 Is any software required..." → "Is any software required..."
 *   "A.1.2 Describe your approach..." → "Describe your approach..."
 *   "3.\n  3.1 Some text" → "Some text"
 */
function stripSectionPrefix(text: string): string {
  // Pattern matches section numbers at start of text:
  // - "4.4.5 " or "4.4.5. " (numbered sections)
  // - "A.1.2 " or "A.1.2. " (letter sections)
  // - "4." or "A." on its own line followed by more content
  // - "(a)" or "(1)" style prefixes

  let result = text;

  // Remove leading section numbers like "4.4.5 " or "A.1.2 " or "4.4.5. "
  result = result.replace(/^(\d+\.)+\d*\s*\.?\s*/m, '');
  result = result.replace(/^[A-Z](\.\d+)+\s*\.?\s*/im, '');

  // Remove standalone section markers like "4.\n" at the start
  result = result.replace(/^\d+\.\s*\n\s*/m, '');
  result = result.replace(/^[A-Z]\.\s*\n\s*/im, '');

  // Remove subsection numbers after newlines: "\n  4.5 " → "\n"
  result = result.replace(/\n\s*(\d+\.)+\d*\s*\.?\s*/g, '\n');
  result = result.replace(/\n\s*[A-Z](\.\d+)+\s*\.?\s*/gi, '\n');

  // Remove parenthetical prefixes like "(a) " or "(1) "
  result = result.replace(/^\([a-z0-9]+\)\s*/im, '');

  // Clean up any resulting leading/trailing whitespace or empty lines
  result = result.replace(/^\s*\n+/, '').trim();

  return result;
}

// Compact array format from LLM (simplified - classification done in post-processing)
// Each requirement is: [startLine, endLine, section, sectionGroup]
type CompactRequirement = [number, number, string | null, string | null];

interface CompactResult {
  d: string | null;   // deadline
  dt: string | null;  // deadlineText
  r: CompactRequirement[];  // requirements
}

// =============================================================================
// HEURISTIC CLASSIFICATION FUNCTIONS
// =============================================================================

/**
 * Classify requirement TYPE based on text content
 */
function classifyType(text: string): RequirementType {
  const lower = text.toLowerCase();
  const trimmed = text.trim();

  // CONTEXTUAL - Section headers, introductory text, context-setting
  // Short text without questions, often title-case or all-caps
  if (trimmed.length < 80 && !trimmed.includes('?')) {
    const words = trimmed.split(/\s+/);
    const titleCaseCount = words.filter(w => /^[A-Z]/.test(w)).length;
    if (titleCaseCount / words.length > 0.6 || /^[A-Z\s\-&:]+$/.test(trimmed)) {
      return 'CONTEXTUAL';
    }
  }

  // QUANTITATIVE - Pricing, costs, numbers, financial
  if (/\b(price|pricing|cost|budget|fee|rate|quote|£|\$|€|%)\b/i.test(text)) {
    if (/\b(provide|submit|state|list|what)\b.*\b(price|cost|fee|rate|budget|quote)\b/i.test(lower)) {
      return 'QUANTITATIVE';
    }
  }

  // STAFFING - Personnel, team, resources
  if (/\b(staff|staffing|personnel|team|resource|employee|fte|headcount|cv|resume|experience.*years)\b/i.test(lower)) {
    if (/\b(provide|describe|list|detail|submit)\b.*\b(staff|team|personnel|cv|resource)/i.test(lower)) {
      return 'STAFFING';
    }
  }

  // REFERENCE_BASED - References, case studies, past performance
  if (/\b(reference|case study|case studies|past performance|previous project|client.*name|testimonial)\b/i.test(lower)) {
    return 'REFERENCE_BASED';
  }

  // EVIDENCE_BASED - Proof, evidence, demonstrate, certifications
  if (/\b(provide evidence|demonstrate|proof|certif|accredit|audit|compliance.*evidence|evidence.*compliance)\b/i.test(lower)) {
    return 'EVIDENCE_BASED';
  }

  // PROCEDURAL - Process, timeline, schedule, methodology steps
  if (/\b(timeline|schedule|milestone|phase|process|procedure|step|workflow|methodology)\b/i.test(lower)) {
    if (/\b(describe|outline|provide|detail|explain)\b.*\b(timeline|schedule|process|procedure|methodology)\b/i.test(lower)) {
      return 'PROCEDURAL';
    }
  }

  // DECLARATIVE - Yes/no questions, confirmations, simple statements
  // Questions that can be answered with yes/no or simple confirmation
  if (/^(do you|does your|can you|is your|are you|will you|have you|has your)\b/i.test(trimmed)) {
    // Short questions without "describe/explain" are declarative
    if (trimmed.length < 200 && !/\b(describe|explain|detail|outline|how)\b/i.test(lower)) {
      return 'DECLARATIVE';
    }
  }
  if (/\b(confirm|acknowledge|agree|accept|certify|declare|attest)\b/i.test(lower)) {
    if (trimmed.length < 300) {
      return 'DECLARATIVE';
    }
  }

  // DESCRIPTIVE - Default for most requirements asking for description/explanation
  // Describe, explain, detail, outline, provide information
  return 'DESCRIPTIVE';
}

/**
 * Determine if requirement is MANDATORY based on text content
 */
function classifyMandatory(text: string): boolean {
  const lower = text.toLowerCase();

  // Explicit OPTIONAL signals - return false
  if (/\b(optional|if desired|if applicable|where applicable|at your discretion)\b/i.test(lower)) {
    return false;
  }
  if (/\b(not required|not mandatory|nice to have|desirable but not)\b/i.test(lower)) {
    return false;
  }
  if (/\b(may choose|you may|bonus|preferred but not)\b/i.test(lower)) {
    return false;
  }

  // Everything else is mandatory by default in RFPs
  return true;
}

/**
 * Classify DOMAIN context (Feature, Process, Legal)
 */
function classifyDomain(text: string): 'FEATURE' | 'PROCESS' | 'LEGAL' {
  const lower = text.toLowerCase();

  // LEGAL - Compliance, regulatory, legal terms, contracts
  if (/\b(comply|compliance|regulation|regulatory|legal|law|statute|legislation)\b/i.test(lower)) {
    return 'LEGAL';
  }
  if (/\b(gdpr|hipaa|sox|pci|iso\s*\d|far\s+\d|dfar|contract|liability|indemnif|warrant)\b/i.test(lower)) {
    return 'LEGAL';
  }
  if (/\b(terms and conditions|privacy policy|data protection|confidential)\b/i.test(lower)) {
    return 'LEGAL';
  }

  // PROCESS - Methodology, approach, process-related
  if (/\b(process|procedure|methodology|approach|workflow|how do you|how will you)\b/i.test(lower)) {
    return 'PROCESS';
  }
  if (/\b(implement|deploy|deliver|manage|monitor|maintain|support|transition)\b/i.test(lower)) {
    if (/\b(how|approach|process|methodology|procedure)\b/i.test(lower)) {
      return 'PROCESS';
    }
  }

  // FEATURE - Default for technical capabilities, features, functionality
  return 'FEATURE';
}

/**
 * Determine if requirement is an ATTESTATION (simple yes/no compliance)
 */
function classifyAttestation(text: string): boolean {
  const lower = text.toLowerCase();
  const trimmed = text.trim();

  // NOT attestation if it asks for description/explanation
  if (/\b(describe|explain|detail|outline|provide.*information|how do|how will|what is your)\b/i.test(lower)) {
    return false;
  }

  // NOT attestation if it asks for documentation/evidence
  if (/\b(provide.*evidence|submit.*document|attach|include.*sample|demonstrate)\b/i.test(lower)) {
    return false;
  }

  // IS attestation - simple yes/no compliance questions
  if (/^(do you|does your|can you|is your|are you|will you|have you)\b/i.test(trimmed)) {
    // Short questions are likely attestation
    if (trimmed.length < 150) {
      return true;
    }
  }

  // IS attestation - confirm/certify/acknowledge patterns
  if (/\b(confirm that|certify that|acknowledge that|agree to|accept the)\b/i.test(lower)) {
    return true;
  }

  // IS attestation - comply with requirement
  if (/\b(do you comply|will you comply|can you comply|confirm.*compliance)\b/i.test(lower)) {
    return true;
  }

  // Default: not attestation
  return false;
}

/**
 * Extract word limit from requirement text
 */
function extractWordLimit(text: string): number | null {
  // Patterns: "maximum 2500 words", "max 2,500 words", "2500 word limit", "(2500 words)"
  const patterns = [
    /\b(?:max(?:imum)?|limit)\s*[:\-]?\s*(\d[\d,]*)\s*words?\b/i,
    /\b(\d[\d,]*)\s*words?\s*(?:max(?:imum)?|limit)\b/i,
    /\((\d[\d,]*)\s*words?\)/i,
    /\bword\s*(?:count|limit)\s*[:\-]?\s*(\d[\d,]*)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
  }

  return null;
}

/**
 * Extract character limit from requirement text
 */
function extractCharacterLimit(text: string): number | null {
  // Patterns: "maximum 5000 characters", "5000 char limit"
  const patterns = [
    /\b(?:max(?:imum)?|limit)\s*[:\-]?\s*(\d[\d,]*)\s*(?:char(?:acter)?s?)\b/i,
    /\b(\d[\d,]*)\s*(?:char(?:acter)?s?)\s*(?:max(?:imum)?|limit)\b/i,
    /\((\d[\d,]*)\s*(?:char(?:acter)?s?)\)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
  }

  return null;
}

/**
 * Apply all heuristic classifications to a requirement
 */
function classifyRequirement(text: string): {
  type: RequirementType;
  isMandatory: boolean;
  domainContext: 'FEATURE' | 'PROCESS' | 'LEGAL';
  isAttestation: boolean;
  wordLimit: number | null;
  characterLimit: number | null;
} {
  return {
    type: classifyType(text),
    isMandatory: classifyMandatory(text),
    domainContext: classifyDomain(text),
    isAttestation: classifyAttestation(text),
    wordLimit: extractWordLimit(text),
    characterLimit: extractCharacterLimit(text),
  };
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

  // Add line numbers to document for reference-based extraction
  const { numberedText, lines } = addLineNumbers(documentText);
  console.log(`[extract] Document has ${lines.length} lines`);

  try {
    // Detect document sections to help LLM know what to expect
    const sectionSummary = detectDocumentSections(documentText);
    console.log(`[extract] Document sections detected: ${sectionSummary || 'none'}`);

    // Build user message with line-numbered document
    // Include section summary to ensure complete extraction
    let userMessage = `Please extract all requirements and questions from this RFP document. Use line numbers (L1, L2, etc.) to reference where each requirement is located.`;

    if (sectionSummary) {
      userMessage += `\n\nIMPORTANT - DOCUMENT SECTIONS TO EXTRACT:\n${sectionSummary}\n\nYou MUST extract requirements from ALL of these sections. Do NOT stop early - extract to the very end of the document.\n\n`;
    }

    userMessage += `\n\n${numberedText}`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 16384,
    });

    const content = response.choices[0]?.message?.content;
    const finishReason = response.choices[0]?.finish_reason;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Check for truncation
    if (finishReason === 'length') {
      console.warn('[extract] WARNING: Response may have been truncated');
    }

    const rawResult = JSON.parse(content) as CompactResult;
    const elapsed = Date.now() - startTime;

    console.log(`[extract] Raw extraction: ${rawResult.r?.length || 0} requirements in ${elapsed}ms`);
    console.log(`[extract] Tokens used: ${response.usage?.total_tokens || 'unknown'}`);
    console.log(`[extract] Output tokens: ${response.usage?.completion_tokens || 'unknown'}`);

    // Convert compact array format to full requirements
    // Format: [startLine, endLine, section, sectionGroup]
    // Classification is done via heuristics in post-processing
    let requirements: ExtractedRequirement[] = (rawResult.r || []).map((arr, idx) => {
      const [startLine, endLine, section, sectionGroup] = arr;

      const text = extractTextFromLines(lines, startLine, endLine);

      if (!text && startLine && endLine) {
        console.warn(`[extract] Empty text for requirement ${idx}: lines ${startLine}-${endLine}`);
      }

      // Apply heuristic classification based on extracted text
      const classification = classifyRequirement(text);

      return {
        section: section || null,
        sectionGroup: sectionGroup || null,
        text,
        type: classification.type,
        isMandatory: classification.isMandatory,
        domainContext: classification.domainContext,
        wordLimit: classification.wordLimit,
        characterLimit: classification.characterLimit,
        isAttestation: classification.isAttestation,
      };
    });

    // Filter out any empty requirements (bad line references)
    const beforeFilter = requirements.length;
    requirements = requirements.filter(req => req.text.length > 0);
    if (beforeFilter !== requirements.length) {
      console.log(`[extract] Filtered ${beforeFilter - requirements.length} empty requirements from bad line refs`);
    }

    // ==========================================================================
    // POST-PROCESSING PIPELINE (from main app)
    // ==========================================================================

    console.log('[extract] Applying post-processing pipeline...');

    // Step 1: Validate types and apply heuristic corrections
    requirements = requirements.map(req => ({
      ...req,
      type: correctQuantitativeType(req.text, validateRequirementType(req.type)),
    }));

    // Step 2: Split concatenated requirements
    requirements = splitConcatenatedRequirementsPostProcess(requirements);

    // Step 3: Reclassify section headers
    reclassifySectionHeaders(requirements);

    // Step 4: Enrich section data
    enrichSectionData(requirements, documentText);

    console.log(`[extract] Post-processing complete: ${requirements.length} requirements`);

    // Validate section coverage
    const warnings: string[] = [];
    const extractedSections = new Map<string, number>();
    for (const req of requirements) {
      if (req.section) {
        // Extract the X.Y part from X.Y.Z
        const match = req.section.match(/^(\d+\.\d+)/);
        if (match) {
          const key = match[1];
          extractedSections.set(key, (extractedSections.get(key) || 0) + 1);
        }
      }
    }

    // Check for potentially missing sections by comparing with detected structure
    const expectedPattern = /\b(\d+)\.(\d+)\.(\d+)\b/g;
    const expectedSections = new Map<string, number>();
    let expMatch;
    while ((expMatch = expectedPattern.exec(documentText)) !== null) {
      const key = `${expMatch[1]}.${expMatch[2]}`;
      expectedSections.set(key, (expectedSections.get(key) || 0) + 1);
    }

    // Find sections with significant gaps
    for (const [section, expectedCount] of expectedSections) {
      const actualCount = extractedSections.get(section) || 0;
      if (actualCount < expectedCount * 0.5) { // Less than 50% extracted
        warnings.push(`Section ${section}: extracted ${actualCount} of ~${expectedCount} expected items`);
      }
    }

    if (warnings.length > 0) {
      console.warn('[extract] COVERAGE WARNINGS:');
      warnings.forEach(w => console.warn(`  - ${w}`));
    }

    console.log(`[extract] Final count: ${requirements.length} requirements from ${extractedSections.size} subsections`);

    return {
      deadline: rawResult.d || null,
      deadlineText: rawResult.dt || null,
      requirements,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    console.error(`[extract] Failed after ${elapsed}ms:`, error);
    throw error;
  }
}
