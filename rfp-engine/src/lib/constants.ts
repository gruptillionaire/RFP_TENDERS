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
