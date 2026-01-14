/**
 * Layer 2: Domain Context System
 * Controls tone, guardrails, allowed language, and risk handling
 * Works alongside Layer 1 (RequirementType) which controls formatting
 */

export type DomainContext = "FEATURE" | "PROCESS" | "LEGAL";

// =============================================================================
// DOMAIN DETECTION KEYWORDS
// =============================================================================

// Note: Use word boundary matching to avoid false positives (e.g., "database" matching "data")
const LEGAL_KEYWORDS = [
  // Removed generic "data" - causes false positives with "database", "updating"
  // Removed "SLA" - better handled by QUANTITATIVE requirement type
  "regulation", "compliance", "GDPR", "privacy", "terms",
  "liability", "security", "certification", "audit", "ISO", "SOC",
  "HIPAA", "PCI", "breach", "incident", "retention", "deletion",
  "processor", "controller", "DPA", "indemnity", "warranty",
  "confidential", "NDA", "contract", "agreement", "legal", "policy",
  // Added more specific legal terms
  "indemnification", "governing law", "jurisdiction", "subprocessor",
  "data protection", "data processing", "personal data"
];

const PROCESS_KEYWORDS = [
  "how", "process", "approach", "steps", "methodology", "procedure",
  "workflow", "timeline", "phase", "stage", "onboarding", "implementation",
  "migration", "transition", "training", "support", "escalation",
  "deployment", "rollout", "project", "plan", "schedule",
  "documentation", "testing", "acceptance", "deliverable",
  // Additional process terms - governance & handoffs
  "governance", "handover", "handoff", "setup", "configuration",
  // Lifecycle & methodology terms
  "lifecycle", "sprint", "iteration", "agile", "waterfall", "scrum",
  // Project milestones
  "kickoff", "kick-off", "milestone", "checkpoint", "go-live", "cutover",
  // Management processes
  "change management", "risk management", "quality assurance",
  // Sequence indicators
  "sequence", "order", "flow"
];

// =============================================================================
// DOMAIN DETECTION FUNCTION
// =============================================================================

/**
 * Check if a keyword matches in text using word boundaries
 * This prevents "database" from matching "data", etc.
 */
function keywordMatches(text: string, keyword: string): boolean {
  // For multi-word keywords (e.g., "data protection"), use simple includes
  if (keyword.includes(" ")) {
    return text.includes(keyword.toLowerCase());
  }
  // For single-word keywords, use word boundary matching
  const regex = new RegExp(`\\b${keyword}\\b`, 'i');
  return regex.test(text);
}

// Strong legal terms that trigger LEGAL domain with just 1 match
// These are highly specific legal/compliance terms
const STRONG_LEGAL_TERMS = [
  "gdpr", "hipaa", "pci", "dpa", "nda", "indemnity", "indemnification",
  "liability", "subprocessor", "data controller", "data processor"
];

// Patterns that strongly indicate PROCESS domain (verb + process noun)
// These override the keyword count requirement
const STRONG_PROCESS_PATTERNS = [
  /\b(describe|explain|outline|detail|provide)\s+(your|the|a)?\s*(process|approach|methodology|steps|timeline|procedure|workflow)/i,
  /\b(how)\s+(do|does|will|would|can|should)\s+(you|your|the|we)/i,
  /\bhow\s+(you|your|the|we)\s+(will|would|can|handle|manage|approach)/i,
  /\b(what)\s+(is|are)\s+(your|the)\s*(process|approach|methodology|procedure|steps)/i,
];

/**
 * Detect the domain context of a requirement using heuristic keyword matching
 * Legal takes precedence due to risk, then Process, then Feature (default)
 */
export function detectDomainContext(requirementText: string): DomainContext {
  const text = requirementText.toLowerCase();

  // STEP 1: Check for strong legal terms first (single match = LEGAL)
  // These are highly specific legal/compliance terms
  if (STRONG_LEGAL_TERMS.some(term => keywordMatches(text, term))) {
    return "LEGAL";
  }

  // Count keyword matches using word boundary matching
  const legalScore = LEGAL_KEYWORDS.filter(kw => keywordMatches(text, kw)).length;
  const processScore = PROCESS_KEYWORDS.filter(kw => keywordMatches(text, kw)).length;

  // STEP 2: Legal with 2+ keywords (lowered from 3 - legal terms are specific)
  if (legalScore >= 2) return "LEGAL";

  // STEP 3: Check for strong process patterns (verb + process noun combinations)
  // These override the keyword count requirement
  if (STRONG_PROCESS_PATTERNS.some(pattern => pattern.test(text))) {
    return "PROCESS";
  }

  // STEP 4: Process if ANY keyword matches (lowered from 2 - process keywords are specific)
  // Also check for "how" appearing anywhere in the text (not just at start)
  const hasHowPattern =
    text.startsWith("how ") ||
    text.includes(" how ") ||
    text.includes("how you") ||
    text.includes("how your") ||
    text.includes("how the") ||
    text.includes("how will") ||
    text.includes("how would") ||
    text.includes("how do") ||
    text.includes("how does") ||
    text.includes("how can");

  if (processScore >= 1 || hasHowPattern) {
    return "PROCESS";
  }

  // Default to FEATURE
  return "FEATURE";
}

// =============================================================================
// DOMAIN RULES INTERFACE
// =============================================================================

export interface DomainRules {
  allowedAdjectives: string[];
  forbiddenTerms: string[];
  requiredElements: string[];
  formatGuidance: string;
  disclaimers: string[];
  requiresManualReview: boolean;
}

// =============================================================================
// DOMAIN-SPECIFIC RULES
// =============================================================================

export const DOMAIN_RULES: Record<DomainContext, DomainRules> = {
  FEATURE: {
    allowedAdjectives: ["comprehensive", "robust", "flexible", "configurable", "scalable", "modern", "extensive"],
    forbiddenTerms: ["guaranteed", "always", "never", "best", "industry-leading", "unmatched", "100%"],
    requiredElements: [],
    formatGuidance: `FEATURE DOMAIN - Persuasive but accurate:
- Use bullets or short paragraphs
- Moderate descriptive freedom allowed
- Focus on what exists and why it's useful
- Structure without verbosity
- Mildly persuasive, no exaggeration
- No legal or operational risk`,
    disclaimers: [],
    requiresManualReview: false,
  },

  PROCESS: {
    allowedAdjectives: ["typical", "standard", "structured", "documented", "established"],
    forbiddenTerms: ["quick", "seamless", "effortless", "instant", "guaranteed timeline", "immediately", "fast"],
    requiredElements: ["timeframe (as range)", "customer involvement mention", "step structure"],
    formatGuidance: `PROCESS DOMAIN - Step-by-step clarity:
- MUST use numbered steps or clear headings
- MUST include timeframe as RANGES (e.g., "2-4 weeks" NOT "2 weeks")
- MUST mention customer responsibilities or involvement
- Sounds operationally competent
- Reduces fear through clear sequence
- NEVER use vague terms like "quick", "seamless", "effortless"
- Include what the customer needs to provide`,
    disclaimers: ["Actual timelines may vary based on scope and customer readiness."],
    requiresManualReview: false,
  },

  LEGAL: {
    allowedAdjectives: ["documented", "defined", "specified", "contractual", "established"],
    forbiddenTerms: [
      "guarantee", "certify", "warrant", "promise", "ensure compliance",
      "fully compliant", "100% secure", "bulletproof", "never", "always",
      "complete protection", "absolute"
    ],
    requiredElements: ["role clarification (processor/controller)", "reference to contracts/agreements"],
    formatGuidance: `LEGAL DOMAIN - Restrained and precise:
- Be precise, restrained, and factual
- State data role clearly (e.g., "acts as data processor")
- NEVER claim compliance guarantees
- Reference contractual documents (DPA, MSA, SLA)
- Use "designed to support" NOT "ensures compliance"
- Use "subject to agreement terms" for commitments
- Precise, boring, safe - exactly what legal teams want
- Include reference to where detailed terms are defined`,
    disclaimers: [
      "Compliance responsibilities are shared between parties as defined in the applicable agreement.",
      "Certification and compliance details available upon request under appropriate confidentiality terms."
    ],
    requiresManualReview: true,
  },
};

// =============================================================================
// PROMPT MODIFIER GENERATOR
// =============================================================================

/**
 * Generate the domain-specific prompt modifier to append to the base prompt
 */
export function getDomainPromptModifier(domain: DomainContext): string {
  const rules = DOMAIN_RULES[domain];

  return `
=== DOMAIN CONTEXT: ${domain} ===
${rules.formatGuidance}

ALLOWED ADJECTIVES: ${rules.allowedAdjectives.join(", ")}
FORBIDDEN TERMS (NEVER USE): ${rules.forbiddenTerms.join(", ")}
${rules.requiredElements.length > 0 ? `REQUIRED IN RESPONSE: ${rules.requiredElements.join(", ")}` : ""}
${rules.disclaimers.length > 0 ? `MUST INCLUDE THIS DISCLAIMER: "${rules.disclaimers[0]}"` : ""}
=== END DOMAIN CONTEXT ===
`;
}

// =============================================================================
// POST-PROCESSING: APPLY DOMAIN RULES
// =============================================================================

/**
 * Apply domain-specific post-processing rules to a draft
 */
export function applyDomainRules(draft: string, domain: DomainContext): string {
  const rules = DOMAIN_RULES[domain];
  let result = draft;

  // Remove forbidden terms (replace with placeholder or empty)
  for (const term of rules.forbiddenTerms) {
    const pattern = new RegExp(`\\b${term}\\b`, 'gi');
    // For legal domain, flag removed terms
    if (domain === "LEGAL") {
      result = result.replace(pattern, '[REVIEW: term removed]');
    } else {
      result = result.replace(pattern, '');
    }
  }

  // Add disclaimer for Legal domain if not present
  if (domain === "LEGAL" && rules.disclaimers.length > 0) {
    const disclaimer = rules.disclaimers[0];
    if (!result.includes(disclaimer) && !result.includes("[DRAFT]")) {
      result = result.trim() + "\n\n" + disclaimer;
    }
  }

  // Add disclaimer for Process domain if not present
  if (domain === "PROCESS" && rules.disclaimers.length > 0) {
    const disclaimer = rules.disclaimers[0];
    if (!result.includes(disclaimer) && !result.includes("may vary") && !result.includes("[DRAFT]")) {
      result = result.trim() + "\n\n" + disclaimer;
    }
  }

  // Clean up multiple horizontal spaces (preserve newlines)
  result = result.replace(/[^\S\n]+/g, ' ');
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

// =============================================================================
// EXPORTS FOR CONSTANTS
// =============================================================================

export const DOMAIN_CONTEXTS = ["FEATURE", "PROCESS", "LEGAL"] as const;
