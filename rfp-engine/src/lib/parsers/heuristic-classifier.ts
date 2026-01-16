/**
 * Heuristic Classifier for RFP Requirements
 *
 * Classifies requirement type and mandatory status using pattern matching.
 * This provides instant classification without API calls, with confidence scores
 * to indicate when LLM refinement might be beneficial.
 *
 * Part of the Hybrid Heuristic + LLM architecture.
 */

import { RequirementType } from "../constants";

// =============================================================================
// TYPES
// =============================================================================

export interface TypeClassification {
  type: RequirementType;
  confidence: number; // 0-100
  matchedPattern?: string; // For debugging
}

export interface MandatoryClassification {
  isMandatory: boolean;
  confidence: number; // 0-100
  matchedPattern?: string; // For debugging
}

// =============================================================================
// TYPE CLASSIFICATION PATTERNS
// =============================================================================

interface TypePattern {
  type: RequirementType;
  priority: number; // Higher = checked first (more specific patterns)
  patterns: RegExp[];
}

/**
 * Type patterns ordered by priority (highest first).
 * Higher priority patterns are more specific and should be checked first.
 */
const TYPE_PATTERNS: TypePattern[] = [
  // STAFFING - Highest priority, very specific patterns
  {
    type: "STAFFING",
    priority: 100,
    patterns: [
      /\b(staff(ing)?|personnel|team\s+member|FTE|employee|human\s+resource)\b/i,
      /\b(resume|CV|curriculum\s+vitae|bio(graphy)?)\b/i,
      /\bprovide.{0,30}(name|contact|title|role).{0,20}(staff|team|personnel|manager|lead)/i,
      /\b(project\s+manager|team\s+lead|account\s+manager|coordinator|specialist)\b.*\b(name|contact|assign)/i,
      /\bkey\s+(staff|personnel|team\s+member)/i,
      /\borganizational?\s+chart/i,
    ],
  },

  // REFERENCE_BASED - High priority, specific patterns
  {
    type: "REFERENCE_BASED",
    priority: 95,
    patterns: [
      /\b(client|customer)\s+reference/i,
      /\breference.{0,20}(client|customer|contact)/i,
      /\bcase\s+stud(y|ies)/i,
      /\bsimilar\s+(project|engagement|contract|work)/i,
      /\bpast\s+performance/i,
      /\bprior\s+(experience|work|project)/i,
      /\bportfolio/i,
      /\bprovide.{0,30}(example|sample).{0,20}(project|work|engagement)/i,
      /\blist.{0,20}(client|customer|project).{0,20}(similar|comparable|relevant)/i,
    ],
  },

  // EVIDENCE_BASED - High priority, documentation requests
  {
    type: "EVIDENCE_BASED",
    priority: 90,
    patterns: [
      /\b(attach|upload|include|submit|provide).{0,30}(copy|copies|proof|evidence|documentation)/i,
      /\b(attach|upload|include|submit|provide).{0,30}(certificate|certification|license|permit)/i,
      /\b(ISO|SOC|SOC2|HIPAA|PCI|GDPR|FedRAMP)\s*[-\s]?\d*/i,
      /\bcertificate\s+of\s+(insurance|compliance|incorporation)/i,
      /\bproof\s+of\s+(insurance|compliance|registration|bonding)/i,
      /\bfinancial\s+statement/i,
      /\baudit(ed)?\s+(report|statement|financial)/i,
      /\bW-?9\b/i,
    ],
  },

  // QUANTITATIVE - Financial/numeric requests
  {
    type: "QUANTITATIVE",
    priority: 85,
    patterns: [
      /\$\s*[\d,]+/,  // Dollar amounts
      /\b(price|pricing|cost|fee|rate|budget|amount|total)\s*(for|of|per|breakdown)?/i,
      /\bhow\s+much\b/i,
      /\bhow\s+many\b/i,
      /\bnumber\s+of\b/i,
      /\bquantity\b/i,
      /\bpercentage\b|\b%\b/i,
      /\bprovide.{0,20}(breakdown|estimate|quote|bid|proposal)\b/i,
      /\b(hourly|daily|weekly|monthly|annual)\s+rate/i,
      /\bunit\s+price/i,
    ],
  },

  // PROCEDURAL - Confirmations and acknowledgments
  {
    type: "PROCEDURAL",
    priority: 75,
    patterns: [
      /^(please\s+)?(confirm|acknowledge|agree|accept|certify|attest)\b/i,
      /\bconfirm\s+(that|your|you|receipt|acceptance|compliance)/i,
      /\backnowledge\s+(that|your|you|receipt|understanding)/i,
      /\bsign(ed|ature)?\s*(and\s+)?(return|submit|date)/i,
      /\bexecute.{0,20}(agreement|contract|form)/i,
      /\binitial\s+(here|each|all)/i,
    ],
  },

  // CONTEXTUAL - Background, instructions, warnings (not questions)
  {
    type: "CONTEXTUAL",
    priority: 70,
    patterns: [
      /^(this\s+section|the\s+following|note\s+that|note:|background|introduction|overview)\b/i,
      /\bfailure\s+to.{0,40}(may|will|shall)\s+(result|cause|lead)/i,
      /\bshall\s+be\s+(submitted|received|delivered|provided)\s+(by|to|on|before)/i,
      /\bmust\s+be\s+(submitted|received|delivered|provided)\s+(by|to|on|before)/i,
      /\bproposal(s)?\s+(shall|must|should)\s+(be|include|contain)/i,
      /\bresponse(s)?\s+(shall|must|should)\s+(be|include|contain)/i,
      /\bvendor(s)?\s+(shall|must|should)\s+(ensure|provide|submit)/i,
      /\bdeadline\s*(for|is|:)/i,
      /\bdue\s+date\s*(is|:)/i,
      /\bsubmission\s+(deadline|date|requirement)/i,
    ],
  },

  // DECLARATIVE - Yes/no questions (very common in RFPs)
  {
    type: "DECLARATIVE",
    priority: 55,
    patterns: [
      /^does\s+(the|your|it|this)/i,
      /^do\s+you(r)?\s/i,
      /^can\s+(the|your|you|it|this|users?|a|an)/i,
      /^is\s+(the|your|it|this|there|a|an)\s/i,
      /^are\s+(the|your|there|these|those|you)/i,
      /^will\s+(the|your|it|this|you)/i,
      /^would\s+(the|your|it|this|you)/i,
      /^has\s+(the|your|it|this)/i,
      /^have\s+you(r)?\s/i,
      /^shall\s+(the|your)/i,
      // Questions ending with ? that start with these patterns
      /^(does|do|can|is|are|will|would|has|have)\b.+\?$/i,
    ],
  },

  // DESCRIPTIVE - Open-ended questions (default for most questions)
  {
    type: "DESCRIPTIVE",
    priority: 45,
    patterns: [
      /^describe\b/i,
      /^explain\b/i,
      /^outline\b/i,
      /^detail\b/i,
      /^discuss\b/i,
      /^elaborate\b/i,
      /^(how|what|why|when|where)\s+(does|do|is|are|will|would|can|could|should)/i,
      /^please\s+(describe|explain|provide|detail|outline)/i,
      /^provide\s+(a\s+)?(description|explanation|overview|summary|detail)/i,
      /\bplease\s+explain\b/i,
      /\bdescribe\s+(how|what|your|the)/i,
    ],
  },
];

// Sort patterns by priority (highest first)
const SORTED_TYPE_PATTERNS = [...TYPE_PATTERNS].sort((a, b) => b.priority - a.priority);

// =============================================================================
// MANDATORY CLASSIFICATION PATTERNS
// =============================================================================

const MANDATORY_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\bshall\b/i, confidence: 90 },
  { pattern: /\bmust\b/i, confidence: 90 },
  { pattern: /\brequired\b/i, confidence: 85 },
  { pattern: /\bmandatory\b/i, confidence: 95 },
  { pattern: /\bwill\s+be\s+(evaluated|scored|assessed|rated)/i, confidence: 80 },
  { pattern: /\bnon-?negotiable\b/i, confidence: 95 },
  { pattern: /\bessential\b/i, confidence: 75 },
  { pattern: /\bcritical\b/i, confidence: 70 },
  { pattern: /\bnecessary\b/i, confidence: 70 },
];

const OPTIONAL_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\boptional\b/i, confidence: 95 },
  { pattern: /\bmay\b/i, confidence: 70 },
  { pattern: /\bif\s+(applicable|available|desired|possible)/i, confidence: 85 },
  { pattern: /\bpreferred\b/i, confidence: 80 },
  { pattern: /\brecommended\b/i, confidence: 75 },
  { pattern: /\bdesired\b/i, confidence: 80 },
  { pattern: /\bnot\s+required\b/i, confidence: 95 },
  { pattern: /\bnice\s+to\s+have\b/i, confidence: 90 },
  { pattern: /\bbonus\b/i, confidence: 85 },
  { pattern: /\bwhere\s+(applicable|possible)/i, confidence: 80 },
];

// Section header patterns that indicate mandatory/optional for all items in section
const SECTION_MANDATORY_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\bmandatory\s+(requirement|section|item)/i, confidence: 95 },
  { pattern: /\brequired\s+(requirement|section|item)/i, confidence: 90 },
  { pattern: /\bmust\s+have/i, confidence: 85 },
];

const SECTION_OPTIONAL_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\boptional\s+(requirement|section|item)/i, confidence: 95 },
  { pattern: /\bpreferred\s+(qualification|requirement)/i, confidence: 90 },
  { pattern: /\bnice\s+to\s+have/i, confidence: 90 },
  { pattern: /\bdesired\s+(qualification|requirement)/i, confidence: 85 },
];

// =============================================================================
// CLASSIFICATION FUNCTIONS
// =============================================================================

/**
 * Classify the type of a requirement using pattern matching.
 *
 * Returns a type classification with confidence score.
 * Higher confidence = more certain the pattern match is correct.
 */
export function classifyTypeHeuristically(text: string): TypeClassification {
  const trimmed = text.trim();

  // Check patterns in priority order
  for (const { type, priority, patterns } of SORTED_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        // Base confidence from priority, plus bonus for strong matches
        const baseConfidence = Math.min(95, 50 + (priority / 2));

        // Boost confidence if pattern matches at start of text
        const startsWithMatch = pattern.source.startsWith("^") ? 10 : 0;

        const confidence = Math.min(98, baseConfidence + startsWithMatch);

        return {
          type,
          confidence,
          matchedPattern: pattern.source.substring(0, 50),
        };
      }
    }
  }

  // No pattern matched - use defaults based on text characteristics
  if (trimmed.endsWith("?")) {
    // Questions default to DESCRIPTIVE
    return {
      type: "DESCRIPTIVE",
      confidence: 45,
      matchedPattern: "ends with ?",
    };
  }

  // Non-questions without patterns default to CONTEXTUAL with low confidence
  return {
    type: "CONTEXTUAL",
    confidence: 30,
    matchedPattern: "no match - default",
  };
}

/**
 * Classify whether a requirement is mandatory using pattern matching.
 *
 * Checks both the requirement text and the section title (if provided)
 * for mandatory/optional indicators.
 */
export function classifyMandatoryHeuristically(
  text: string,
  sectionTitle?: string
): MandatoryClassification {
  const trimmedText = text.trim().toLowerCase();
  const sectionLower = sectionTitle?.toLowerCase() || "";

  // Check section title first (higher confidence - applies to all items in section)
  if (sectionTitle) {
    for (const { pattern, confidence } of SECTION_OPTIONAL_PATTERNS) {
      if (pattern.test(sectionLower)) {
        return {
          isMandatory: false,
          confidence,
          matchedPattern: `section: ${pattern.source.substring(0, 30)}`,
        };
      }
    }

    for (const { pattern, confidence } of SECTION_MANDATORY_PATTERNS) {
      if (pattern.test(sectionLower)) {
        return {
          isMandatory: true,
          confidence,
          matchedPattern: `section: ${pattern.source.substring(0, 30)}`,
        };
      }
    }
  }

  // Check text for optional patterns first (they're more distinctive)
  for (const { pattern, confidence } of OPTIONAL_PATTERNS) {
    if (pattern.test(trimmedText)) {
      return {
        isMandatory: false,
        confidence,
        matchedPattern: pattern.source.substring(0, 30),
      };
    }
  }

  // Check text for mandatory patterns
  for (const { pattern, confidence } of MANDATORY_PATTERNS) {
    if (pattern.test(trimmedText)) {
      return {
        isMandatory: true,
        confidence,
        matchedPattern: pattern.source.substring(0, 30),
      };
    }
  }

  // Default: mandatory with moderate confidence
  // (Most RFP requirements are mandatory unless explicitly marked optional)
  return {
    isMandatory: true,
    confidence: 55,
    matchedPattern: "default - no explicit indicator",
  };
}

/**
 * Get a human-readable explanation for a type classification.
 */
export function explainTypeClassification(classification: TypeClassification): string {
  if (classification.confidence >= 90) {
    return `Strong match for ${classification.type}`;
  } else if (classification.confidence >= 70) {
    return `Good match for ${classification.type}`;
  } else if (classification.confidence >= 50) {
    return `Possible ${classification.type}`;
  } else {
    return `Uncertain - defaulted to ${classification.type}`;
  }
}

/**
 * Determine if a classification should be flagged for LLM refinement.
 */
export function needsRefinement(
  typeClassification: TypeClassification,
  mandatoryClassification: MandatoryClassification,
  threshold: number = 70
): boolean {
  return (
    typeClassification.confidence < threshold ||
    mandatoryClassification.confidence < threshold
  );
}
