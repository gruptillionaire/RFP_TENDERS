/**
 * Placeholder Detection Utility
 *
 * Scans requirements for unfinished content placeholders that should
 * be resolved before final export.
 */

// Placeholder patterns to detect unfinished content
export const PLACEHOLDER_PATTERNS = {
  DRAFT: /\[DRAFT\]/g,
  COMPANY_NAME: /\[COMPANY NAME\]/g,
  PROVIDE: /\[PROVIDE[^\]]*\]/gi,
  CONFIRM: /\[CONFIRM[^\]]*\]/gi,
  DESCRIBE: /\[DESCRIBE[^\]]*\]/gi,
  EXPLAIN: /\[EXPLAIN[^\]]*\]/gi,
  OUTLINE: /\[OUTLINE[^\]]*\]/gi,
  DATE: /\[DATE\]/gi,
  NUMBER: /\[NUMBER\]/gi,
  SPECIFIC_DETAILS: /\[SPECIFIC DETAILS\]/gi,
} as const;

export type PlaceholderType = keyof typeof PLACEHOLDER_PATTERNS;

export interface PlaceholderMatch {
  type: PlaceholderType;
  match: string;
  requirementId: string;
  requirementIndex: number;
  requirementText: string;
}

export interface RequirementWithPlaceholders {
  id: string;
  index: number;
  text: string;
  placeholders: PlaceholderMatch[];
}

export interface PlaceholderScanResult {
  hasBlockers: boolean;
  totalCount: number;
  byType: Record<PlaceholderType, PlaceholderMatch[]>;
  requirements: RequirementWithPlaceholders[];
}

export interface RequirementForScan {
  id: string;
  text: string;
  draftAnswer: string | null;
  order: number;
}

/**
 * Scan all requirements for placeholder patterns
 */
export function scanForPlaceholders(
  requirements: RequirementForScan[]
): PlaceholderScanResult {
  // Initialize result structure
  const byType: Record<PlaceholderType, PlaceholderMatch[]> = {
    DRAFT: [],
    COMPANY_NAME: [],
    PROVIDE: [],
    CONFIRM: [],
    DESCRIBE: [],
    EXPLAIN: [],
    OUTLINE: [],
    DATE: [],
    NUMBER: [],
    SPECIFIC_DETAILS: [],
  };

  const requirementsWithPlaceholders: RequirementWithPlaceholders[] = [];
  let totalCount = 0;

  // Sort requirements by order to ensure consistent indexing
  const sortedRequirements = [...requirements].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sortedRequirements.length; i++) {
    const req = sortedRequirements[i];
    const content = req.draftAnswer || "";
    const reqPlaceholders: PlaceholderMatch[] = [];

    // Check each placeholder pattern
    for (const [type, pattern] of Object.entries(PLACEHOLDER_PATTERNS)) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        const placeholderMatch: PlaceholderMatch = {
          type: type as PlaceholderType,
          match: match[0],
          requirementId: req.id,
          requirementIndex: i,
          requirementText: req.text.slice(0, 100) + (req.text.length > 100 ? "..." : ""),
        };

        byType[type as PlaceholderType].push(placeholderMatch);
        reqPlaceholders.push(placeholderMatch);
        totalCount++;
      }
    }

    // Add requirement to list if it has placeholders
    if (reqPlaceholders.length > 0) {
      requirementsWithPlaceholders.push({
        id: req.id,
        index: i,
        text: req.text.slice(0, 100) + (req.text.length > 100 ? "..." : ""),
        placeholders: reqPlaceholders,
      });
    }
  }

  return {
    hasBlockers: totalCount > 0,
    totalCount,
    byType,
    requirements: requirementsWithPlaceholders,
  };
}

/**
 * Get a human-readable label for a placeholder type
 */
export function getPlaceholderLabel(type: PlaceholderType): string {
  const labels: Record<PlaceholderType, string> = {
    DRAFT: "Draft Tag",
    COMPANY_NAME: "Company Name",
    PROVIDE: "Information Required",
    CONFIRM: "Confirmation Needed",
    DESCRIBE: "Description Needed",
    EXPLAIN: "Explanation Needed",
    OUTLINE: "Outline Needed",
    DATE: "Date Required",
    NUMBER: "Number Required",
    SPECIFIC_DETAILS: "Details Required",
  };
  return labels[type];
}

/**
 * Get placeholder types that are considered critical blockers
 * vs. warnings that can be exported with draft watermark
 */
export function isCriticalBlocker(type: PlaceholderType): boolean {
  // These placeholders indicate incomplete work that should be addressed
  const critical: PlaceholderType[] = [
    "COMPANY_NAME", // Must be replaced - looks unprofessional
    "PROVIDE",
    "CONFIRM",
    "DESCRIBE",
    "EXPLAIN",
    "OUTLINE",
    "DATE",
    "NUMBER",
    "SPECIFIC_DETAILS",
  ];
  return critical.includes(type);
}
