/**
 * Heuristic Requirement Extractor
 *
 * Complete heuristic-based extraction for RFP requirements.
 * No LLM calls - pure pattern matching for speed and reliability.
 *
 * Part of the Hybrid Heuristic + LLM architecture:
 * - Phase 1: This file extracts AND classifies requirements (0 API calls)
 * - Phase 2: Optional LLM refinement for low-confidence items only
 *
 * Key functions:
 * - extractAndClassifyHeuristically() - Full extraction with classification
 * - findRequirementCandidates() - Find numbered section patterns
 * - detectMajorSections() - Detect section headers for grouping
 */

import { RequirementType } from "../constants";
import {
  classifyTypeHeuristically,
  classifyMandatoryHeuristically,
  TypeClassification,
  MandatoryClassification,
} from "./heuristic-classifier";
import { DomainContext, detectDomainContext } from "../domain-context";
import { classifyAttestation } from "../attestation";

// =============================================================================
// TYPES
// =============================================================================

export interface RequirementCandidate {
  /** Section number as it appears in document: "3.1.2", "A.1", etc. */
  sectionNumber: string;
  /** Raw text following the section number */
  rawText: string;
  /** Position in original document */
  startIndex: number;
  endIndex: number;
  /** Major section number: "3" from "3.1.2" */
  majorSection: string;
}

export interface MajorSection {
  /** Section number: "3", "A" */
  number: string;
  /** Section title if detected: "Technical Requirements" */
  title: string;
  /** Position in document */
  startIndex: number;
}

// =============================================================================
// PATTERN FAMILIES - Extensible pattern matching system
// =============================================================================

/**
 * Pattern family definition for different RFP numbering schemes.
 * Each family can have multiple patterns (2-level, 3-level, etc.)
 */
interface PatternFamily {
  /** Unique identifier for this family */
  id: string;
  /** Human-readable name */
  name: string;
  /** Patterns to detect this family's presence in the document */
  detectionPatterns: RegExp[];
  /** Minimum matches needed to confirm this family is used */
  minMatchesForDetection: number;
  /** Patterns for extracting section numbers (in priority order) */
  extractionPatterns: Array<{
    pattern: RegExp;
    /** How to extract major section from match groups */
    getMajorSection: (match: RegExpMatchArray) => string;
    /** How to build full section number from match groups */
    getSectionNumber: (match: RegExpMatchArray) => string;
    /** Priority level (higher = matched first) */
    priority: number;
    /** Whether this pattern requires line start */
    requiresLineStart: boolean;
  }>;
  /** Patterns for detecting major section headers */
  majorSectionPatterns: RegExp[];
}

/**
 * Convert Roman numeral to number (for sorting/comparison)
 */
function romanToNumber(roman: string): number {
  const values: Record<string, number> = {
    'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000
  };
  let result = 0;
  const upper = roman.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const current = values[upper[i]] || 0;
    const next = values[upper[i + 1]] || 0;
    if (current < next) {
      result -= current;
    } else {
      result += current;
    }
  }
  return result;
}

/**
 * Convert letter to number (A=1, B=2, etc.)
 */
function letterToNumber(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 64;
}

/**
 * All supported pattern families
 */
const PATTERN_FAMILIES: PatternFamily[] = [
  // ==========================================================================
  // NUMERIC: 3.1.2, 3.1, etc. (most common)
  // ==========================================================================
  {
    id: 'numeric',
    name: 'Numeric (X.Y.Z)',
    detectionPatterns: [
      /\b\d+\.\d+\.\d+\.?\s+/g,  // 3.1.2 or 3.1.2.
      /(?:^|\n)\s*\d+\.\d+\s+[A-Z]/gm,  // 3.1 at line start followed by text
    ],
    minMatchesForDetection: 3,
    extractionPatterns: [
      // 3-level: X.Y.Z - highest priority (handles optional trailing dot like "3.2.1.")
      {
        pattern: /(?:^|\s)(\d+)\.(\d+)\.(\d+)\.?\s+/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}.${m[2]}.${m[3]}`,
        priority: 100,
        requiresLineStart: false,
      },
      // 2-level: X.Y - requires line start
      {
        pattern: /(?:^|\n)\s*(\d+)\.(\d+)(?!\.?\d)\s+/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}.${m[2]}`,
        priority: 50,
        requiresLineStart: true,
      },
    ],
    majorSectionPatterns: [
      /(?:^|\n)\s*(\d+)(?:\.0?)?\s+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gm,
      /(?:^|\n)\s*(?:SECTION|Section)\s+(\d+)[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim,
      /(?:^|\s)(\d+)\.0[:\-]?\s*([A-Z][A-Za-z\s,&\-:'"()]{5,}?)(?=\s+\d|$)/gm,
    ],
  },

  // ==========================================================================
  // ROMAN: IV.A.1, II.3, III.2.a, etc.
  // ==========================================================================
  {
    id: 'roman',
    name: 'Roman Numerals (IV.A.1)',
    detectionPatterns: [
      /(?:^|\n)\s*(?:I{1,3}|IV|VI{0,3}|IX|X{1,3}|XI{1,3}|XIV|XV|XVI{0,3}|XIX|XX)\.\s*[A-Z0-9]/gim,
    ],
    minMatchesForDetection: 2,
    extractionPatterns: [
      // Roman.Letter.Number: IV.A.1
      {
        pattern: /(?:^|\n)\s*(I{1,3}|IV|VI{0,3}|IX|X{1,3}|XI{1,3}|XIV|XV|XVI{0,3}|XIX|XX)\.([A-Z])\.(\d+)\s+/gim,
        getMajorSection: (m) => m[1].toUpperCase(),
        getSectionNumber: (m) => `${m[1].toUpperCase()}.${m[2].toUpperCase()}.${m[3]}`,
        priority: 100,
        requiresLineStart: true,
      },
      // Roman.Number: II.3
      {
        pattern: /(?:^|\n)\s*(I{1,3}|IV|VI{0,3}|IX|X{1,3}|XI{1,3}|XIV|XV|XVI{0,3}|XIX|XX)\.(\d+)\s+/gim,
        getMajorSection: (m) => m[1].toUpperCase(),
        getSectionNumber: (m) => `${m[1].toUpperCase()}.${m[2]}`,
        priority: 50,
        requiresLineStart: true,
      },
      // Roman.Letter: IV.A (at line start)
      {
        pattern: /(?:^|\n)\s*(I{1,3}|IV|VI{0,3}|IX|X{1,3}|XI{1,3}|XIV|XV|XVI{0,3}|XIX|XX)\.([A-Z])(?!\.?\w)\s+/gim,
        getMajorSection: (m) => m[1].toUpperCase(),
        getSectionNumber: (m) => `${m[1].toUpperCase()}.${m[2].toUpperCase()}`,
        priority: 40,
        requiresLineStart: true,
      },
    ],
    majorSectionPatterns: [
      /(?:^|\n)\s*(I{1,3}|IV|VI{0,3}|IX|X{1,3}|XI{1,3}|XIV|XV|XVI{0,3}|XIX|XX)[\.\s:]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim,
      /(?:^|\n)\s*(?:SECTION|Section|PART|Part)\s+(I{1,3}|IV|VI{0,3}|IX|X{1,3})[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim,
    ],
  },

  // ==========================================================================
  // LETTER-BASED: A.1.a, A.1, B.2.1, etc.
  // ==========================================================================
  {
    id: 'letter',
    name: 'Letter-based (A.1.a)',
    detectionPatterns: [
      /(?:^|\n)\s*[A-Z]\.\d+\.[a-z]\s+/gm,  // A.1.a at line start
      /(?:^|\n)\s*[A-Z]\.\d+\.\d+\.?\s+/gm, // E.6.7 at line start
      /(?:^|\n)\s*[A-Z]\.\d+\.?\s+[A-Z]/gm, // A.1 at line start followed by text
      // Inline patterns (after sentence endings in PDFs without line breaks)
      /[.?!]\s+[A-Z]\.\d+\.\d+\.?\s+[A-Z]/gm, // E.6.7 after sentence ending
      /[.?!]\s+[A-Z]\.\d+\.?\s+[A-Z]/gm,      // A.1 after sentence ending
    ],
    minMatchesForDetection: 3,
    extractionPatterns: [
      // Letter.Number.Letter: A.1.a
      {
        pattern: /(?:^|\n)\s*([A-Z])\.(\d+)\.([a-z])\s+/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}.${m[2]}.${m[3]}`,
        priority: 100,
        requiresLineStart: true,
      },
      // Letter.Number.Number: A.1.2 or E.6.7. (with optional trailing period) at line start
      {
        pattern: /(?:^|\n)\s*([A-Z])\.(\d+)\.(\d+)\.?\s+/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}.${m[2]}.${m[3]}`,
        priority: 90,
        requiresLineStart: true,
      },
      // Letter.Number.Number: E.6.7. inline after sentence ending (PDF without line breaks)
      {
        pattern: /[.?!]\s+([A-Z])\.(\d+)\.(\d+)\.?\s+/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}.${m[2]}.${m[3]}`,
        priority: 85,
        requiresLineStart: false,
      },
      // Letter.Number: A.1 or E.6. (with optional trailing period) at line start
      {
        pattern: /(?:^|\n)\s*([A-Z])\.(\d+)\.?(?!\.?\w)\s+/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}.${m[2]}`,
        priority: 50,
        requiresLineStart: true,
      },
      // Letter.Number: A.1 inline after sentence ending
      {
        pattern: /[.?!]\s+([A-Z])\.(\d+)\.?(?![.\d])\s+/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}.${m[2]}`,
        priority: 45,
        requiresLineStart: false,
      },
    ],
    majorSectionPatterns: [
      /(?:^|\n)\s*([A-Z])[\.\s:]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gm,
      /(?:^|\n)\s*(?:SECTION|Section|Appendix|APPENDIX)\s+([A-Z])[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim,
    ],
  },

  // ==========================================================================
  // LETTER-NUMBER: A1., B2., C13. (common in tables/forms)
  // ==========================================================================
  {
    id: 'letter-number',
    name: 'Letter-Number (A1., B2.)',
    detectionPatterns: [
      /\[Col 1\]\s*[A-Z]\d+\.\s*\|/gm,      // Table format: [Col 1] A1. |
      /(?:^|\n)\s*[A-Z]\d+\.\s+[A-Z]/gm,    // Line start: A1. followed by text
    ],
    minMatchesForDetection: 3,
    extractionPatterns: [
      // Table format: [Col 1] A1. | [Col 2] text
      {
        pattern: /\[Col 1\]\s*([A-Z])(\d+)\.\s*\|\s*\[Col 2\]\s*/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}${m[2]}`,
        priority: 100,
        requiresLineStart: false,
      },
      // Line start format: A1. text
      {
        pattern: /(?:^|\n)\s*([A-Z])(\d+)\.\s+/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}${m[2]}`,
        priority: 80,
        requiresLineStart: true,
      },
    ],
    majorSectionPatterns: [
      // Markdown headers: # A. REQUIRED BANKING SERVICES or # SECTION A
      /(?:^|\n)#\s+([A-Z])\.?\s+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gm,
      // Markdown headers without letter: # REQUIRED BANKING SERVICES
      /(?:^|\n)#\s+([A-Z])[A-Z\s,&\-:'"()]{3,}(?=\n|$)/gm,
    ],
  },

  // ==========================================================================
  // PARENTHETICAL: (1), (a), (i), 1), a)
  // ==========================================================================
  {
    id: 'parenthetical',
    name: 'Parenthetical ((1), (a))',
    detectionPatterns: [
      /(?:^|\n)\s*\(\d+\)\s+[A-Z]/gm,      // (1) followed by text at line start
      /(?:^|\n)\s*\([a-z]\)\s+[A-Z]/gm,    // (a) followed by text at line start
      /(?:^|\n)\s*\d+\)\s+[A-Z]/gm,        // 1) followed by text at line start
      // Inline detection (after sentence endings) for documents where items aren't at line start
      /[.?!]\s+\(\d+\)\s+[A-Z]/gm,         // (1) after sentence ending
      /[.?!]\s+\d+\)\s+[A-Z]/gm,           // 1) after sentence ending
      /[.?!]\s+[A-Z]\)\s+[A-Z]/gm,         // A) after sentence ending
    ],
    minMatchesForDetection: 3,
    extractionPatterns: [
      // (Number): (1), (2), (10)
      {
        pattern: /(?:^|\n)\s*\((\d+)\)\s+/gm,
        getMajorSection: (m) => 'P',  // Parenthetical group
        getSectionNumber: (m) => `(${m[1]})`,
        priority: 80,
        requiresLineStart: true,
      },
      // (Letter): (a), (b), (c)
      {
        pattern: /(?:^|\n)\s*\(([a-z])\)\s+/gm,
        getMajorSection: (m) => 'P',
        getSectionNumber: (m) => `(${m[1]})`,
        priority: 70,
        requiresLineStart: true,
      },
      // (Roman): (i), (ii), (iii)
      {
        pattern: /(?:^|\n)\s*\((i{1,3}|iv|vi{0,3}|ix|x{1,3})\)\s+/gim,
        getMajorSection: (m) => 'P',
        getSectionNumber: (m) => `(${m[1].toLowerCase()})`,
        priority: 60,
        requiresLineStart: true,
      },
      // Number): 1), 2), 10)
      {
        pattern: /(?:^|\n)\s*(\d+)\)\s+/gm,
        getMajorSection: (m) => 'P',
        getSectionNumber: (m) => `${m[1]})`,
        priority: 50,
        requiresLineStart: true,
      },
      // Letter): a), b), c)
      {
        pattern: /(?:^|\n)\s*([a-z])\)\s+/gm,
        getMajorSection: (m) => 'P',
        getSectionNumber: (m) => `${m[1]})`,
        priority: 40,
        requiresLineStart: true,
      },
      // ---- INLINE PATTERNS (after sentence endings) ----
      // For documents where numbered items appear mid-line after sentences
      // (Number) inline: (1), (2) after sentence ending
      {
        pattern: /[.?!]\s+\((\d+)\)\s+/gm,
        getMajorSection: (m) => 'P',
        getSectionNumber: (m) => `(${m[1]})`,
        priority: 75,  // Lower than line-start version (80)
        requiresLineStart: false,
      },
      // Number) inline: 1), 2) after sentence ending
      {
        pattern: /[.?!]\s+(\d+)\)\s+/gm,
        getMajorSection: (m) => 'P',
        getSectionNumber: (m) => `${m[1]})`,
        priority: 45,  // Lower than line-start version (50)
        requiresLineStart: false,
      },
      // Letter) inline: A), B) after sentence ending (uppercase)
      {
        pattern: /[.?!]\s+([A-Z])\)\s+/gm,
        getMajorSection: (m) => 'P',
        getSectionNumber: (m) => `${m[1]})`,
        priority: 35,  // New pattern for uppercase letters
        requiresLineStart: false,
      },
    ],
    majorSectionPatterns: [
      // Parenthetical sections usually don't have major headers, but check for Section (1):
      /(?:^|\n)\s*\((\d+)\)[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{5,}?)(?=\n|$)/gm,
    ],
  },

  // ==========================================================================
  // OUTLINE: a., b., c., i., ii., iii. (letters/roman numerals with periods)
  // Common in formal/legal RFPs - different from parenthetical (a), a)
  // ==========================================================================
  {
    id: 'outline',
    name: 'Outline (a., b., i., ii.)',
    detectionPatterns: [
      // Lowercase letters with period at line start: a. b. c.
      /(?:^|\n)\s*[a-z]\.\s+[A-Z]/gm,
      // Lowercase roman numerals with period at line start: i. ii. iii. iv. v.
      /(?:^|\n)\s*(?:i{1,3}|iv|vi{0,3}|ix|x{1,3})\.\s+[A-Z]/gim,
      // Uppercase letters with period after numbers (nested): 1. A. text
      /(?:^|\n)\s*\d+\.\s+[A-Z]\.\s+/gm,
      // INLINE detection (after sentence endings) for PDFs without line breaks
      /[.?!]\s+[a-z]\.\s+[A-Z]/gm,           // a. after sentence ending
      /[.?!]\s+(?:i{1,3}|iv|vi{0,3})\.\s+[A-Z]/gim,  // i. ii. iii. after sentence
    ],
    minMatchesForDetection: 3,
    extractionPatterns: [
      // Lowercase letter with period: a. b. c. (at line start)
      {
        pattern: /(?:^|\n)\s*([a-z])\.\s+/gm,
        getMajorSection: (m) => 'O',  // Outline group
        getSectionNumber: (m) => `${m[1]}.`,
        priority: 60,
        requiresLineStart: true,
      },
      // Lowercase roman numeral with period: i. ii. iii. (at line start)
      {
        pattern: /(?:^|\n)\s*(i{1,3}|iv|vi{0,3}|ix|x{1,3})\.\s+/gim,
        getMajorSection: (m) => 'O',
        getSectionNumber: (m) => `${m[1].toLowerCase()}.`,
        priority: 50,
        requiresLineStart: true,
      },
      // INLINE: Lowercase letter with period after sentence ending
      {
        pattern: /[.?!]\s+([a-z])\.\s+/gm,
        getMajorSection: (m) => 'O',
        getSectionNumber: (m) => `${m[1]}.`,
        priority: 55,
        requiresLineStart: false,
      },
      // INLINE: Lowercase roman numeral with period after sentence ending
      {
        pattern: /[.?!]\s+(i{1,3}|iv|vi{0,3}|ix|x{1,3})\.\s+/gim,
        getMajorSection: (m) => 'O',
        getSectionNumber: (m) => `${m[1].toLowerCase()}.`,
        priority: 45,
        requiresLineStart: false,
      },
    ],
    majorSectionPatterns: [
      // Outline sections typically don't have major headers
      /(?:^|\n)\s*([a-z])\.\s+([A-Z][A-Za-z\s,&\-:'"()]{10,}?)(?=\n|$)/gm,
    ],
  },

  // ==========================================================================
  // BRACKET/ID: [REQ-001], [3.1], [R1], REQ-001, etc.
  // ==========================================================================
  {
    id: 'bracket',
    name: 'Bracket/ID ([REQ-001])',
    detectionPatterns: [
      /\[REQ[-_]?\d+\]/gi,                    // [REQ-001], [REQ001]
      /\[R\d+\]/gi,                           // [R1], [R2]
      /(?:^|\n)\s*REQ[-_]?\d+[.:\s]+/gim,     // REQ-001: at line start
      /\[\d+\.\d+\]/g,                        // [3.1]
    ],
    minMatchesForDetection: 2,
    extractionPatterns: [
      // [REQ-NNN] or [REQ_NNN] or [REQNNN]
      {
        pattern: /(?:^|\s)\[(REQ)[-_]?(\d+)\]\s*/gim,
        getMajorSection: (m) => 'REQ',
        getSectionNumber: (m) => `REQ-${m[2]}`,
        priority: 100,
        requiresLineStart: false,
      },
      // [R1], [R2], etc.
      {
        pattern: /(?:^|\s)\[(R)(\d+)\]\s*/gim,
        getMajorSection: (m) => 'R',
        getSectionNumber: (m) => `R${m[2]}`,
        priority: 90,
        requiresLineStart: false,
      },
      // REQ-NNN: or REQ-NNN. at line start
      {
        pattern: /(?:^|\n)\s*(REQ)[-_]?(\d+)[.:]\s*/gim,
        getMajorSection: (m) => 'REQ',
        getSectionNumber: (m) => `REQ-${m[2]}`,
        priority: 80,
        requiresLineStart: true,
      },
      // [X.Y] bracket notation
      {
        pattern: /(?:^|\s)\[(\d+)\.(\d+)\]\s*/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `[${m[1]}.${m[2]}]`,
        priority: 70,
        requiresLineStart: false,
      },
    ],
    majorSectionPatterns: [
      // Bracket formats typically don't have traditional major sections
      /(?:^|\n)\s*\[(REQ|SECTION)[-_]?(\d+)\][.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim,
    ],
  },
];

/**
 * Detect which pattern families are present in the document.
 * Returns families sorted by match count (most matches first).
 */
function detectPatternFamilies(text: string): PatternFamily[] {
  const familyMatches: Array<{ family: PatternFamily; matchCount: number }> = [];

  for (const family of PATTERN_FAMILIES) {
    let totalMatches = 0;

    for (const pattern of family.detectionPatterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      const matches = text.match(pattern);
      if (matches) {
        totalMatches += matches.length;
      }
    }

    if (totalMatches >= family.minMatchesForDetection) {
      familyMatches.push({ family, matchCount: totalMatches });
    }
  }

  // Sort by match count descending
  familyMatches.sort((a, b) => b.matchCount - a.matchCount);

  console.log(`[heuristic-extractor] Detected pattern families:`,
    familyMatches.map(f => `${f.family.name} (${f.matchCount} matches)`));

  return familyMatches.map(f => f.family);
}

// =============================================================================
// CANDIDATE EXTRACTION
// =============================================================================

/**
 * Find all requirement candidates in a document using pattern matching.
 *
 * Supports multiple numbering formats:
 * - Numeric: 3.1.2, 3.1
 * - Roman numerals: IV.A.1, II.3
 * - Letter-based: A.1.a, A.1
 * - Parenthetical: (1), (a), 1)
 * - Bracket/ID: [REQ-001], REQ-001
 *
 * For each match, extracts the text until the next numbered item.
 */
export function findRequirementCandidates(text: string): RequirementCandidate[] {
  // Step 0: Detect which pattern families are present in this document
  const detectedFamilies = detectPatternFamilies(text);

  // Step 0b: Detect major sections for validation
  const detectedMajorSections = detectMajorSections(text);
  const validMajorSectionNumbers = new Set(detectedMajorSections.keys());

  // Step 1: Find all section number positions using detected pattern families
  interface Match {
    sectionNumber: string;
    index: number;
    majorSection: string;
    textStart: number; // Where the actual text starts (after the number)
    priority: number;  // For deduplication
    familyId: string;  // Which family this came from
  }

  const matches: Match[] = [];

  // If no families detected, fall back to numeric
  const familiesToUse = detectedFamilies.length > 0
    ? detectedFamilies
    : [PATTERN_FAMILIES[0]]; // numeric is first

  // Extract matches from each detected family
  for (const family of familiesToUse) {
    for (const extPattern of family.extractionPatterns) {
      // Reset pattern for fresh matching
      extPattern.pattern.lastIndex = 0;
      let match;

      while ((match = extPattern.pattern.exec(text)) !== null) {
        const sectionNumber = extPattern.getSectionNumber(match);
        const majorSection = extPattern.getMajorSection(match);

        // Calculate actual match start (skip leading whitespace/newline)
        const leadingChars = match[0].match(/^[\s\n]*/)?.[0].length || 0;
        const actualIndex = match.index + leadingChars;

        // Skip if we already have a higher-priority match at similar position
        const isDuplicate = matches.some(m =>
          Math.abs(m.index - actualIndex) < 10 &&
          (m.sectionNumber === sectionNumber || m.priority >= extPattern.priority)
        );
        if (isDuplicate) continue;

        // For numeric family with 2-level patterns, validate against major sections
        if (family.id === 'numeric' && extPattern.priority < 100) {
          // This is a 2-level pattern, validate
          if (!validMajorSectionNumbers.has(majorSection)) {
            continue;
          }

          // Check for version number false positives
          const beforeText = text.substring(Math.max(0, actualIndex - 15), actualIndex).toLowerCase();
          const versionPattern = /(?:version|v\.|release)\s*$/;
          if (versionPattern.test(beforeText)) {
            continue;
          }

          // Check for date false positives (e.g., 6.01.2023, 12.31.2024)
          // Date patterns: M.DD.YYYY, MM.DD.YYYY, D.DD.YYYY where month 1-12, day 01-31, year 20XX
          const datePattern = /^(1[0-2]|[1-9])\.(0[1-9]|[12]\d|3[01])\.(20\d{2})$/;
          if (datePattern.test(sectionNumber)) {
            continue;
          }

          // Skip if major section seems inconsistent
          const existingNums = matches
            .filter(m => m.familyId === 'numeric')
            .map(m => parseInt(m.majorSection))
            .filter(n => !isNaN(n));
          if (existingNums.length > 0) {
            const majorNum = parseInt(majorSection);
            const maxExisting = Math.max(...existingNums);
            const minExisting = Math.min(...existingNums);
            if (majorNum > maxExisting + 3 || majorNum < minExisting - 1) {
              continue;
            }
          }
        }

        matches.push({
          sectionNumber,
          index: actualIndex,
          majorSection,
          textStart: match.index + match[0].length,
          priority: extPattern.priority,
          familyId: family.id,
        });
      }
    }
  }

  // Sort matches by position in document
  matches.sort((a, b) => a.index - b.index);

  console.log(`[heuristic-extractor] Found ${matches.length} section number patterns from families:`,
    [...new Set(matches.map(m => m.familyId))].join(', '));

  // Step 2: Extract text for each match
  const candidates: RequirementCandidate[] = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    // Text starts after the section number
    const startIndex = current.textStart;

    // Text ends at next section number, or max 3000 chars if no next section (last requirement)
    const endIndex = next
      ? next.index
      : Math.min(startIndex + 3000, text.length);

    const rawText = text.substring(startIndex, endIndex).trim();

    // Strip trailing section number + title contamination
    // Handles multiple formats: X.Y, X.Y.Z, [X.Y], REQ-NNN, A.1, IV.A, etc.
    let cleanedText = rawText
      // Numeric: "...testing? 3.5 Integrations" or "...text 4.0: Section Title"
      .replace(/\s+\d+\.\d+(?:\.\d+)?[:\s]+[A-Z][A-Za-z\s,&\-:]+$/, '')
      // Bracket: "...[3.1] Title"
      .replace(/\s+\[\d+\.\d+\][:\s]+[A-Z][A-Za-z\s,&\-:]+$/, '')
      // REQ-NNN: "...REQ-001 Title"
      .replace(/\s+REQ[-_]?\d+[:\s]+[A-Z][A-Za-z\s,&\-:]+$/i, '')
      // Letter-based: "...A.1 Title"
      .replace(/\s+[A-Z]\.\d+(?:\.[a-z\d]+)?[:\s]+[A-Z][A-Za-z\s,&\-:]+$/, '')
      // Roman: "...IV.A Title"
      .replace(/\s+(?:I{1,3}|IV|VI{0,3}|IX|X{1,3})\.?[A-Z]?[:\s]+[A-Z][A-Za-z\s,&\-:]+$/i, '')
      .trim();

    // Strip DOCX table markers that may have bled into requirement text
    // IMPORTANT: Order matters! Full [Col X] must be cleaned BEFORE partial Col X]
    // Process multiple passes as some markers are nested
    let prevLength;
    do {
      prevLength = cleanedText.length;
      cleanedText = cleanedText
        // First: Full bracket markers (must come before partial pattern cleanup)
        .replace(/\[TABLE START\]/gi, '')
        .replace(/\[TABLE END\]/gi, '')
        .replace(/\[HEADER\]/gi, '')
        .replace(/\[Col \d+\]/gi, '')  // Full [Col X] - MUST be before partial Col X]
        .replace(/\[ROW \d+\]/gi, '')
        // Then: Partial markers (missing opening bracket) - AFTER full patterns
        .replace(/\bCol \d+\]/g, '')
        .trim();
    } while (cleanedText.length !== prevLength && prevLength > 0);

    cleanedText = cleanedText
      // Strip box-drawing characters (table borders from DOCX)
      .replace(/[═─│╔╗╚╝╠╣╦╩╬╒╓╘╙╛╜╞╟╡╢╤╥╧╨╪╫]+/g, '')
      // Strip evaluation column patterns (common in RFP response tables)
      .replace(/\|\s*(?:Pass|Fail|Yes|No|Compliant|Non-?compliant|N\/A|TBD|TBC)[\/|]?(?:Pass|Fail|Yes|No|Compliant|Non-?compliant|N\/A|TBD|TBC)?\s*/gi, '')
      // Strip response prompts from form-based RFPs
      .replace(/\s*(?:Enter|Type|Insert|Provide)\s+(?:response|answer|reply)\s+here:?\s*/gi, '')
      .replace(/\s*(?:Bidder|Vendor|Contractor|Respondent)\s+(?:response|answer|reply):?\s*/gi, '')
      // Strip stray table cell separators and pipes
      .replace(/\s*\|\s*/g, ' ')  // Convert all pipes to spaces
      // Clean multiple whitespace
      .replace(/\s+/g, ' ')
      .trim();

    // Strip trailing content that looks like next requirement title bleeding in
    // These are typically 1-4 words at the end, after the actual requirement question ends
    // Pattern examples: "Dedicated IP address", "Account structure", "Send volumes", "Demo accounts"
    // NOTE: Use possessive-like matching to avoid catastrophic backtracking
    cleanedText = cleanedText
      // After closing paren: "...(text)Dedicated IP address" → "...(text)"
      // Simpler pattern: just 1-5 capitalized words at the end
      .replace(/\)\s*([A-Z][a-zA-Z]*(?:\s+[a-zA-Z-]+){0,4})\s*$/, ')')
      // After sentence-ending punctuation: "...answer? Account structure" → "...answer?"
      // Simpler pattern: 1-5 words after punctuation
      .replace(/([.?!]["']?)\s+([A-Z][a-zA-Z]*(?:\s+[a-zA-Z-]+){0,4})\s*$/, (match, punct, title) => {
        // Only strip if the title is short (likely a next section heading)
        if (title.length > 50) return match;
        // Keep if it has common sentence words (probably not a title)
        if (/\b(?:the|and|or|is|are|was|were|a|an|to|for|in|of|on|with|by|from|as|at|this|that|these|those|it|its|can|will|would|should|must|may|might|have|has|had|been|being|do|does|did|so|than|also|just|only|about|after|before|into|through|during|without|within)\b/i.test(title)) return match;
        return punct; // Keep the punctuation, strip the title
      })
      .trim();

    // Detect and format inline lists (items separated by double-space OR matching "N - Item" pattern)
    // Pattern 1: Double-space separated items
    const doubleSpaceCount = (cleanedText.match(/  +/g) || []).length;
    if (doubleSpaceCount >= 3) {
      const potentialItems = cleanedText.split(/  +/);
      const listPattern = /^(\d+\s*[-–—]|[A-Z][a-zA-Z\s]+\s*[-–—])/i;
      const listLikeItems = potentialItems.filter(item => listPattern.test(item.trim()));

      if (listLikeItems.length >= 3 && listLikeItems.length >= potentialItems.length * 0.5) {
        // Check if first item is intro text (doesn't match list pattern)
        const firstItem = potentialItems[0].trim();
        const isFirstItemIntro = !listPattern.test(firstItem);

        if (isFirstItemIntro && firstItem.length > 0) {
          // Check if intro contains an embedded first list item (pattern: "intro: N - item")
          const embeddedMatch = firstItem.match(/^(.+?:\s*)(\d+\s*[-–—]\s*.+)$/);
          let intro: string;
          let firstListItem: string | null = null;

          if (embeddedMatch) {
            // Split intro from embedded first list item
            intro = embeddedMatch[1].trim() + '\n';
            firstListItem = embeddedMatch[2].trim();
          } else {
            intro = firstItem.replace(/:$/, ':\n');
          }

          const remainingItems = potentialItems.slice(1)
            .map(item => item.trim())
            .filter(item => item.length > 0);

          // Prepend first list item if it was embedded
          if (firstListItem) {
            remainingItems.unshift(firstListItem);
          }

          const listItems = remainingItems
            .map(item => `• ${item}`)
            .join('\n');
          cleanedText = intro + listItems;
        } else {
          // All items are list items
          cleanedText = potentialItems
            .map(item => item.trim())
            .filter(item => item.length > 0)
            .map(item => `• ${item}`)
            .join('\n');
        }
      }
    }

    // Pattern 2: Inline "N - Description" items (e.g., "2 - General Operating Accounts ... 2 - Controlled...")
    // Look for 3+ occurrences of "N - " pattern indicating embedded list
    const inlineListMatches = cleanedText.match(/\d+\s*[-–—]\s*[A-Z][^.?!]*(?=[.?!]|\d+\s*[-–—]|$)/g);
    if (inlineListMatches && inlineListMatches.length >= 3 && !cleanedText.includes('\n•')) {
      // Split on the pattern and format as bullets
      const parts = cleanedText.split(/(?=\d+\s*[-–—]\s*[A-Z])/);
      if (parts.length >= 3) {
        // First part may be intro text (not a list item) - check if it starts with the list pattern
        const firstPart = parts[0].trim();
        const isFirstPartListItem = /^\d+\s*[-–—]\s*[A-Z]/.test(firstPart);

        if (isFirstPartListItem) {
          // All parts are list items
          cleanedText = parts
            .map(p => p.trim())
            .filter(p => p.length > 0)
            .map(p => `• ${p}`)
            .join('\n');
        } else {
          // First part is intro text, rest are list items
          const intro = firstPart.replace(/:$/, ':\n'); // Add newline after colon if present
          const listItems = parts.slice(1)
            .map(p => p.trim())
            .filter(p => p.length > 0)
            .map(p => `• ${p}`)
            .join('\n');
          cleanedText = intro + listItems;
        }
      }
    }

    // Clean up resulting multiple spaces/newlines
    cleanedText = cleanedText
      .replace(/\n{3,}/g, '\n\n')
      .replace(/  +/g, ' ')
      .trim();

    // Strip page numbers and document titles (e.g., "29 of 38 Request for Proposal: Website Design...")
    cleanedText = cleanedText.replace(
      /\s+\d+\s+of\s+\d+\s+Request\s+for\s+Proposal[^]*$/i,
      ''
    ).trim();

    // Strip other common page header/footer patterns
    cleanedText = cleanedText.replace(
      /\s+Page\s+\d+\s+of\s+\d+[^]*$/i,
      ''
    ).trim();

    // Skip very short matches (likely false positives)
    if (cleanedText.length < 10) {
      continue;
    }

    // ==========================================================================
    // GARBAGE FILTERING: Skip non-requirement content
    // ==========================================================================

    // Skip DEFINITIONS/GLOSSARY entries: "Term" means... or starts with "means"
    // These are definitions, not requirements to respond to
    // Handles straight quotes "", curly quotes "", and angled quotes «»
    // Also handles "Term" or "Synonym" means... patterns
    const quoteChars = '""\\u201C\\u201D\\u00AB\\u00BB';
    if (/^[""\u201C\u201D\u00AB\u00BB][^""\u201C\u201D\u00AB\u00BB]+[""\u201C\u201D\u00AB\u00BB]?\s+means\b/i.test(cleanedText) ||
        /^means\s+/i.test(cleanedText) ||
        /^[""\u201C\u201D\u00AB\u00BB]?[A-Za-z\s\-]+[""\u201C\u201D\u00AB\u00BB]?\s+means\s+/i.test(cleanedText) ||
        // "Term" or "Synonym" means... pattern
        /^[""\u201C\u201D\u00AB\u00BB][^""\u201C\u201D\u00AB\u00BB]+[""\u201C\u201D\u00AB\u00BB]\s+or\s+[""\u201C\u201D\u00AB\u00BB][^""\u201C\u201D\u00AB\u00BB]+[""\u201C\u201D\u00AB\u00BB]\s+means\b/i.test(cleanedText)) {
      continue;
    }

    // Skip BUILDING/LOCATION LISTS: Building name + address + sqft
    // Common in facility RFPs - these are location info, not requirements
    // Pattern: "Building Name Address City, State ZIP sqft"
    // Handles numbers like 78,983 sqft or 115308 sqft
    if (/[\d,]+\s*(?:sq\.?\s*ft|sqft|square\s*feet)\b/i.test(cleanedText) &&
        cleanedText.length < 200) {
      continue;
    }

    // Skip ADDRESS-ONLY entries: Just an address without actionable requirement
    // Pattern: Street address followed by city/state/ZIP
    if (/^\d+\s+[A-Za-z\s]+(?:Avenue|Ave|Street|St|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Circle|Cir)\b/i.test(cleanedText) &&
        /\b[A-Z]{2}\s+\d{5}\b/.test(cleanedText) &&
        cleanedText.length < 150) {
      continue;
    }

    candidates.push({
      sectionNumber: current.sectionNumber,
      rawText: cleanedText,
      startIndex: current.index,
      endIndex,
      majorSection: current.majorSection,
    });
  }

  console.log(`[heuristic-extractor] Extracted ${candidates.length} valid candidates`);

  return candidates;
}

// =============================================================================
// MAJOR SECTION DETECTION
// =============================================================================

/**
 * Detect major section headers and their titles.
 *
 * Supports multiple formats:
 * - Numeric: "3.0 Technical Requirements", "Section 3: Title"
 * - Roman: "IV. Technical Requirements", "Part IV: Title"
 * - Letter: "A. Technical Requirements", "Section A: Title"
 * - Bracket: "[SECTION-1] Title"
 *
 * Returns a map of section number -> title
 */
export function detectMajorSections(text: string): Map<string, MajorSection> {
  const sections = new Map<string, MajorSection>();

  // Priority-ordered patterns for detecting major section headers
  // IMPORTANT: PDF text often lacks clean newlines, so we need patterns that work inline
  // Key insight: Title boundaries should be: newline, next section number (X.Y), dots (...), or end
  // Do NOT use (?=\s+[a-z]) as lookahead - it wrongly terminates at lowercase words like "to"
  const patterns = [
    // Pattern 1: "X.0 Title" - greedily capture title words until real boundary
    // Boundary: newline, next section number (digit.digit), dots (...), or end
    // This correctly captures "3.0 Direct Query Questions to RFP Respondents"
    /(?:^|\s)(\d+)\.0\s+([A-Z][A-Za-z][A-Za-z\s,&\-:'"()]*?)(?=\s*\n|\s+\d+\.\d|\s*\.{2,}|\s*$)/gm,

    // Pattern 2: "X.0: Title" or "X.0 - Title" format (e.g., "4.0: Additional Direct Query Questions")
    /(?:^|\s)(\d+)\.0[:\-]\s*([A-Z][A-Za-z][A-Za-z\s,&\-:'"()]*?)(?=\s*\n|\s+\d+\.\d|\s*\.{2,}|\s*$)/gm,

    // Pattern 3: "X.0 Title" or "X. Title" at start of line (clean line-based detection)
    /(?:^|\n)\s*(\d+)(?:\.0?)?\s+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gm,

    // Pattern 4: "Section X: Title" or "SECTION X - Title"
    /(?:^|\n)\s*(?:SECTION|Section)\s+(\d+)[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim,

    // Pattern 5: ALL CAPS headers at start of line
    /(?:^|\n)\s*(\d+)(?:\.0?)?\s+([A-Z][A-Z\s,&\-:'"()]{5,}?)(?=\n|$)/gm,

    // Pattern 6: Roman numeral sections "IV. Title" or "IV: Title"
    /(?:^|\n)\s*(I{1,3}|IV|VI{0,3}|IX|X{1,3})[\.\s:]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim,

    // Pattern 7: Letter sections "A. Title" or "Section A: Title"
    /(?:^|\n)\s*(?:SECTION|Section|Appendix)?\s*([A-Z])[\.\s:]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gm,

    // Pattern 8: Markdown headers "# A. REQUIRED BANKING SERVICES" or "# GENERAL INFORMATION"
    /(?:^|\n)#\s+([A-Z])\.?\s+([A-Z][A-Z\s,&\-:'"()]{3,}?)(?=\n|$)/gm,
  ];

  for (let pIdx = 0; pIdx < patterns.length; pIdx++) {
    const pattern = patterns[pIdx];
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const sectionNum = match[1];
      let title = (match[2] || '').trim();

      // Skip if already found (first match wins - earlier patterns have priority)
      if (sections.has(sectionNum)) continue;

      // Clean up title - remove trailing punctuation and truncate
      title = title.replace(/[.:\-,]+$/, '').trim();

      // Remove common suffixes like page numbers "11 of 38"
      title = title.replace(/\s+\d+\s+of\s+\d+.*$/i, '').trim();

      // Truncate if too long
      if (title.length > 60) {
        title = title.substring(0, 60).replace(/\s+\S*$/, '');
      }

      // Skip if title is too short or looks like a false positive
      if (title.length < 3) continue;
      if (/^\d+$/.test(title)) continue; // Skip if title is just numbers

      sections.set(sectionNum, {
        number: sectionNum,
        title,
        startIndex: match.index,
      });
    }
  }

  console.log(`[heuristic-extractor] Detected ${sections.size} major sections:`,
    Array.from(sections.entries()).map(([k, v]) => `${k}: ${v.title}`));

  return sections;
}

// =============================================================================
// QUESTION-BASED CANDIDATE EXTRACTION (SUPPLEMENTARY)
// =============================================================================

/**
 * Find additional candidates based on question patterns.
 * Catches requirements that might not have X.Y.Z numbering.
 *
 * Looks for:
 * - Sentences ending with "?"
 * - Imperative phrases: "Describe your...", "Provide...", "Explain..."
 */
export function findQuestionCandidates(
  text: string,
  existingCandidates: RequirementCandidate[]
): RequirementCandidate[] {
  // Build a set of positions already covered by numbered candidates
  const coveredRanges: Array<{start: number, end: number}> = existingCandidates.map(c => ({
    start: c.startIndex,
    end: c.endIndex,
  }));

  const isPositionCovered = (pos: number): boolean => {
    return coveredRanges.some(r => pos >= r.start && pos <= r.end);
  };

  const additionalCandidates: RequirementCandidate[] = [];

  // Find question sentences
  const questionPattern = /[A-Z][^.!?]*\?/g;
  let match;

  while ((match = questionPattern.exec(text)) !== null) {
    // Skip if already covered by a numbered candidate
    if (isPositionCovered(match.index)) continue;

    let rawText = match[0].trim();

    // Apply table marker cleanup (same as numbered candidates)
    let prevLen;
    do {
      prevLen = rawText.length;
      rawText = rawText
        .replace(/\[TABLE START\]/gi, '')
        .replace(/\[TABLE END\]/gi, '')
        .replace(/\[HEADER\]/gi, '')
        .replace(/\[Col \d+\]/gi, '')
        .replace(/\[ROW \d+\]/gi, '')
        .replace(/\bCol \d+\]/g, '')
        .trim();
    } while (rawText.length !== prevLen && prevLen > 0);
    rawText = rawText.replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();

    // Skip short questions (likely not requirements)
    if (rawText.length < 30) continue;

    // === GARBAGE DETECTION: Filter out navigation/menu text ===
    // Skip if contains bullet points (•) - likely navigation or menu
    if (rawText.includes('•') || rawText.includes('►') || rawText.includes('■')) continue;

    // Skip if looks like concatenated menu items (many capitalized short words)
    const words = rawText.split(/\s+/);
    const shortCapitalizedWords = words.filter(w => /^[A-Z][a-z]{0,8}$/.test(w));
    if (shortCapitalizedWords.length > 5 && shortCapitalizedWords.length / words.length > 0.4) continue;

    // Skip if contains year patterns typical of event listings (2017, 2018, etc.)
    if (/\b20\d{2}\s+(DLC|Conference|Meeting|Summit|Event)\b/i.test(rawText)) continue;

    // Skip if too many "&" or "|" separators (menu/navigation)
    const separatorCount = (rawText.match(/[&|]/g) || []).length;
    if (separatorCount > 3) continue;

    // Skip if it's just a list of proper nouns without verbs
    const hasVerb = /\b(is|are|does|do|can|will|would|should|must|shall|have|has|provide|describe|explain|support|require)\b/i.test(rawText);
    if (!hasVerb && rawText.length < 100) continue;

    // === MAINTENANCE TICKET / WORK ORDER GARBAGE DETECTION ===
    // Skip maintenance ticket patterns: "MLK, 1st floor - Can we please..."
    if (/^\w+,\s+(?:\w+\s+)?\d+.*-/.test(rawText)) continue;  // "MLK, 1st floor -"
    // Skip timestamps often found in work tickets: 4/17/24 11:22:58
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}/.test(rawText)) continue;
    // Skip overly casual/informal questions (maintenance requests)
    if (/\b(?:please can|can we please|can someone|can you)\b/i.test(rawText) && rawText.length < 80) continue;
    // Skip building/room reference patterns at start: "FAC, RM 216", "MLK, Room 101"
    if (/^[A-Z]{2,}\s*,\s*(?:RM|Room|Floor|Bldg)/i.test(rawText)) continue;

    // Try to find a section context by looking backwards
    const beforeText = text.substring(Math.max(0, match.index - 200), match.index);
    const sectionMatch = beforeText.match(/(\d+)\.(\d+)(?:\.(\d+))?\b[^]*$/);

    const sectionNumber = sectionMatch
      ? sectionMatch[0].match(/(\d+)\.(\d+)(?:\.(\d+))?/)?.[0] || 'Q'
      : 'Q'; // "Q" for unnumbered questions

    additionalCandidates.push({
      sectionNumber,
      rawText,
      startIndex: match.index,
      endIndex: match.index + rawText.length,
      majorSection: sectionNumber.split('.')[0],
    });
  }

  console.log(`[heuristic-extractor] Found ${additionalCandidates.length} additional question-based candidates`);

  return additionalCandidates;
}

// =============================================================================
// MAIN EXTRACTION FUNCTION
// =============================================================================

export interface HeuristicExtractionResult {
  candidates: RequirementCandidate[];
  majorSections: Map<string, MajorSection>;
  stats: {
    numberedCandidates: number;
    questionCandidates: number;
    majorSectionsDetected: number;
  };
}

/**
 * Main entry point for heuristic extraction.
 * Combines numbered candidates + question candidates + major section detection.
 */
export function extractCandidatesHeuristically(text: string): HeuristicExtractionResult {
  console.log(`[heuristic-extractor] Starting heuristic extraction on ${text.length} chars`);
  const startTime = Date.now();

  // Find numbered candidates (primary)
  const numberedCandidates = findRequirementCandidates(text);

  // Find question-based candidates (supplementary)
  const questionCandidates = findQuestionCandidates(text, numberedCandidates);

  // Detect major sections for sectionGroup
  const majorSections = detectMajorSections(text);

  // Combine candidates
  const allCandidates = [...numberedCandidates, ...questionCandidates];

  // Sort by position in document
  allCandidates.sort((a, b) => a.startIndex - b.startIndex);

  const elapsed = Date.now() - startTime;
  console.log(`[heuristic-extractor] Complete in ${elapsed}ms: ${allCandidates.length} candidates`);

  return {
    candidates: allCandidates,
    majorSections,
    stats: {
      numberedCandidates: numberedCandidates.length,
      questionCandidates: questionCandidates.length,
      majorSectionsDetected: majorSections.size,
    },
  };
}

// =============================================================================
// CLASSIFIED REQUIREMENT TYPE
// =============================================================================

/**
 * A fully classified requirement ready for storage/display.
 * This is the output of the heuristic extraction process.
 */
export interface ClassifiedRequirement {
  /** Unique ID (generated) */
  id: string;
  /** Section number: "3.1.2", "A.1", etc. */
  sectionNumber: string;
  /** Section group/title: "Technical Requirements", etc. */
  sectionGroup: string;
  /** The requirement text */
  text: string;
  /** Requirement type classification */
  type: RequirementType;
  /** Confidence in type classification (0-100) */
  typeConfidence: number;
  /** Pattern that matched for type (debugging) */
  typePattern?: string;
  /** Domain context: FEATURE, PROCESS, or LEGAL */
  domainContext: DomainContext;
  /** Whether this requirement is attestation-eligible (binary compliant/non-compliant) */
  isAttestation: boolean;
  /** Whether this is mandatory */
  isMandatory: boolean;
  /** Confidence in mandatory classification (0-100) */
  mandatoryConfidence: number;
  /** Pattern that matched for mandatory (debugging) */
  mandatoryPattern?: string;
  /** Original position in document */
  position: number;
  /** Whether this requirement needs manual review due to potential extraction issues */
  needsReview: boolean;
  /** Reasons why this requirement needs review (if any) */
  reviewReasons?: string[];
}

/**
 * Detect if a requirement looks "funky" and needs manual review.
 * Returns an array of reasons if issues found, empty array if clean.
 */
function detectReviewReasons(text: string, sectionNumber: string): string[] {
  const reasons: string[] = [];

  // Check for leftover table markers
  if (/\[Col\s*\d*\]?|\[ROW\s*\d*\]?|\[TABLE|\[HEADER\]/i.test(text)) {
    reasons.push('Contains table markers');
  }

  // Check for stray pipe characters (likely table artifacts)
  if (/\s\|\s/.test(text) || /^\s*\||\|\s*$/.test(text)) {
    reasons.push('Contains pipe characters (possible table artifact)');
  }

  // Check for box-drawing characters
  if (/[═─│╔╗╚╝╠╣╦╩╬╒╓╘╙╛╜╞╟╡╢╤╥╧╨╪╫]/.test(text)) {
    reasons.push('Contains box-drawing characters');
  }

  // Check for very short text (after cleanup)
  if (text.trim().length < 25) {
    reasons.push('Very short text (< 25 chars)');
  }

  // Check for multiple section numbers embedded in text (extraction error)
  const sectionPatterns = text.match(/\b\d+\.\d+(?:\.\d+)?\b/g) || [];
  if (sectionPatterns.length > 2) {
    reasons.push('Multiple section numbers in text (possible extraction error)');
  }

  // Check for high ratio of special characters (excluding common punctuation)
  const specialChars = text.match(/[^\w\s.,;:?!'"\-()]/g) || [];
  const specialRatio = specialChars.length / text.length;
  if (specialRatio > 0.1 && text.length > 50) {
    reasons.push('High ratio of special characters');
  }

  // Check for repeated characters suggesting OCR/parsing errors (6+ in a row)
  // Exclude underscores (common in form fill-in blanks) and dashes
  if (/([^_\-])\1{5,}/.test(text)) {
    reasons.push('Repeated characters (possible OCR error)');
  }

  // Note: Question-based extraction (sectionNumber === 'Q') is valid and shouldn't
  // automatically flag for review - only flag if there are other issues

  return reasons;
}

export interface ClassifiedExtractionResult {
  requirements: ClassifiedRequirement[];
  stats: {
    total: number;
    byType: Record<RequirementType, number>;
    mandatory: number;
    optional: number;
    lowConfidenceCount: number;
    needsReviewCount: number;
    avgTypeConfidence: number;
    avgMandatoryConfidence: number;
    extractionTimeMs: number;
  };
  /** Requirement IDs that may benefit from LLM refinement */
  lowConfidenceIds: string[];
  /** Requirement IDs that need manual review due to extraction issues (skip LLM) */
  needsReviewIds: string[];
}

// =============================================================================
// MAIN CLASSIFIED EXTRACTION FUNCTION
// =============================================================================

/**
 * Extract and classify all requirements from a document using only heuristics.
 *
 * This is the main entry point for Phase 1 of the hybrid architecture.
 * Returns fully classified requirements with confidence scores.
 *
 * @param text - The preprocessed document text
 * @param confidenceThreshold - Below this, mark for LLM refinement (default: 70)
 */
export function extractAndClassifyHeuristically(
  text: string,
  confidenceThreshold: number = 70
): ClassifiedExtractionResult {
  console.log(`[heuristic-extractor] Starting full heuristic extraction + classification`);
  const startTime = Date.now();

  // Step 1: Extract candidates and detect sections
  const { candidates, majorSections, stats: candidateStats } = extractCandidatesHeuristically(text);

  // Step 2: Classify each candidate
  const requirements: ClassifiedRequirement[] = [];
  const lowConfidenceIds: string[] = [];
  const needsReviewIds: string[] = [];
  const typeCounters: Record<RequirementType, number> = {
    DECLARATIVE: 0,
    DESCRIPTIVE: 0,
    QUANTITATIVE: 0,
    REFERENCE_BASED: 0,
    EVIDENCE_BASED: 0,
    STAFFING: 0,
    PROCEDURAL: 0,
    CONTEXTUAL: 0,
  };
  let mandatoryCount = 0;
  let totalTypeConfidence = 0;
  let totalMandatoryConfidence = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    // Generate unique ID
    const id = `req_${candidate.sectionNumber.replace(/\./g, '_')}_${i}`;

    // Find section group from major sections
    // Format: "3: Direct Query Questions" (number + colon + title)
    // NOTE: Must NOT use "3.0:" format - getMajorCategoryTitle regex doesn't handle ".0"
    const majorSection = majorSections.get(candidate.majorSection);
    const sectionGroup = majorSection
      ? `${majorSection.number}: ${majorSection.title}`
      : `${candidate.majorSection}: Section ${candidate.majorSection}`;

    // Classify type (pass section title for context boost)
    const typeClassification = classifyTypeHeuristically(candidate.rawText, sectionGroup);

    // Classify mandatory (pass section title for context)
    const mandatoryClassification = classifyMandatoryHeuristically(
      candidate.rawText,
      sectionGroup
    );

    // Check if requirement needs manual review (funky extraction)
    const reviewReasons = detectReviewReasons(candidate.rawText, candidate.sectionNumber);
    const needsReview = reviewReasons.length > 0;

    if (needsReview) {
      needsReviewIds.push(id);
    }

    // Track if low confidence (only for non-review items - no point sending funky ones to LLM)
    const isLowConfidence =
      !needsReview && (
        typeClassification.confidence < confidenceThreshold ||
        mandatoryClassification.confidence < confidenceThreshold
      );

    if (isLowConfidence) {
      lowConfidenceIds.push(id);
    }

    // Update counters
    typeCounters[typeClassification.type]++;
    if (mandatoryClassification.isMandatory) {
      mandatoryCount++;
    }
    totalTypeConfidence += typeClassification.confidence;
    totalMandatoryConfidence += mandatoryClassification.confidence;

    // Detect domain context (FEATURE, PROCESS, LEGAL)
    const domainContext = detectDomainContext(candidate.rawText);

    // Classify attestation eligibility
    const attestationResult = classifyAttestation(candidate.rawText);

    // Create classified requirement
    requirements.push({
      id,
      sectionNumber: candidate.sectionNumber,
      sectionGroup,
      text: candidate.rawText,
      type: typeClassification.type,
      typeConfidence: typeClassification.confidence,
      typePattern: typeClassification.matchedPattern,
      domainContext,
      isAttestation: attestationResult.isAttestation,
      isMandatory: mandatoryClassification.isMandatory,
      mandatoryConfidence: mandatoryClassification.confidence,
      mandatoryPattern: mandatoryClassification.matchedPattern,
      position: i,
      needsReview,
      reviewReasons: needsReview ? reviewReasons : undefined,
    });
  }

  const elapsed = Date.now() - startTime;

  // Build stats
  const stats = {
    total: requirements.length,
    byType: typeCounters,
    mandatory: mandatoryCount,
    optional: requirements.length - mandatoryCount,
    lowConfidenceCount: lowConfidenceIds.length,
    needsReviewCount: needsReviewIds.length,
    avgTypeConfidence: requirements.length > 0
      ? Math.round(totalTypeConfidence / requirements.length)
      : 0,
    avgMandatoryConfidence: requirements.length > 0
      ? Math.round(totalMandatoryConfidence / requirements.length)
      : 0,
    extractionTimeMs: elapsed,
  };

  console.log(`[heuristic-extractor] Classification complete:`, {
    total: stats.total,
    lowConfidence: stats.lowConfidenceCount,
    needsReview: stats.needsReviewCount,
    avgTypeConfidence: stats.avgTypeConfidence,
    avgMandatoryConfidence: stats.avgMandatoryConfidence,
    timeMs: elapsed,
  });
  console.log(`[heuristic-extractor] Type distribution:`, typeCounters);

  return {
    requirements,
    stats,
    lowConfidenceIds,
    needsReviewIds,
  };
}

// =============================================================================
// PROFILE-GUIDED EXTRACTION
// =============================================================================

/**
 * Pattern family identifiers (must match those in openai.ts DocumentProfile)
 */
export type PatternFamilyId = 'numeric' | 'letter' | 'parenthetical' | 'bracket' | 'outline' | 'roman' | 'letter-number';

/**
 * Simplified profile interface to avoid circular imports with openai.ts
 */
export interface ExtractionProfile {
  primaryPatternFamily: PatternFamilyId;
  secondaryPatternFamilies?: PatternFamilyId[];
  requirementSectionPrefixes?: string[];
}

/**
 * Get a pattern family by its ID.
 */
function getPatternFamilyById(id: PatternFamilyId): PatternFamily | undefined {
  return PATTERN_FAMILIES.find(f => f.id === id);
}

/**
 * Extract candidates using a specific profile (pattern family + filters).
 * This is the profile-guided version of findRequirementCandidates.
 *
 * @param text - Document text (already filtered by skip sections)
 * @param profile - Extraction profile specifying pattern families
 */
export function findRequirementCandidatesWithProfile(
  text: string,
  profile: ExtractionProfile
): RequirementCandidate[] {
  console.log(`[heuristic-extractor] Using profile-guided extraction with ${profile.primaryPatternFamily} pattern`);

  // Get the specified primary pattern family
  const primaryFamily = getPatternFamilyById(profile.primaryPatternFamily);
  if (!primaryFamily) {
    console.warn(`[heuristic-extractor] Unknown pattern family "${profile.primaryPatternFamily}", falling back to auto-detection`);
    return findRequirementCandidates(text);
  }

  // Build list of families to use (primary + secondaries)
  const familiesToUse: PatternFamily[] = [primaryFamily];
  if (profile.secondaryPatternFamilies) {
    for (const secId of profile.secondaryPatternFamilies) {
      const secFamily = getPatternFamilyById(secId);
      if (secFamily && secFamily.id !== primaryFamily.id) {
        familiesToUse.push(secFamily);
      }
    }
  }

  console.log(`[heuristic-extractor] Using pattern families: ${familiesToUse.map(f => f.name).join(', ')}`);

  // Detect major sections for validation (same as regular extraction)
  const detectedMajorSections = detectMajorSections(text);
  const validMajorSectionNumbers = new Set(detectedMajorSections.keys());

  // Find all section number positions using the specified pattern families
  interface Match {
    sectionNumber: string;
    index: number;
    majorSection: string;
    textStart: number;
    priority: number;
    familyId: string;
  }

  const matches: Match[] = [];

  // Extract matches from each specified family
  for (const family of familiesToUse) {
    for (const extPattern of family.extractionPatterns) {
      // Reset pattern for fresh matching
      extPattern.pattern.lastIndex = 0;
      let match;

      while ((match = extPattern.pattern.exec(text)) !== null) {
        const sectionNumber = extPattern.getSectionNumber(match);
        const majorSection = extPattern.getMajorSection(match);

        // Apply section prefix filter if specified
        if (profile.requirementSectionPrefixes && profile.requirementSectionPrefixes.length > 0) {
          const matchesPrefix = profile.requirementSectionPrefixes.some(prefix => {
            // Handle both "3." and "A." style prefixes
            return sectionNumber.startsWith(prefix) || majorSection === prefix.replace(/\.$/, '');
          });
          if (!matchesPrefix) continue;
        }

        // Calculate actual match start (skip leading whitespace/newline)
        const leadingChars = match[0].match(/^[\s\n]*/)?.[0].length || 0;
        const actualIndex = match.index + leadingChars;

        // Skip if we already have a higher-priority match at similar position
        const isDuplicate = matches.some(m =>
          Math.abs(m.index - actualIndex) < 10 &&
          (m.sectionNumber === sectionNumber || m.priority >= extPattern.priority)
        );
        if (isDuplicate) continue;

        // For numeric family with 2-level patterns, validate against major sections
        // BUT: In profile-guided extraction, we trust the profile and skip this validation
        // if requirementSectionPrefixes is set (the profile handles section filtering)
        if (family.id === 'numeric' && extPattern.priority < 100) {
          // Only validate against major sections if NO section prefixes are specified
          // (meaning we're not using profile filtering)
          const hasProfilePrefixes = profile.requirementSectionPrefixes && profile.requirementSectionPrefixes.length > 0;
          if (!hasProfilePrefixes && validMajorSectionNumbers.size > 0 && !validMajorSectionNumbers.has(majorSection)) {
            continue;
          }

          // Check for version number false positives
          const beforeText = text.substring(Math.max(0, actualIndex - 15), actualIndex).toLowerCase();
          const versionPattern = /(?:version|v\.|release)\s*$/;
          if (versionPattern.test(beforeText)) {
            continue;
          }
        }

        // Check for date false positives (e.g., 6.01.2023, 12.31.2024)
        // Date patterns: M.DD.YYYY, MM.DD.YYYY, D.DD.YYYY where month 1-12, day 01-31, year 20XX
        const datePattern = /^(1[0-2]|[1-9])\.(0[1-9]|[12]\d|3[01])\.(20\d{2})$/;
        if (datePattern.test(sectionNumber)) {
          continue;
        }

        matches.push({
          sectionNumber,
          index: actualIndex,
          majorSection,
          textStart: match.index + match[0].length,
          priority: extPattern.priority,
          familyId: family.id,
        });
      }
    }
  }

  // Sort matches by position in document
  matches.sort((a, b) => a.index - b.index);

  console.log(`[heuristic-extractor] Found ${matches.length} section number patterns using profile`);

  // Build candidates (same text cleanup as regular extraction)
  const candidates: RequirementCandidate[] = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const startIndex = current.textStart;
    const endIndex = next
      ? next.index
      : Math.min(startIndex + 3000, text.length);

    let rawText = text.substring(startIndex, endIndex).trim();

    // Apply the same text cleanup as findRequirementCandidates
    // Strip trailing section contamination
    let cleanedText = rawText
      .replace(/\s+\d+\.\d+(?:\.\d+)?[:\s]+[A-Z][A-Za-z\s,&\-:]+$/, '')
      .replace(/\s+\[\d+\.\d+\][:\s]+[A-Z][A-Za-z\s,&\-:]+$/, '')
      .replace(/\s+REQ[-_]?\d+[:\s]+[A-Z][A-Za-z\s,&\-:]+$/i, '')
      .replace(/\s+[A-Z]\.\d+(?:\.[a-z\d]+)?[:\s]+[A-Z][A-Za-z\s,&\-:]+$/, '')
      .replace(/\s+(?:I{1,3}|IV|VI{0,3}|IX|X{1,3})\.?[A-Z]?[:\s]+[A-Z][A-Za-z\s,&\-:]+$/i, '')
      .trim();

    // Strip DOCX table markers
    let prevLength;
    do {
      prevLength = cleanedText.length;
      cleanedText = cleanedText
        .replace(/\[TABLE START\]/gi, '')
        .replace(/\[TABLE END\]/gi, '')
        .replace(/\[HEADER\]/gi, '')
        .replace(/\[Col \d+\]/gi, '')
        .replace(/\[ROW \d+\]/gi, '')
        .replace(/\bCol \d+\]/g, '')
        .trim();
    } while (cleanedText.length !== prevLength && prevLength > 0);

    cleanedText = cleanedText
      .replace(/[═─│╔╗╚╝╠╣╦╩╬╒╓╘╙╛╜╞╟╡╢╤╥╧╨╪╫]+/g, '')
      .replace(/\|\s*(?:Pass|Fail|Yes|No|Compliant|Non-?compliant|N\/A|TBD|TBC)[\/|]?(?:Pass|Fail|Yes|No|Compliant|Non-?compliant|N\/A|TBD|TBC)?\s*/gi, '')
      .replace(/\s*(?:Enter|Type|Insert|Provide)\s+(?:response|answer|reply)\s+here:?\s*/gi, '')
      .replace(/\s*(?:Bidder|Vendor|Contractor|Respondent)\s+(?:response|answer|reply):?\s*/gi, '')
      .replace(/\s*\|\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Strip trailing title contamination
    cleanedText = cleanedText
      .replace(/\)\s*([A-Z][a-zA-Z]*(?:\s+[a-zA-Z-]+){0,4})\s*$/, ')')
      .replace(/([.?!]["']?)\s+([A-Z][a-zA-Z]*(?:\s+[a-zA-Z-]+){0,4})\s*$/, (match, punct, title) => {
        if (title.length > 50) return match;
        if (/\b(?:the|and|or|is|are|was|were|a|an|to|for|in|of|on|with|by|from|as|at|this|that|these|those|it|its|can|will|would|should|must|may|might|have|has|had|been|being|do|does|did|so|than|also|just|only|about|after|before|into|through|during|without|within)\b/i.test(title)) return match;
        return punct;
      })
      .trim();

    // Clean page numbers and whitespace
    cleanedText = cleanedText
      .replace(/\s+\d+\s+of\s+\d+\s+Request\s+for\s+Proposal[^]*$/i, '')
      .replace(/\s+Page\s+\d+\s+of\s+\d+[^]*$/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/  +/g, ' ')
      .trim();

    // Skip very short matches and garbage
    if (cleanedText.length < 10) continue;

    // Skip definitions
    const quoteChars = '""\\u201C\\u201D\\u00AB\\u00BB';
    if (/^[""\u201C\u201D\u00AB\u00BB][^""\u201C\u201D\u00AB\u00BB]+[""\u201C\u201D\u00AB\u00BB]?\s+means\b/i.test(cleanedText) ||
        /^means\s+/i.test(cleanedText) ||
        /^[""\u201C\u201D\u00AB\u00BB]?[A-Za-z\s\-]+[""\u201C\u201D\u00AB\u00BB]?\s+means\s+/i.test(cleanedText)) {
      continue;
    }

    // Skip building lists
    if (/[\d,]+\s*(?:sq\.?\s*ft|sqft|square\s*feet)\b/i.test(cleanedText) && cleanedText.length < 200) {
      continue;
    }

    // Skip address-only entries
    if (/^\d+\s+[A-Za-z\s]+(?:Avenue|Ave|Street|St|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Circle|Cir)\b/i.test(cleanedText) &&
        /\b[A-Z]{2}\s+\d{5}\b/.test(cleanedText) &&
        cleanedText.length < 150) {
      continue;
    }

    candidates.push({
      sectionNumber: current.sectionNumber,
      rawText: cleanedText,
      startIndex: current.index,
      endIndex,
      majorSection: current.majorSection,
    });
  }

  console.log(`[heuristic-extractor] Profile-guided extraction: ${candidates.length} valid candidates`);

  return candidates;
}

/**
 * Full extraction with profile guidance.
 * Uses the profile to determine pattern families and apply filters.
 *
 * @param text - Document text (already filtered by skip sections)
 * @param profile - Extraction profile
 * @param confidenceThreshold - Below this, mark for LLM refinement
 */
export function extractAndClassifyWithProfile(
  text: string,
  profile: ExtractionProfile,
  confidenceThreshold: number = 70
): ClassifiedExtractionResult {
  console.log(`[heuristic-extractor] Starting profile-guided extraction + classification`);
  const startTime = Date.now();

  // Step 1: Extract candidates using profile
  const candidates = findRequirementCandidatesWithProfile(text, profile);

  // Step 2: Find question-based candidates (supplementary)
  const questionCandidates = findQuestionCandidates(text, candidates);

  // Step 3: Detect major sections for sectionGroup
  const majorSections = detectMajorSections(text);

  // Combine candidates
  const allCandidates = [...candidates, ...questionCandidates];
  allCandidates.sort((a, b) => a.startIndex - b.startIndex);

  // Step 4: Classify each candidate (same as regular extraction)
  const requirements: ClassifiedRequirement[] = [];
  const lowConfidenceIds: string[] = [];
  const needsReviewIds: string[] = [];
  const typeCounters: Record<RequirementType, number> = {
    DECLARATIVE: 0,
    DESCRIPTIVE: 0,
    QUANTITATIVE: 0,
    REFERENCE_BASED: 0,
    EVIDENCE_BASED: 0,
    STAFFING: 0,
    PROCEDURAL: 0,
    CONTEXTUAL: 0,
  };
  let mandatoryCount = 0;
  let totalTypeConfidence = 0;
  let totalMandatoryConfidence = 0;

  for (let i = 0; i < allCandidates.length; i++) {
    const candidate = allCandidates[i];

    const id = `req_${candidate.sectionNumber.replace(/\./g, '_')}_${i}`;

    const majorSection = majorSections.get(candidate.majorSection);
    const sectionGroup = majorSection
      ? `${majorSection.number}: ${majorSection.title}`
      : `${candidate.majorSection}: Section ${candidate.majorSection}`;

    const typeClassification = classifyTypeHeuristically(candidate.rawText, sectionGroup);
    const mandatoryClassification = classifyMandatoryHeuristically(candidate.rawText, sectionGroup);
    const reviewReasons = detectReviewReasons(candidate.rawText, candidate.sectionNumber);
    const needsReview = reviewReasons.length > 0;

    if (needsReview) {
      needsReviewIds.push(id);
    }

    const isLowConfidence =
      !needsReview && (
        typeClassification.confidence < confidenceThreshold ||
        mandatoryClassification.confidence < confidenceThreshold
      );

    if (isLowConfidence) {
      lowConfidenceIds.push(id);
    }

    typeCounters[typeClassification.type]++;
    if (mandatoryClassification.isMandatory) {
      mandatoryCount++;
    }
    totalTypeConfidence += typeClassification.confidence;
    totalMandatoryConfidence += mandatoryClassification.confidence;

    const domainContext = detectDomainContext(candidate.rawText);
    const attestationResult = classifyAttestation(candidate.rawText);

    requirements.push({
      id,
      sectionNumber: candidate.sectionNumber,
      sectionGroup,
      text: candidate.rawText,
      type: typeClassification.type,
      typeConfidence: typeClassification.confidence,
      typePattern: typeClassification.matchedPattern,
      domainContext,
      isAttestation: attestationResult.isAttestation,
      isMandatory: mandatoryClassification.isMandatory,
      mandatoryConfidence: mandatoryClassification.confidence,
      mandatoryPattern: mandatoryClassification.matchedPattern,
      position: i,
      needsReview,
      reviewReasons: needsReview ? reviewReasons : undefined,
    });
  }

  const elapsed = Date.now() - startTime;

  const stats = {
    total: requirements.length,
    byType: typeCounters,
    mandatory: mandatoryCount,
    optional: requirements.length - mandatoryCount,
    lowConfidenceCount: lowConfidenceIds.length,
    needsReviewCount: needsReviewIds.length,
    avgTypeConfidence: requirements.length > 0
      ? Math.round(totalTypeConfidence / requirements.length)
      : 0,
    avgMandatoryConfidence: requirements.length > 0
      ? Math.round(totalMandatoryConfidence / requirements.length)
      : 0,
    extractionTimeMs: elapsed,
  };

  console.log(`[heuristic-extractor] Profile-guided classification complete:`, {
    total: stats.total,
    lowConfidence: stats.lowConfidenceCount,
    needsReview: stats.needsReviewCount,
    avgTypeConfidence: stats.avgTypeConfidence,
    timeMs: elapsed,
  });

  return {
    requirements,
    stats,
    lowConfidenceIds,
    needsReviewIds,
  };
}
