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

REQUIREMENT TYPES:
- CONTEXTUAL: Background information, context-setting statements that do NOT require a response
  INDICATORS - classify as CONTEXTUAL if ANY of these apply:
  • Describes what the organization does or who they are
  • States facts about the RFP issuer (location, size, history)
  • Provides background context without asking for anything
  • No implied action, question, or requirement
  • Introductory paragraphs explaining the RFP purpose
  Examples: "The Treasurer of X County is soliciting proposals for...", "ABC Organization serves 50,000 customers annually", "This RFP is issued to obtain competitive bids for..."

- PROCEDURAL: Simple confirmations, acknowledgments, deadlines, administrative requirements
  Examples: "Confirm receipt of this RFP", "Submit by [date]", "Sign attached form", "Provide contact details", "Responses should be submitted by email by..."

- DECLARATIVE: Compliance statements requiring a clear yes/no with brief justification
  Examples: "The vendor must comply with ISO 27001", "Confirm you accept the terms", "State your data protection policy", "Ensure all information requested is supplied"

- DESCRIPTIVE: Detailed explanations requiring comprehensive response
  INDICATORS - classify as DESCRIPTIVE if ANY of these apply:
  • Contains a comma-separated list of 3+ features/capabilities to address
  • Starts with "Please provide information on..."
  • Asks about platform/system capabilities or features
  • Requires listing or describing multiple items
  • Contains phrases like "ability to cover:", "capabilities for:", "support for:"

  Examples:
  • "Describe your approach to..."
  • "Explain your methodology for..."
  • "Provide details of your experience with..."
  • "Please provide information on the platform's ability to cover: [list of items]"
  • "Outline your proposed solution..."
  • Any requirement listing multiple features/capabilities to address

- EVIDENCE_BASED: Requirements asking for attachments, samples, copies, or documentation
  STRONG INDICATORS - classify as EVIDENCE_BASED if ANY:
  • Contains: "sample", "example", "specimen", "mock-up", "template"
  • Contains: "attach", "include", "submit", "upload", "enclose", "provide copy"
  • Contains: "certificate", "certification", "license", "insurance", "bond"
  • Contains: "evidence", "proof", "documentation of"
  • The response CANNOT be written - requires a FILE/ATTACHMENT
  Examples: "Include a sample of the monthly report", "Attach proof of insurance", "Submit evidence of compliance"

- QUANTITATIVE: Requirements asking for pricing, costs, metrics, SLAs, or numerical data
  INDICATORS:
  • Contains: "pricing", "cost", "price", "fee", "rate", "budget", "TCO", "ROI"
  • Contains: "SLA", "uptime", "percentage", "capacity", "volume", "quantity", "metrics"
  • Asks for numerical data, tables, or calculations
  Examples: "Provide detailed pricing breakdown", "List your SLA commitments", "What is your system capacity?"

- REFERENCE_BASED: Requirements asking for past performance, references, or client contacts
  INDICATORS:
  • Contains: "reference", "past performance", "similar project", "experience with"
  • Contains: "client", "customer", "contact information", "project example"
  • Asks for specific number of references
  Examples: "Provide 3 client references", "Describe similar projects completed", "List relevant experience"

- STAFFING: Requirements about team composition, personnel, or qualifications
  INDICATORS:
  • Contains: "personnel", "staff", "team", "resource", "FTE", "resume", "CV", "qualifications"
  • Contains: "project manager", "key personnel", "roles", "responsibilities", "org chart"
  • Asks for specific positions or skill requirements
  Examples: "Identify key personnel", "Provide team qualifications", "Describe your project team"

CLASSIFICATION PRIORITY (FIRST MATCH WINS):
1. If NO action/response required, just background info → CONTEXTUAL
2. If asks to attach/include/submit/upload a sample, copy, or document → EVIDENCE_BASED
3. If asks for certificates/evidence/proof/documentation → EVIDENCE_BASED
4. If asks for pricing, costs, fees, SLAs, numerical data → QUANTITATIVE
5. If asks for references, past performance, client contacts → REFERENCE_BASED
6. If asks for team, personnel, staff, qualifications → STAFFING
7. If contains 3+ comma-separated items OR asks for detailed explanation → DESCRIPTIVE
8. If yes/no compliance question with brief justification → DECLARATIVE
9. If administrative/deadline/submission → PROCEDURAL
10. When uncertain → DESCRIPTIVE

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

  const response = await openai.chat.completions.create({
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
  });

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
// POST-PROCESSING: BULLET POINT FORMATTING
// =============================================================================
function normalizeBulletFormatting(draft: string): string {
  let result = draft;
  // Ensure newline before first bullet after non-bullet text
  result = result.replace(/([^\n•\-\*])[ \t]*([•\-\*])/g, '$1\n\n$2');
  // Ensure newline after last bullet line before new paragraph
  result = result.replace(/([•\-\*][^\n]+\n)([A-Z])/g, '$1\n$2');
  // Clean excessive newlines
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
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
  content = normalizeBulletFormatting(content);

  // Add [DRAFT] tag to indicate this needs review
  return {
    draft: content.trim() + "\n\n[DRAFT]",
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
  return "DECLARATIVE"; // Default fallback
}

function validateDomainContext(domain: string | undefined): DomainContext | null {
  const validDomains: DomainContext[] = ["FEATURE", "PROCESS", "LEGAL"];
  if (domain && validDomains.includes(domain as DomainContext)) {
    return domain as DomainContext;
  }
  return null; // Will fallback to heuristic detection
}
