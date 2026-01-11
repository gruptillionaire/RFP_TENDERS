/**
 * Layer 2: Domain Context System
 * Controls tone, guardrails, allowed language, and risk handling
 * Works alongside Layer 1 (RequirementType) which controls formatting
 */

export type DomainContext = "FEATURE" | "PROCESS" | "LEGAL";

// =============================================================================
// DOMAIN DETECTION KEYWORDS
// =============================================================================

const LEGAL_KEYWORDS = [
  "data", "regulation", "compliance", "GDPR", "privacy", "terms",
  "liability", "security", "certification", "audit", "ISO", "SOC",
  "HIPAA", "PCI", "breach", "incident", "retention", "deletion",
  "processor", "controller", "DPA", "SLA", "indemnity", "warranty",
  "confidential", "NDA", "contract", "agreement", "legal", "policy"
];

const PROCESS_KEYWORDS = [
  "how", "process", "approach", "steps", "methodology", "procedure",
  "workflow", "timeline", "phase", "stage", "onboarding", "implementation",
  "migration", "transition", "training", "support", "escalation",
  "deployment", "rollout", "project", "plan", "schedule"
];

// =============================================================================
// DOMAIN DETECTION FUNCTION
// =============================================================================

/**
 * Detect the domain context of a requirement using heuristic keyword matching
 * Legal takes precedence due to risk, then Process, then Feature (default)
 */
export function detectDomainContext(requirementText: string): DomainContext {
  const text = requirementText.toLowerCase();
  const words = text.split(/\s+/);

  // Count keyword matches
  const legalScore = LEGAL_KEYWORDS.filter(kw =>
    words.some(word => word.includes(kw.toLowerCase()))
  ).length;

  const processScore = PROCESS_KEYWORDS.filter(kw =>
    words.some(word => word.includes(kw.toLowerCase()))
  ).length;

  // Legal takes precedence (higher risk)
  if (legalScore >= 2) return "LEGAL";

  // Process if keywords match or starts with "how"
  if (processScore >= 2 || text.startsWith("how ") || text.includes("how do") || text.includes("how would")) {
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
