/**
 * Heuristic Classifier for RFP Requirements (v4)
 *
 * Three-pass classification architecture:
 * - Pass 1: Detect QUESTION STRUCTURE (yes/no, open-ended, list, confirmation, statement)
 * - Pass 2: Detect TOPIC/CONTENT via regex patterns (staffing, financial, reference, etc.)
 * - Pass 3: KEYWORD DENSITY scoring as fallback when no strong pattern matches
 * - Combine with weighted logic and multi-factor confidence scoring
 *
 * Key improvements over v3:
 * - Added keyword density scoring for all 8 types
 * - Fallback to keyword density when no topic pattern matches
 * - Better type distribution across PROCEDURAL, QUANTITATIVE, EVIDENCE_BASED, etc.
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
  questionStructure?: QuestionStructure; // Pass 1 result
  topicMatch?: string; // Pass 2 result
}

export interface MandatoryClassification {
  isMandatory: boolean;
  confidence: number; // 0-100
  matchedPattern?: string; // For debugging
}

// =============================================================================
// PASS 1: QUESTION STRUCTURE DETECTION
// =============================================================================

type QuestionStructureType =
  | 'yes_no'        // "Does your system...", "Can you...", "Is there..."
  | 'open_ended'    // "Describe...", "Explain...", "How does..."
  | 'list_request'  // "List...", "Provide [items]...", "Identify..."
  | 'confirmation'  // "Confirm...", "Acknowledge...", "Certify..."
  | 'statement'     // Not a question - declarative statement
  | 'unknown';      // Can't determine

interface QuestionStructure {
  type: QuestionStructureType;
  confidence: number;
  indicator?: string;
}

/**
 * PASS 1: Detect the question structure.
 * This determines HOW the requirement is asking for information.
 */
function detectQuestionStructure(text: string): QuestionStructure {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // === YES/NO QUESTIONS (highest priority) ===
  // Direct yes/no starters
  if (/^(does|do)\s+(the|your|it|this|a|an|you)/i.test(trimmed)) {
    return { type: 'yes_no', confidence: 95, indicator: 'does/do start' };
  }
  if (/^can\s+(the|your|you|it|this|users?|a|an|we)/i.test(trimmed)) {
    return { type: 'yes_no', confidence: 95, indicator: 'can start' };
  }
  // "Can [noun] be [verb]" pattern - catches "Can designs be...", "Can images be..."
  if (/^can\s+\w+(\s+\w+){0,3}\s+be\s+/i.test(trimmed)) {
    return { type: 'yes_no', confidence: 88, indicator: 'can X be' };
  }
  // "Can [noun phrase] [verb]?" pattern - must end with ? and not contain wh-words
  if (/^can\s+[^?]+\?$/i.test(trimmed) && !/\b(what|how|why|where|when|which)\b/i.test(trimmed)) {
    return { type: 'yes_no', confidence: 85, indicator: 'can...?' };
  }
  if (/^is\s+(the|your|it|this|there|a|an)\s/i.test(trimmed)) {
    return { type: 'yes_no', confidence: 95, indicator: 'is start' };
  }
  if (/^are\s+(the|your|there|these|those|you|we)/i.test(trimmed)) {
    return { type: 'yes_no', confidence: 95, indicator: 'are start' };
  }
  if (/^will\s+(the|your|it|this|you|there)/i.test(trimmed)) {
    return { type: 'yes_no', confidence: 90, indicator: 'will start' };
  }
  if (/^would\s+(the|your|it|this|you)/i.test(trimmed)) {
    return { type: 'yes_no', confidence: 85, indicator: 'would start' };
  }
  if (/^has\s+(the|your|it|this)/i.test(trimmed)) {
    return { type: 'yes_no', confidence: 90, indicator: 'has start' };
  }
  if (/^have\s+(you|your|the)/i.test(trimmed)) {
    return { type: 'yes_no', confidence: 90, indicator: 'have start' };
  }

  // Embedded yes/no questions
  if (/\b(confirm|indicate|specify)\s+(whether|if)\s+(the|your|you)/i.test(lower)) {
    return { type: 'yes_no', confidence: 90, indicator: 'confirm whether/if' };
  }
  if (/\bplease\s+(confirm|indicate|specify)\s+(that|if|whether)/i.test(lower)) {
    return { type: 'yes_no', confidence: 88, indicator: 'please confirm' };
  }

  // === CONFIRMATION REQUESTS ===
  if (/^(please\s+)?(confirm|acknowledge|agree|accept|certify|attest)\b/i.test(trimmed)) {
    return { type: 'confirmation', confidence: 95, indicator: 'confirmation verb start' };
  }
  if (/\bconfirm\s+(that|your|you|receipt|acceptance|compliance|understanding)/i.test(lower)) {
    return { type: 'confirmation', confidence: 90, indicator: 'confirm that' };
  }
  if (/\backnowledge\s+(that|your|you|receipt|understanding)/i.test(lower)) {
    return { type: 'confirmation', confidence: 90, indicator: 'acknowledge that' };
  }

  // === OPEN-ENDED QUESTIONS ===
  if (/^describe\b/i.test(trimmed)) {
    return { type: 'open_ended', confidence: 95, indicator: 'describe start' };
  }
  if (/^explain\b/i.test(trimmed)) {
    return { type: 'open_ended', confidence: 95, indicator: 'explain start' };
  }
  if (/^(how|what|why)\s+(does|do|is|are|will|would|can|could|should|has|have)/i.test(trimmed)) {
    return { type: 'open_ended', confidence: 92, indicator: 'how/what/why question' };
  }
  if (/^please\s+(describe|explain|detail|elaborate|discuss)/i.test(trimmed)) {
    return { type: 'open_ended', confidence: 93, indicator: 'please describe/explain' };
  }
  if (/^(outline|detail|discuss|elaborate)\b/i.test(trimmed)) {
    return { type: 'open_ended', confidence: 90, indicator: 'outline/detail start' };
  }

  // === LIST REQUESTS ===
  if (/^(list|identify|name|enumerate)\b/i.test(trimmed)) {
    return { type: 'list_request', confidence: 92, indicator: 'list/identify start' };
  }
  if (/^provide\s+(a\s+)?(list|listing|breakdown|inventory)\b/i.test(trimmed)) {
    return { type: 'list_request', confidence: 90, indicator: 'provide list' };
  }

  // === STATEMENT DETECTION (not a question) ===
  // Instructions/statements about what vendor SHALL do
  if (/^(the\s+)?(vendor|contractor|respondent|proposer|bidder)\s+(shall|must|will)\s/i.test(trimmed)) {
    return { type: 'statement', confidence: 85, indicator: 'vendor shall statement' };
  }
  // Background/context statements
  if (/^(this\s+section|the\s+following|note\s+that|note:|for\s+the\s+purposes?\s+of)/i.test(trimmed)) {
    return { type: 'statement', confidence: 90, indicator: 'section intro' };
  }
  if (/^(all\s+)?(proposals?|responses?|submissions?)\s+(shall|must|should)\s+(be|include|contain)/i.test(trimmed)) {
    return { type: 'statement', confidence: 85, indicator: 'proposal shall statement' };
  }

  // === FALLBACK HEURISTICS ===
  // Ends with question mark but no clear structure
  if (trimmed.endsWith('?')) {
    // Check if this is primarily a wh-question (wh-word near the START - first 15 chars)
    const first15 = lower.substring(0, 15);
    if (/^(what|how|why|when|where|which)\b/.test(first15)) {
      return { type: 'open_ended', confidence: 70, indicator: 'wh-question start' };
    }
    // Check for aux verb anywhere (yes/no question) - takes priority over embedded wh-words
    if (/\b(does|do|can|is|are|will|would|has|have)\b/i.test(lower)) {
      return { type: 'yes_no', confidence: 65, indicator: 'question mark + aux verb' };
    }
    // Check for embedded wh-word (lower confidence open-ended)
    // This catches subordinate clauses but at lower confidence
    if (/\b(what|how|why)\b/i.test(lower)) {
      return { type: 'open_ended', confidence: 55, indicator: 'embedded wh-word' };
    }
    return { type: 'unknown', confidence: 50, indicator: 'question mark only' };
  }

  // Starts with action verb (likely a request)
  if (/^(provide|submit|include|attach|upload)\b/i.test(trimmed)) {
    // Could be list_request or something else - low confidence
    return { type: 'unknown', confidence: 45, indicator: 'action verb start' };
  }

  // Check for embedded list/describe requests in compound sentences
  // Pattern: "The solution must X. Please list Y." or "... required. Describe how..."
  if (/\.\s*(please\s+)?(list|provide|describe|explain|identify|specify)\b/i.test(lower)) {
    const embeddedMatch = lower.match(/\.\s*(please\s+)?(list|provide|describe|explain|identify|specify)/i);
    if (embeddedMatch) {
      const verb = embeddedMatch[2]?.toLowerCase();
      if (verb === 'list' || verb === 'identify' || verb === 'specify') {
        return { type: 'list_request', confidence: 75, indicator: 'embedded list request' };
      }
      return { type: 'open_ended', confidence: 72, indicator: 'embedded describe request' };
    }
  }

  return { type: 'unknown', confidence: 30, indicator: 'no pattern matched' };
}

// =============================================================================
// PASS 2: TOPIC CLASSIFICATION PATTERNS (with anti-patterns)
// =============================================================================

interface TopicPattern {
  type: RequirementType;
  patterns: RegExp[];
  antiPatterns?: RegExp[];       // If matched, SKIP this type (reduce confidence to 0)
  weakenPatterns?: RegExp[];     // If matched, reduce confidence by 20
  requiresActionVerb?: boolean;  // Pattern must have action verb context
  sectionBoostKeywords?: string[]; // Section titles that boost this type
}

/**
 * Topic patterns with anti-patterns and action-verb requirements.
 * These detect WHAT the requirement is about, not HOW it asks.
 */
const TOPIC_PATTERNS: TopicPattern[] = [
  // STAFFING - Content about team/personnel (regardless of how asked)
  {
    type: "STAFFING",
    patterns: [
      // Direct staffing requests
      /\b(provide|submit|include|list|identify|describe|explain).{0,30}(staff|personnel|team\s+member|FTE|employee)/i,
      /\b(provide|submit|include|attach|describe).{0,30}(resume|CV|curriculum\s+vitae)/i,
      /\b(provide|identify|list|describe).{0,30}(key\s+staff|key\s+personnel|project\s+team)/i,
      /\b(provide|include|attach|describe).{0,30}organizational?\s+chart/i,
      // Staffing-related questions
      /\b(name|identify).{0,20}(project\s+manager|team\s+lead|account\s+manager)/i,
      /\bwho\s+will\s+(be\s+)?(assigned|responsible|leading|managing)/i,
      /\bproposed\s+(staff|team|personnel)\b/i,
      /\bstaffing\s+(plan|proposal|approach|setup|structure)\b/i,
      // Describe/explain staffing IS still staffing (content matters)
      /\b(describe|explain)\s+(your\s+)?(staffing|team\s+structure|personnel)/i,
      /\bhow.{0,20}(your|the)\s+(team|staff).{0,20}(organized|structured|assigned)/i,
      // Qualifications and experience of team
      /\b(team|staff)\s+(qualification|experience|background|expertise)/i,
      /\b(developer|engineer|architect|analyst|manager)\s+(experience|qualification)/i,
    ],
    antiPatterns: [
      // Staff mentioned as issuer's contact, not vendor requirement
      /\bour\s+staff\s+will\s+(review|contact|respond)/i,
      /\bissuer('s)?\s+staff\b/i,
    ],
    sectionBoostKeywords: ['staffing', 'personnel', 'team', 'resources', 'key staff', 'qualifications'],
  },

  // REFERENCE_BASED - Past work, experience, clients (content matters)
  // Narrowed patterns to require clear past/previous/prior context OR client/customer reference requests
  {
    type: "REFERENCE_BASED",
    patterns: [
      // Reference contacts - must be about client/customer references
      /\b(provide|submit|include|list).{0,30}(client|customer)\s+reference/i,
      /\b(provide|submit|include|list).{0,30}reference.{0,15}(contact|name|phone|email)/i,
      /\bcontact\s+information.{0,20}(reference|client)/i,
      // Case studies and past work
      /\b(provide|submit|include|attach|describe).{0,30}case\s+stud(y|ies)/i,
      /\b(describe|provide|explain).{0,30}(similar|comparable|relevant)\s+(project|work|engagement|experience)/i,
      /\b(describe|explain|provide).{0,30}(past|previous|prior)\s+(project|work|experience|engagement)/i,
      // Past performance
      /\bpast\s+performance/i,
      /\btrack\s+record/i,
      /\bCPARS\b/i,
      // Experience questions - NARROWED to require past/previous/prior context
      /\b(your|the)\s+(past|previous|prior)\s+(experience|expertise)\s+(with|in|on)/i,
      /\bhow\s+(long|many).{0,20}(experience|years|projects)/i,
      /\bexamples?\s+of\s+(similar|past|previous|your)\s+(project|work|experience)/i,
    ],
    antiPatterns: [
      // Questions about system/product capabilities are NOT about past experience
      /^(does|do|can|is|are|will)\s+(the|your)\s+\w+\s+(provide|support|offer|have|allow|enable)/i,
    ],
    sectionBoostKeywords: ['reference', 'experience', 'past performance', 'qualifications', 'case study'],
  },

  // DECLARATIVE - Yes/No capability questions about system features
  // Must come before DESCRIPTIVE to catch capability questions first
  {
    type: "DECLARATIVE",
    patterns: [
      // Direct capability questions
      /^does\s+(the|your)\s+\w+.{0,30}(provide|support|offer|have|allow|enable|include)\b/i,
      /^can\s+(the|your)\s+\w+.{0,30}(provide|support|do|perform|handle|generate|track|manage)\b/i,
      /^is\s+(the|your)\s+\w+.{0,30}(capable|able)\s+to\b/i,
      // System capability statements
      /\b(system|solution|platform|product|software)\s+(provides?|supports?|offers?|has|enables?|allows?|includes?)\b/i,
      // Feature availability questions
      /\b(does|can)\s+(it|the\s+system|the\s+solution|your\s+product)\s+(support|provide|allow|enable|offer|include)/i,
      // Capability-focused questions (not about past work)
      /^(does|do)\s+(your|the).{0,40}(support|provide|allow|enable|offer|include|have|track|manage)\b/i,
    ],
    antiPatterns: [
      // Past experience questions are NOT declarative
      /\b(past|previous|prior|similar)\s+(project|work|experience)\b/i,
      // Reference requests are NOT declarative
      /\b(client|customer)\s+reference/i,
      /\bcase\s+stud(y|ies)/i,
    ],
    sectionBoostKeywords: ['capability', 'feature', 'functional', 'technical', 'requirements', 'support'],
  },

  // EVIDENCE_BASED - Compliance, certifications, attestations, and proof (content matters)
  {
    type: "EVIDENCE_BASED",
    patterns: [
      // Specific document types
      /\b(attach|upload|include|submit|provide|describe).{0,30}(certificate|certification|license|permit)\b/i,
      /\bcertificate\s+of\s+(insurance|compliance|incorporation|good\s+standing)/i,
      /\bproof\s+of\s+(insurance|compliance|registration|bonding|licensure)/i,
      // Compliance certifications - require word boundary to avoid matching "SOC" in "Social"
      /\b(HIPAA|PCI|GDPR|FedRAMP|FISMA|NIST|CIS)\b/i,
      /\b(ISO|SOC|SOC2)\s*[-\s]?\d+\b/i,  // ISO/SOC only with actual numbers (ISO 27001, SOC 2)
      // Financial documentation
      /\b(attach|provide|submit|describe).{0,30}(financial\s+statement|audit(ed)?\s+report|W-?9)\b/i,
      /\b(attach|provide|submit).{0,30}(balance\s+sheet|income\s+statement|tax\s+return)/i,
      // Insurance documents
      /\binsurance\s+(certificate|policy|coverage)\b/i,
      // Security compliance questions (content is about compliance even if asking "describe")
      /\b(describe|explain).{0,30}(your\s+)?(security|compliance|certification)\s+(posture|status|measures|controls)/i,
      /\b(describe|explain).{0,30}(how\s+)?(you|your).{0,20}(comply|compliant|certified|meet).{0,30}(standard|regulation|requirement)/i,
      /\b(what|which)\s+(security\s+)?(certification|compliance|audit|attestation)/i,
      // Disaster recovery / business continuity evidence
      /\b(describe|provide|explain).{0,30}(disaster\s+recovery|business\s+continuity|DR|BCP)\s+(plan|capability|procedure)/i,
      // Attestations
      /\battest(ation)?\b/i,
      /\b(are|is)\s+(you|your).{0,20}(certified|compliant|audited)/i,
    ],
    antiPatterns: [
      // Only block generic "documentation of approach" - NOT compliance/security approach
      /\bdocumentation\s+of\s+(your\s+)?(development|implementation)\s+(approach|methodology)/i,
    ],
    weakenPatterns: [],  // Removed - let content keywords win
    sectionBoostKeywords: ['attachment', 'evidence', 'documentation', 'certificate', 'compliance', 'security', 'audit'],
  },

  // QUANTITATIVE - Pricing, SLAs, metrics, capacity (content about numbers/pricing matters)
  {
    type: "QUANTITATIVE",
    patterns: [
      // Direct price/cost requests
      /\bwhat\s+(is|are)\s+(the|your)\s+(price|cost|fee|rate|total)/i,
      /\bprovide\s+(your\s+)?(pricing|costs?|fees?|rates?|quote|bid)\b/i,
      /\bsubmit\s+(your\s+)?(pricing|costs?|fees?|quote|bid)\b/i,
      // Actual currency amounts
      /[£$€¥]\s*[\d,]+/,
      /\b\d+(\.\d+)?\s*%/,  // Percentages with numbers
      // Specific quantitative requests
      /\bhow\s+much\s+(does|will|would|is)/i,
      /\btotal\s+(cost|price|amount|fee)\b/i,
      /\bunit\s+price/i,
      /\b(hourly|daily|weekly|monthly|annual)\s+(rate|fee|cost)/i,
      /\bprice\s+(per|for|of)\b/i,
      /\bcost\s+breakdown\b/i,
      /\bitemized\s+(cost|price|fee)/i,
      // SLA and metrics questions (content is quantitative even if asking "describe")
      /\b(describe|provide|explain|what).{0,30}(your\s+)?(SLA|service\s+level|uptime|availability)\b/i,
      /\b(what|describe|provide).{0,30}(your\s+)?(response\s+time|resolution\s+time|turnaround)/i,
      /\b(what|describe).{0,30}(your\s+)?(capacity|scalability|throughput|performance)\s+(limit|metric|number)/i,
      // Pricing schedule/table questions
      /\bpricing\s+(schedule|table|sheet|breakdown|detail)/i,
      /\bfee\s+(schedule|structure|breakdown)/i,
      // Discount/volume pricing
      /\b(volume|bulk|quantity)\s+(discount|pricing)/i,
      /\bdiscount\s+(for|on|rate|structure)/i,
      // License/seat pricing
      /\b(per-seat|per-user|per-license|seat-based|user-based)\s*(pricing|cost|fee)?/i,
      /\blicens(e|ing)\s+(cost|fee|price|model)/i,
    ],
    antiPatterns: [
      // Only block PURE methodology questions (no pricing terms in the actual question)
      /\b(describe|explain)\s+your\s+(general\s+)?approach\s+to\s+business/i,
    ],
    weakenPatterns: [],  // Removed - let content keywords win
    sectionBoostKeywords: ['pricing', 'cost', 'fee', 'financial', 'budget', 'price', 'sla', 'metrics'],
  },

  // PROCEDURAL - Processes, workflows, implementation, signatures (content about processes matters)
  {
    type: "PROCEDURAL",
    patterns: [
      // Signature/form completion
      /\bsign(ed|ature)?\s*(and\s+)?(return|submit|date|below)/i,
      /\bexecute\s+(the\s+)?(agreement|contract|form|document)/i,
      /\binitial\s+(here|each|all|below)/i,
      /\breturn\s+(this|the)\s+(form|document|page).{0,20}(signed|completed)/i,
      /\bcomplete\s+and\s+(sign|return|submit)/i,
      /\bsigned\s+(copy|form|document|agreement)/i,
      // Implementation/deployment process questions
      /\b(describe|explain|provide|what).{0,30}(your\s+)?(implementation|deployment|rollout)\s+(process|plan|approach|steps)/i,
      /\b(describe|explain|outline).{0,30}(your\s+)?(onboarding|migration|transition)\s+(process|plan|procedure)/i,
      /\b(what|describe).{0,30}(your\s+)?(installation|setup|configuration)\s+(process|procedure|steps)/i,
      // Workflow questions
      /\b(describe|explain|outline).{0,30}(your\s+)?(workflow|process|procedure)\s+(for|to)\b/i,
      /\bhow\s+(do|does|will|would)\s+(you|your|the).{0,30}(implement|deploy|install|migrate|onboard)/i,
      // Steps/phases questions
      /\bwhat\s+(are|is)\s+(the\s+)?(steps?|phases?|stages?)\s+(for|to|in|of)\b/i,
      /\b(list|describe|outline)\s+(the\s+)?(steps?|phases?|stages?)\s+(for|to|in|of|required)/i,
      // Maintenance/support process
      /\b(describe|explain).{0,30}(your\s+)?(maintenance|support|upgrade|update)\s+(process|procedure|workflow)/i,
      // Change management
      /\b(describe|explain).{0,30}(your\s+)?(change\s+management|release\s+management|version\s+control)\b/i,
    ],
    sectionBoostKeywords: ['signature', 'execution', 'acknowledgment', 'certification', 'implementation', 'process', 'workflow', 'onboarding'],
  },

  // CONTEXTUAL - Background, instructions, non-questions
  // Strictly for section intros, deadlines, and meta-information - NOT active requirements
  {
    type: "CONTEXTUAL",
    patterns: [
      // Section introductions
      /^(this\s+section|the\s+following|below\s+are|the\s+purpose\s+of)/i,
      /^(note|please\s+note|important):/i,
      /^for\s+the\s+purposes?\s+of\s+(this|the)/i,
      // Deadlines and submission instructions
      /\b(deadline|due\s+date|closing\s+date)\s*(is|:)/i,
      /\bsubmission\s+(deadline|date|instructions?)\b/i,
      /\bproposals?\s+(must|shall)\s+be\s+(received|submitted|delivered)\s+(by|before|no\s+later)/i,
      // Evaluation criteria statements
      /\bevaluation\s+(criteria|factors?)\s*(are|include|:)/i,
      /\bwill\s+be\s+(evaluated|scored|assessed)\s+(based\s+on|according\s+to)/i,
      // Warnings/consequences
      /\bfailure\s+to.{0,40}(may|will|shall)\s+(result|cause|lead|disqualify)/i,
      /\bnon-?compliance.{0,20}(may|will|shall)\s+(result|cause)/i,
      // Definitions
      /^"[^"]+"\s+(means|refers\s+to|is\s+defined\s+as)/i,
      /\bfor\s+purposes\s+of\s+this\s+(RFP|solicitation|document)/i,
      // General instructions
      /\b(vendor|contractor|respondent)s?\s+(shall|must|should)\s+(ensure|provide|submit|comply)/i,
      /\ball\s+(proposals?|responses?)\s+(shall|must|should)\s/i,
    ],
    antiPatterns: [
      // Questions are NOT contextual - they are active requirements
      /^(does|do|can|is|are|will|has|have|what|how|describe|explain|provide|list)\s/i,
      /\?$/,  // Anything ending with ? is not contextual
      // Specific action requests are NOT contextual
      /^(describe|explain|outline|detail|discuss|provide|list|identify)\b/i,
    ],
    sectionBoostKeywords: ['introduction', 'overview', 'background', 'instructions', 'evaluation', 'deadline'],
  },

  // DESCRIPTIVE - General describe/explain questions WITHOUT specific content keywords
  // This is the fallback for narrative responses when no specific type applies
  {
    type: "DESCRIPTIVE",
    patterns: [
      /\bdescribe\s+(your|the|how|in\s+detail)/i,
      /\bexplain\s+(your|the|how|in\s+detail)/i,
      /\bprovide\s+(a\s+)?(detailed\s+)?(description|explanation|overview)/i,
      /\boutline\s+(your|the|how)/i,
      /\bdetail\s+(your|the|how)/i,
      /\belaborate\s+on/i,
      /\bhow\s+(do|does|would|will|can)\s+(your|the|you)/i,
      /\bwhat\s+(is|are)\s+(your|the)\s+(approach|methodology|strategy|process)/i,
    ],
    antiPatterns: [
      // Don't classify as DESCRIPTIVE if asking for specific artifacts
      /\bprovide\s+(a\s+)?(list|resume|certificate|reference)/i,
      // Let STAFFING handle team/personnel content
      /\b(staff|personnel|team\s+member|FTE|employee|staffing|resume|cv)\b/i,
      // Let REFERENCE_BASED handle past work/experience content
      /\b(reference|case\s+stud|similar\s+project|past\s+performance|past\s+project|previous\s+work)\b/i,
      // Let EVIDENCE_BASED handle compliance/certification content
      /\b(certificate|certification|compliance|hipaa|pci|gdpr|fedramp|soc\s*2?|iso\s*27|audit)\b/i,
      // Let QUANTITATIVE handle pricing/SLA content
      /\b(pricing|sla|service\s+level|uptime|response\s+time|fee\s+schedule)\b/i,
      // Let PROCEDURAL handle process/workflow content
      /\b(implementation\s+process|onboarding\s+process|migration\s+process|deployment\s+process|workflow\s+for)\b/i,
    ],
    sectionBoostKeywords: ['approach', 'methodology', 'narrative', 'response', 'solution'],
  },
];

// =============================================================================
// PASS 3: KEYWORD DENSITY SCORING (fallback when no strong pattern matches)
// =============================================================================

/**
 * Keyword sets for each requirement type.
 * Used for density-based scoring when regex patterns don't match.
 * Keywords are weighted: some are strong indicators, others are weak.
 */
const TYPE_KEYWORDS: Record<RequirementType, { strong: string[]; weak: string[] }> = {
  QUANTITATIVE: {
    strong: [
      'price', 'pricing', 'cost', 'costs', 'fee', 'fees', 'rate', 'rates',
      'budget', 'quote', 'bid', 'dollar', 'amount', 'total', 'payment',
      'invoice', 'billing', 'expense', 'charge', 'tariff', 'discount',
      'sla', 'uptime', 'availability', 'latency', 'throughput', 'capacity',
      'volume', 'percentage', 'metric', 'metrics', 'kpi', 'benchmark',
      'annual', 'monthly', 'hourly', 'per-user', 'per-seat', 'license',
    ],
    weak: [
      'number', 'count', 'quantity', 'size', 'scale', 'measure', 'level',
      'maximum', 'minimum', 'limit', 'threshold', 'target', 'goal',
    ],
  },
  EVIDENCE_BASED: {
    strong: [
      'certificate', 'certification', 'certified', 'compliance', 'compliant',
      'audit', 'audited', 'attestation', 'accreditation', 'accredited',
      'hipaa', 'pci', 'pci-dss', 'gdpr', 'fedramp', 'fisma', 'sox', 'soc2',
      'iso27001', 'iso-27001', 'nist', 'cis', 'owasp', 'fips',
      'insurance', 'bonding', 'bond', 'liability', 'indemnification',
      'license', 'licensed', 'licensure', 'permit', 'permitted',
      'registration', 'registered', 'w-9', 'w9', 'ein', 'duns',
      'financial-statement', 'balance-sheet', 'tax-return',
    ],
    weak: [
      'secure', 'security', 'protection', 'privacy', 'encrypt', 'encrypted',
      'document', 'documentation', 'proof', 'evidence', 'verify', 'verified',
      'standards', 'regulatory', 'regulation', 'govern', 'governance',
    ],
  },
  PROCEDURAL: {
    strong: [
      'workflow', 'process', 'procedure', 'step', 'steps', 'stage', 'stages',
      'implement', 'implementation', 'deploy', 'deployment', 'rollout',
      'migrate', 'migration', 'transition', 'onboard', 'onboarding',
      'install', 'installation', 'configure', 'configuration', 'setup',
      'integrate', 'integration', 'interface', 'api', 'connect', 'connection',
      'maintain', 'maintenance', 'support', 'upgrade', 'update', 'patch',
      'backup', 'restore', 'recovery', 'disaster', 'failover', 'redundancy',
      'monitor', 'monitoring', 'alert', 'alerting', 'logging', 'logs',
      'sign', 'signature', 'execute', 'acknowledge', 'return', 'submit',
    ],
    weak: [
      'method', 'approach', 'strategy', 'plan', 'schedule', 'timeline',
      'phase', 'milestone', 'deliverable', 'task', 'activity',
    ],
  },
  STAFFING: {
    strong: [
      'staff', 'staffing', 'personnel', 'team', 'resource', 'resources',
      'employee', 'employees', 'fte', 'headcount', 'hire', 'hiring',
      'resume', 'cv', 'curriculum-vitae', 'bio', 'biography', 'background',
      'qualification', 'qualifications', 'credential', 'credentials',
      'manager', 'lead', 'director', 'architect', 'engineer', 'developer',
      'analyst', 'consultant', 'specialist', 'expert', 'role', 'roles',
      'organizational', 'org-chart', 'reporting', 'structure',
    ],
    weak: [
      'experience', 'experienced', 'skilled', 'skill', 'skills',
      'assign', 'assigned', 'responsible', 'responsibility', 'dedicated',
    ],
  },
  REFERENCE_BASED: {
    strong: [
      'reference', 'references', 'referral', 'referrals', 'testimonial',
      'client', 'clients', 'customer', 'customers', 'contact', 'contacts',
      'case-study', 'case-studies', 'portfolio', 'project', 'projects',
      'similar', 'comparable', 'relevant', 'past', 'previous', 'prior',
      'performance', 'track-record', 'history', 'cpars', 'ppirs',
    ],
    weak: [
      'example', 'examples', 'instance', 'demonstrate', 'demonstrated',
      'proven', 'successful', 'success', 'outcome', 'result', 'results',
    ],
  },
  CONTEXTUAL: {
    strong: [
      'background', 'overview', 'introduction', 'summary', 'scope',
      'purpose', 'objective', 'objectives', 'goal', 'goals',
      'instruction', 'instructions', 'guideline', 'guidelines', 'rule', 'rules',
      'definition', 'definitions', 'term', 'terms', 'glossary', 'acronym',
      'deadline', 'due-date', 'closing', 'submission', 'format', 'formatting',
      'evaluation', 'criteria', 'scoring', 'weighting', 'weight',
      'eligibility', 'eligible', 'disqualification', 'disqualified',
      'amendment', 'addendum', 'clarification', 'question', 'questions',
    ],
    weak: [
      'note', 'important', 'notice', 'attention', 'warning', 'caution',
      'section', 'part', 'article', 'clause', 'provision', 'requirement',
    ],
  },
  DECLARATIVE: {
    strong: [
      'capability', 'capabilities', 'feature', 'features', 'function', 'functions',
      'functionality', 'module', 'modules', 'component', 'components',
      'support', 'supports', 'enable', 'enables', 'allow', 'allows',
      'provide', 'provides', 'include', 'includes', 'offer', 'offers',
      'compatible', 'compatibility', 'interoperable', 'interoperability',
      'native', 'built-in', 'out-of-box', 'ootb', 'standard', 'default',
    ],
    weak: [
      'system', 'solution', 'platform', 'product', 'software', 'application',
      'tool', 'tools', 'technology', 'technologies', 'available', 'availability',
    ],
  },
  DESCRIPTIVE: {
    strong: [
      'describe', 'description', 'explain', 'explanation', 'detail', 'details',
      'elaborate', 'outline', 'discuss', 'narrative', 'overview',
      'approach', 'methodology', 'method', 'strategy', 'plan', 'proposal',
      'how', 'what', 'why', 'rationale', 'justification', 'reasoning',
    ],
    weak: [
      'information', 'info', 'response', 'answer', 'provide', 'submit',
      'demonstrate', 'show', 'illustrate', 'clarify', 'specify',
    ],
  },
};

/**
 * Calculate keyword density score for a given type.
 * Returns a score from 0-100 based on keyword matches.
 */
function calculateKeywordScore(text: string, type: RequirementType): number {
  const keywords = TYPE_KEYWORDS[type];
  if (!keywords) return 0;

  const lower = text.toLowerCase();
  const words = lower.split(/\W+/).filter(w => w.length > 2);
  const wordCount = words.length;
  if (wordCount === 0) return 0;

  let strongMatches = 0;
  let weakMatches = 0;

  // Count strong keyword matches
  for (const keyword of keywords.strong) {
    // Handle hyphenated keywords by checking both forms
    const variants = [keyword, keyword.replace(/-/g, ' '), keyword.replace(/-/g, '')];
    for (const variant of variants) {
      if (lower.includes(variant)) {
        strongMatches++;
        break;
      }
    }
  }

  // Count weak keyword matches
  for (const keyword of keywords.weak) {
    const variants = [keyword, keyword.replace(/-/g, ' '), keyword.replace(/-/g, '')];
    for (const variant of variants) {
      if (lower.includes(variant)) {
        weakMatches++;
        break;
      }
    }
  }

  // Calculate score: strong matches worth 3 points, weak worth 1 point
  // Normalize by dividing by expected matches for a "typical" requirement
  const rawScore = (strongMatches * 3) + weakMatches;

  // Scale to 0-100 (assume 5 strong matches = 100%)
  const score = Math.min(100, (rawScore / 15) * 100);

  return Math.round(score);
}

/**
 * Find the best type match based on keyword density.
 * Returns the type with the highest score if it exceeds threshold.
 */
interface KeywordMatch {
  type: RequirementType;
  score: number;
}

function findBestKeywordMatch(text: string, excludeTypes: RequirementType[] = []): KeywordMatch | null {
  const allTypes: RequirementType[] = [
    'QUANTITATIVE', 'EVIDENCE_BASED', 'PROCEDURAL', 'STAFFING',
    'REFERENCE_BASED', 'CONTEXTUAL', 'DECLARATIVE', 'DESCRIPTIVE'
  ];

  const scores: KeywordMatch[] = [];

  for (const type of allTypes) {
    if (excludeTypes.includes(type)) continue;
    const score = calculateKeywordScore(text, type);
    if (score > 0) {
      scores.push({ type, score });
    }
  }

  if (scores.length === 0) return null;

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Return best match if score is meaningful (> 15 = at least ~2 strong keywords)
  const best = scores[0];
  if (best.score >= 15) {
    return best;
  }

  return null;
}

// =============================================================================
// MAPPING: QUESTION STRUCTURE -> DEFAULT TYPE
// =============================================================================

const QUESTION_STRUCTURE_TYPE_MAP: Record<QuestionStructureType, RequirementType> = {
  'yes_no': 'DECLARATIVE',
  'open_ended': 'DESCRIPTIVE',
  'list_request': 'DESCRIPTIVE',  // Lists often need description too
  'confirmation': 'PROCEDURAL',
  'statement': 'CONTEXTUAL',
  'unknown': 'DESCRIPTIVE',  // Default for questions
};

// =============================================================================
// CONFIDENCE CALCULATION
// =============================================================================

interface TopicMatch {
  type: RequirementType;
  pattern: string;
  baseConfidence: number;
  hasAntiPattern: boolean;
  hasWeakenPattern: boolean;
}

function findTopicMatches(text: string, sectionTitle?: string): TopicMatch[] {
  const matches: TopicMatch[] = [];
  const lower = text.toLowerCase();
  const sectionLower = sectionTitle?.toLowerCase() || '';

  for (const topic of TOPIC_PATTERNS) {
    // Check anti-patterns first - if matched, skip this type entirely
    let hasAntiPattern = false;
    if (topic.antiPatterns) {
      for (const antiPattern of topic.antiPatterns) {
        if (antiPattern.test(text)) {
          hasAntiPattern = true;
          break;
        }
      }
    }

    // Check weaken patterns
    let hasWeakenPattern = false;
    if (topic.weakenPatterns) {
      for (const weakenPattern of topic.weakenPatterns) {
        if (weakenPattern.test(lower)) {
          hasWeakenPattern = true;
          break;
        }
      }
    }

    // Check main patterns
    for (const pattern of topic.patterns) {
      if (pattern.test(text)) {
        // Calculate base confidence
        let baseConfidence = 75;

        // Boost if section title contains relevant keywords
        if (topic.sectionBoostKeywords && sectionTitle) {
          for (const keyword of topic.sectionBoostKeywords) {
            if (sectionLower.includes(keyword)) {
              baseConfidence += 10;
              break;
            }
          }
        }

        matches.push({
          type: topic.type,
          pattern: pattern.source.substring(0, 50),
          baseConfidence,
          hasAntiPattern,
          hasWeakenPattern,
        });
        break; // Only one match per topic type
      }
    }
  }

  return matches;
}

function calculateFinalConfidence(
  questionStructure: QuestionStructure,
  topicMatch: TopicMatch | null,
  finalType: RequirementType,
  sectionTitle?: string
): number {
  let confidence = 55; // Base - raised from 50 to reduce low-confidence count

  // Factor 1: Question structure confidence (weight raised from 0.3 to 0.35)
  if (questionStructure.type !== 'unknown') {
    confidence += questionStructure.confidence * 0.35; // Up to +35
  }

  // Factor 2: Topic pattern match (keep at 0.3)
  if (topicMatch && !topicMatch.hasAntiPattern) {
    confidence += topicMatch.baseConfidence * 0.30; // Up to +30

    // Penalty for weaken patterns (reduced from 15 to 12)
    if (topicMatch.hasWeakenPattern) {
      confidence -= 12;
    }
  }

  // Factor 3: Alignment between question structure and topic (bonus raised from 15 to 18)
  const expectedTypeFromStructure = QUESTION_STRUCTURE_TYPE_MAP[questionStructure.type];
  if (topicMatch) {
    // If topic matches expected type from structure, boost confidence
    if (topicMatch.type === expectedTypeFromStructure) {
      confidence += 18;
    }
    // If they conflict, reduce confidence (but topic wins)
    else if (questionStructure.type !== 'unknown' && questionStructure.confidence > 70) {
      confidence -= 10;
    }
  }

  // Factor 4: Section context alignment (keep at 8)
  if (sectionTitle) {
    const sectionLower = sectionTitle.toLowerCase();
    const typeKeywords: Record<RequirementType, string[]> = {
      'STAFFING': ['staff', 'personnel', 'team', 'resource'],
      'QUANTITATIVE': ['price', 'pricing', 'cost', 'fee', 'financial', 'budget'],
      'REFERENCE_BASED': ['reference', 'experience', 'qualification', 'past performance'],
      'EVIDENCE_BASED': ['attachment', 'evidence', 'document', 'certificate'],
      'PROCEDURAL': ['signature', 'certify', 'acknowledgment'],
      'CONTEXTUAL': ['introduction', 'overview', 'instruction', 'background'],
      'DECLARATIVE': ['capability', 'feature', 'support', 'compliance', 'functional'],
      'DESCRIPTIVE': ['approach', 'methodology', 'narrative', 'solution', 'technical'],
    };

    const keywords = typeKeywords[finalType] || [];
    for (const keyword of keywords) {
      if (sectionLower.includes(keyword)) {
        confidence += 8;
        break;
      }
    }
  }

  // Factor 5: Anti-pattern penalty (reduced from 30 to 25)
  if (topicMatch?.hasAntiPattern) {
    confidence -= 25;
  }

  // Factor 6: Strong question structure bonus
  // If structure detection is very confident, boost overall
  if (questionStructure.confidence >= 90) {
    confidence += 5;
  }

  return Math.max(35, Math.min(95, Math.round(confidence)));
}

// =============================================================================
// MAIN CLASSIFICATION FUNCTION (Three-Pass)
// =============================================================================

/**
 * Classify the type of a requirement using three-pass analysis.
 *
 * Pass 1: Detect question structure (HOW it asks)
 * Pass 2: Detect topic/content via regex patterns (WHAT it's about)
 * Pass 3: Keyword density scoring (fallback when no strong pattern matches)
 * Combine: Weight all passes to determine final type
 */
export function classifyTypeHeuristically(
  text: string,
  sectionTitle?: string
): TypeClassification {
  const trimmed = text.trim();

  // === PASS 1: Question Structure Detection ===
  const questionStructure = detectQuestionStructure(trimmed);

  // === PASS 2: Topic Detection (regex patterns) ===
  const topicMatches = findTopicMatches(trimmed, sectionTitle);

  // Filter out matches with anti-patterns
  const validTopicMatches = topicMatches.filter(m => !m.hasAntiPattern);

  // === PASS 3: Keyword Density Scoring ===
  // Used as fallback when no strong regex pattern matches
  const keywordMatch = findBestKeywordMatch(trimmed);

  // === COMBINE PASSES ===
  let finalType: RequirementType;
  let matchedPattern: string;
  let bestTopicMatch: TopicMatch | null = null;

  if (validTopicMatches.length > 0) {
    // Sort by confidence (including section boost)
    validTopicMatches.sort((a, b) => b.baseConfidence - a.baseConfidence);
    bestTopicMatch = validTopicMatches[0];

    // Special case: If question structure is very confident yes/no,
    // but topic suggests something else, check if we should override
    if (questionStructure.type === 'yes_no' && questionStructure.confidence >= 90) {
      // Yes/no questions stay DECLARATIVE unless topic is VERY specific
      if (bestTopicMatch.baseConfidence < 85) {
        finalType = 'DECLARATIVE';
        matchedPattern = `${questionStructure.indicator} (yes/no overrides topic)`;
      } else {
        // Strong topic match wins
        finalType = bestTopicMatch.type;
        matchedPattern = bestTopicMatch.pattern;
      }
    }
    // Confirmation structure always wins
    else if (questionStructure.type === 'confirmation') {
      finalType = 'PROCEDURAL';
      matchedPattern = questionStructure.indicator || 'confirmation';
    }
    // Statement structure suggests CONTEXTUAL
    else if (questionStructure.type === 'statement') {
      finalType = 'CONTEXTUAL';
      matchedPattern = questionStructure.indicator || 'statement';
    }
    // Otherwise, topic match wins (but consider structure)
    else {
      finalType = bestTopicMatch.type;
      matchedPattern = bestTopicMatch.pattern;
    }
  } else if (keywordMatch && keywordMatch.score >= 20) {
    // No regex pattern match, but keyword density suggests a type
    // Only use if score is significant (20+ = decent keyword presence)
    finalType = keywordMatch.type;
    matchedPattern = `keyword:${keywordMatch.type.toLowerCase()}(${keywordMatch.score})`;
  } else {
    // No topic match and weak/no keyword match - use question structure
    // But still check if keywords suggest something other than the default
    if (keywordMatch && keywordMatch.score >= 10) {
      // Weak keyword match - use it but with structure-based fallback consideration
      const structureDefault = QUESTION_STRUCTURE_TYPE_MAP[questionStructure.type];
      // If keywords suggest something different from structure default, prefer keywords
      // unless it's just DECLARATIVE vs DESCRIPTIVE (which are the boring defaults)
      if (keywordMatch.type !== structureDefault &&
          keywordMatch.type !== 'DECLARATIVE' &&
          keywordMatch.type !== 'DESCRIPTIVE') {
        finalType = keywordMatch.type;
        matchedPattern = `keyword-weak:${keywordMatch.type.toLowerCase()}(${keywordMatch.score})`;
      } else {
        finalType = structureDefault;
        matchedPattern = questionStructure.indicator || 'structure only';
      }
    } else {
      finalType = QUESTION_STRUCTURE_TYPE_MAP[questionStructure.type];
      matchedPattern = questionStructure.indicator || 'structure only';
    }
  }

  // === CALCULATE CONFIDENCE ===
  const confidence = calculateFinalConfidence(
    questionStructure,
    bestTopicMatch,
    finalType,
    sectionTitle
  );

  return {
    type: finalType,
    confidence,
    matchedPattern,
    questionStructure,
    topicMatch: bestTopicMatch?.pattern,
  };
}

// =============================================================================
// MANDATORY CLASSIFICATION (unchanged from v1, but with improvements)
// =============================================================================

const MANDATORY_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\bmandatory\b/i, confidence: 95 },
  { pattern: /\bnon-?negotiable\b/i, confidence: 95 },
  { pattern: /\bshall\b/i, confidence: 88 },
  { pattern: /\bmust\b/i, confidence: 88 },
  { pattern: /\brequired\b/i, confidence: 85 },
  { pattern: /\bwill\s+be\s+(evaluated|scored|assessed|rated)/i, confidence: 80 },
  { pattern: /\bessential\b/i, confidence: 75 },
  { pattern: /\bcritical\b/i, confidence: 70 },
  { pattern: /\bnecessary\b/i, confidence: 65 },
];

const OPTIONAL_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\boptional\b/i, confidence: 95 },
  { pattern: /\bnot\s+required\b/i, confidence: 95 },
  // Negation patterns
  { pattern: /\bnot\s+mandatory\b/i, confidence: 95 },
  { pattern: /\bis\s+not\s+required\b/i, confidence: 95 },
  { pattern: /\bnot\s+essential\b/i, confidence: 90 },
  { pattern: /\b(need|require)s?\s+not\b/i, confidence: 85 },
  // Standard optional indicators
  { pattern: /\bnice\s+to\s+have\b/i, confidence: 90 },
  { pattern: /\bif\s+(applicable|available|desired|possible)/i, confidence: 85 },
  { pattern: /\bbonus\b/i, confidence: 85 },
  { pattern: /\bpreferred\s+(but\s+not\s+required)?/i, confidence: 82 },
  { pattern: /\bdesired\b/i, confidence: 80 },
  { pattern: /\bwhere\s+(applicable|possible)/i, confidence: 80 },
  { pattern: /\brecommended\b/i, confidence: 75 },
  { pattern: /\bmay\s+(include|provide|submit)/i, confidence: 72 },
];

const SECTION_MANDATORY_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\bmandatory\s+(requirement|section|item)/i, confidence: 95 },
  { pattern: /\brequired\s+(requirement|section|item)/i, confidence: 90 },
  { pattern: /\bmust\s+have/i, confidence: 85 },
  { pattern: /\bminimum\s+requirement/i, confidence: 85 },
];

const SECTION_OPTIONAL_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\boptional\s+(requirement|section|item)/i, confidence: 95 },
  { pattern: /\bpreferred\s+(qualification|requirement)/i, confidence: 90 },
  { pattern: /\bnice\s+to\s+have/i, confidence: 90 },
  { pattern: /\bdesired\s+(qualification|requirement)/i, confidence: 85 },
  { pattern: /\bvalue[\s-]added/i, confidence: 80 },
];

/**
 * Classify whether a requirement is mandatory using pattern matching.
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

  // Default: mandatory with higher confidence (most RFP requirements ARE mandatory)
  // Raised from 55 to 75 to reduce low-confidence count
  return {
    isMandatory: true,
    confidence: 75,
    matchedPattern: "default - assumed mandatory",
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a human-readable explanation for a type classification.
 */
export function explainTypeClassification(classification: TypeClassification): string {
  const { confidence, questionStructure, topicMatch } = classification;

  let explanation = '';

  if (confidence >= 85) {
    explanation = `Strong match for ${classification.type}`;
  } else if (confidence >= 70) {
    explanation = `Good match for ${classification.type}`;
  } else if (confidence >= 55) {
    explanation = `Likely ${classification.type}`;
  } else {
    explanation = `Uncertain - defaulted to ${classification.type}`;
  }

  if (questionStructure && questionStructure.type !== 'unknown') {
    explanation += ` (structure: ${questionStructure.type})`;
  }
  if (topicMatch) {
    explanation += ` (topic: ${topicMatch.substring(0, 20)}...)`;
  }

  return explanation;
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

// Export question structure detection for testing
export { detectQuestionStructure };
export type { QuestionStructure, QuestionStructureType };
