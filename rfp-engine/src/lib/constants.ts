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
} as const;

export const QUOTA_LIMITS = {
  FREE: 2,
  PRO: -1, // -1 means unlimited
} as const;

export type RequirementType = keyof typeof TOKEN_LIMITS;
