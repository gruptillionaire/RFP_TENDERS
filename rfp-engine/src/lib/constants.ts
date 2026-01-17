export const MODELS = {
  EXTRACTION: "gpt-4o-mini",
  DRAFTING: "gpt-3.5-turbo",
} as const;

export const TOKEN_LIMITS = {
  CONTEXTUAL: { min: 0, max: 0 }, // No response needed
  PROCEDURAL: { min: 40, max: 60 },
  DECLARATIVE: { min: 80, max: 120 },
  DESCRIPTIVE: { min: 200, max: 300 },
  EVIDENCE_BASED: { min: 120, max: 180 },
  QUANTITATIVE: { min: 150, max: 250 },
  REFERENCE_BASED: { min: 200, max: 350 },
  STAFFING: { min: 180, max: 300 },
} as const;

export const QUOTA_LIMITS = {
  FREE: 0,
  STARTER: 2,
  PRO: 10,
  BUSINESS: -1, // -1 means unlimited
  ENTERPRISE: -1,
} as const;

export const DRAFT_LIMITS = {
  FREE: 0,
  STARTER: 200,
  PRO: 600,
  BUSINESS: 600,
  ENTERPRISE: -1, // -1 means unlimited
} as const;

// Page limits per upload (in pages)
export const PAGE_LIMITS = {
  FREE: 0,
  STARTER: 150,
  PRO: 200,
  BUSINESS: -1, // -1 means unlimited
  ENTERPRISE: -1,
  SINGLE_USE: 150,
} as const;

export type RequirementType = keyof typeof TOKEN_LIMITS;

// =============================================================================
// EXTRACTION CONFIGURATION
// =============================================================================

/**
 * Feature flags for extraction architecture
 *
 * USE_HEURISTIC_EXTRACTION: false = Use external LLM worker for full extraction
 *                           true  = Use local heuristic extraction (fast but limited)
 *
 * To re-enable heuristics, set USE_HEURISTIC_EXTRACTION = true
 */
export const EXTRACTION_CONFIG = {
  /** Use external worker for LLM extraction instead of heuristics */
  USE_HEURISTIC_EXTRACTION: false,

  /** External worker URL for LLM extraction */
  WORKER_URL: process.env.EXTRACTION_WORKER_URL || 'http://localhost:3001',

  /** Timeout for worker requests (ms) - can be long for big documents */
  WORKER_TIMEOUT: 5 * 60 * 1000, // 5 minutes

  /** Model to use for extraction */
  EXTRACTION_MODEL: 'gpt-4o-mini',
} as const;
