/**
 * Compliance scoring system for RFP requirements
 * Calculates weighted scores and submission readiness
 */

import { RequirementStatus, DomainContext } from "@prisma/client";

// Weight multipliers for scoring
const WEIGHTS = {
  mandatory: 2.0,    // Mandatory requirements count double
  legal: 1.5,        // Legal domain weighted higher
  process: 1.2,      // Process domain slightly higher
  feature: 1.0,      // Feature domain baseline
} as const;

export interface RequirementForScoring {
  id: string;
  status: RequirementStatus;
  isMandatory: boolean;
  domainContext: DomainContext;
  requiresReview: boolean;
  section?: string | null;
  draftAnswer?: string | null;
  wordLimit?: number | null;
  characterLimit?: number | null;
}

export interface ComplianceScore {
  overall: number;           // 0-100 weighted score
  mandatory: number;         // 0-100 mandatory completion
  answered: number;          // Count of answered requirements
  partial: number;           // Count of partial requirements
  unanswered: number;        // Count of unanswered requirements
  total: number;             // Total requirements
  bySection: Record<string, number>;
  byDomain: Record<DomainContext, number>;
  readiness: SubmissionReadiness;
}

export interface SubmissionReadiness {
  ready: boolean;
  blockers: ReadinessIssue[];    // Critical issues
  warnings: ReadinessIssue[];    // Non-critical issues
}

export interface ReadinessIssue {
  type: string;
  message: string;
  count?: number;
  requirementIds?: string[];
}

/**
 * Get the weight for a requirement based on its properties
 */
function getWeight(req: RequirementForScoring): number {
  let weight = 1.0;

  // Mandatory requirements count double
  if (req.isMandatory) {
    weight *= WEIGHTS.mandatory;
  }

  // Apply domain context weight
  switch (req.domainContext) {
    case "LEGAL":
      weight *= WEIGHTS.legal;
      break;
    case "PROCESS":
      weight *= WEIGHTS.process;
      break;
    case "FEATURE":
    default:
      weight *= WEIGHTS.feature;
      break;
  }

  return weight;
}

/**
 * Get the score contribution for a requirement based on its status
 */
function getScoreContribution(status: RequirementStatus): number {
  switch (status) {
    case "ANSWERED":
      return 1.0;
    case "PARTIAL":
      return 0.5;
    case "UNANSWERED":
    default:
      return 0;
  }
}

/**
 * Check if a response exceeds its word or character limit
 */
function isOverLimit(req: RequirementForScoring): boolean {
  if (!req.draftAnswer) return false;

  const wordCount = req.draftAnswer.split(/\s+/).filter(Boolean).length;
  const charCount = req.draftAnswer.length;

  return (
    (req.wordLimit !== null && req.wordLimit !== undefined && wordCount > req.wordLimit) ||
    (req.characterLimit !== null && req.characterLimit !== undefined && charCount > req.characterLimit)
  );
}

/**
 * Calculate overall weighted compliance score
 */
function calculateOverallScore(requirements: RequirementForScoring[]): number {
  if (requirements.length === 0) return 100;

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const req of requirements) {
    const weight = getWeight(req);
    totalWeight += weight;
    earnedWeight += weight * getScoreContribution(req.status);
  }

  return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;
}

/**
 * Calculate mandatory requirements completion percentage
 */
function calculateMandatoryScore(requirements: RequirementForScoring[]): number {
  const mandatory = requirements.filter(r => r.isMandatory);

  if (mandatory.length === 0) return 100;

  const answered = mandatory.filter(r => r.status === "ANSWERED").length;
  const partial = mandatory.filter(r => r.status === "PARTIAL").length;

  return Math.round(((answered + partial * 0.5) / mandatory.length) * 100);
}

/**
 * Calculate score by section
 */
function calculateSectionScores(requirements: RequirementForScoring[]): Record<string, number> {
  const bySection: Record<string, { totalWeight: number; earnedWeight: number }> = {};

  for (const req of requirements) {
    const section = req.section || "Uncategorized";

    if (!bySection[section]) {
      bySection[section] = { totalWeight: 0, earnedWeight: 0 };
    }

    const weight = getWeight(req);
    bySection[section].totalWeight += weight;
    bySection[section].earnedWeight += weight * getScoreContribution(req.status);
  }

  const result: Record<string, number> = {};
  for (const [section, data] of Object.entries(bySection)) {
    result[section] = data.totalWeight > 0
      ? Math.round((data.earnedWeight / data.totalWeight) * 100)
      : 100;
  }

  return result;
}

/**
 * Calculate score by domain context
 */
function calculateDomainScores(requirements: RequirementForScoring[]): Record<DomainContext, number> {
  const byDomain: Record<DomainContext, { totalWeight: number; earnedWeight: number }> = {
    FEATURE: { totalWeight: 0, earnedWeight: 0 },
    PROCESS: { totalWeight: 0, earnedWeight: 0 },
    LEGAL: { totalWeight: 0, earnedWeight: 0 },
  };

  for (const req of requirements) {
    const weight = getWeight(req);
    byDomain[req.domainContext].totalWeight += weight;
    byDomain[req.domainContext].earnedWeight += weight * getScoreContribution(req.status);
  }

  const result: Record<DomainContext, number> = {
    FEATURE: 0,
    PROCESS: 0,
    LEGAL: 0,
  };

  for (const domain of Object.keys(byDomain) as DomainContext[]) {
    result[domain] = byDomain[domain].totalWeight > 0
      ? Math.round((byDomain[domain].earnedWeight / byDomain[domain].totalWeight) * 100)
      : 100;
  }

  return result;
}

/**
 * Calculate submission readiness with blockers and warnings
 */
function calculateReadiness(
  requirements: RequirementForScoring[],
  companyName?: string | null
): SubmissionReadiness {
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];

  // Check for mandatory requirements that are unanswered
  const mandatoryUnanswered = requirements.filter(
    r => r.isMandatory && r.status === "UNANSWERED"
  );
  if (mandatoryUnanswered.length > 0) {
    blockers.push({
      type: "mandatory_unanswered",
      message: `${mandatoryUnanswered.length} mandatory requirement${mandatoryUnanswered.length === 1 ? "" : "s"} not answered`,
      count: mandatoryUnanswered.length,
      requirementIds: mandatoryUnanswered.map(r => r.id),
    });
  }

  // Check for legal domain requirements that need review
  const legalUnreviewed = requirements.filter(
    r => r.domainContext === "LEGAL" && r.requiresReview
  );
  if (legalUnreviewed.length > 0) {
    blockers.push({
      type: "legal_unreviewed",
      message: `${legalUnreviewed.length} legal requirement${legalUnreviewed.length === 1 ? "" : "s"} need${legalUnreviewed.length === 1 ? "s" : ""} review`,
      count: legalUnreviewed.length,
      requirementIds: legalUnreviewed.map(r => r.id),
    });
  }

  // Check for responses over limit
  const overLimit = requirements.filter(isOverLimit);
  if (overLimit.length > 0) {
    blockers.push({
      type: "over_limit",
      message: `${overLimit.length} response${overLimit.length === 1 ? "" : "s"} exceed${overLimit.length === 1 ? "s" : ""} word/character limit`,
      count: overLimit.length,
      requirementIds: overLimit.map(r => r.id),
    });
  }

  // Warnings

  // Check for mandatory requirements that are partial
  const mandatoryPartial = requirements.filter(
    r => r.isMandatory && r.status === "PARTIAL"
  );
  if (mandatoryPartial.length > 0) {
    warnings.push({
      type: "mandatory_partial",
      message: `${mandatoryPartial.length} mandatory requirement${mandatoryPartial.length === 1 ? "" : "s"} partially complete`,
      count: mandatoryPartial.length,
      requirementIds: mandatoryPartial.map(r => r.id),
    });
  }

  // Check for low overall completion
  const answeredCount = requirements.filter(r => r.status === "ANSWERED").length;
  const completionRate = requirements.length > 0
    ? Math.round((answeredCount / requirements.length) * 100)
    : 100;

  if (completionRate < 80 && requirements.length > 0) {
    warnings.push({
      type: "low_completion",
      message: `Only ${completionRate}% of requirements fully answered`,
    });
  }

  // Check for missing company name
  if (!companyName) {
    warnings.push({
      type: "missing_company_name",
      message: "Company name not set in project settings",
    });
  }

  // Check for any requirements needing review (non-legal)
  const needsReview = requirements.filter(
    r => r.requiresReview && r.domainContext !== "LEGAL"
  );
  if (needsReview.length > 0) {
    warnings.push({
      type: "needs_review",
      message: `${needsReview.length} requirement${needsReview.length === 1 ? "" : "s"} flagged for review`,
      count: needsReview.length,
      requirementIds: needsReview.map(r => r.id),
    });
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}

/**
 * Calculate complete compliance score for a set of requirements
 */
export function calculateComplianceScore(
  requirements: RequirementForScoring[],
  companyName?: string | null
): ComplianceScore {
  const answered = requirements.filter(r => r.status === "ANSWERED").length;
  const partial = requirements.filter(r => r.status === "PARTIAL").length;
  const unanswered = requirements.filter(r => r.status === "UNANSWERED").length;

  return {
    overall: calculateOverallScore(requirements),
    mandatory: calculateMandatoryScore(requirements),
    answered,
    partial,
    unanswered,
    total: requirements.length,
    bySection: calculateSectionScores(requirements),
    byDomain: calculateDomainScores(requirements),
    readiness: calculateReadiness(requirements, companyName),
  };
}

/**
 * Get a letter grade based on the overall score
 */
export function getScoreGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Get a color class based on the score (for UI)
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

/**
 * Get a background color class based on the score (for UI)
 */
export function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-100";
  if (score >= 60) return "bg-yellow-100";
  if (score >= 40) return "bg-orange-100";
  return "bg-red-100";
}
