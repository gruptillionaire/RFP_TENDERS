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
      /\b\d+\.\d+\.\d+\s+/g,  // 3.1.2
      /(?:^|\n)\s*\d+\.\d+\s+[A-Z]/gm,  // 3.1 at line start followed by text
    ],
    minMatchesForDetection: 3,
    extractionPatterns: [
      // 3-level: X.Y.Z - highest priority
      {
        pattern: /(?:^|\s)(\d+)\.(\d+)\.(\d+)\s+/gm,
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
      /(?:^|\n)\s*[A-Z]\.\d+\.[a-z]\s+/gm,  // A.1.a
      /(?:^|\n)\s*[A-Z]\.\d+\s+[A-Z]/gm,    // A.1 followed by text
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
      // Letter.Number.Number: A.1.2
      {
        pattern: /(?:^|\n)\s*([A-Z])\.(\d+)\.(\d+)\s+/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}.${m[2]}.${m[3]}`,
        priority: 90,
        requiresLineStart: true,
      },
      // Letter.Number: A.1
      {
        pattern: /(?:^|\n)\s*([A-Z])\.(\d+)(?!\.?\w)\s+/gm,
        getMajorSection: (m) => m[1],
        getSectionNumber: (m) => `${m[1]}.${m[2]}`,
        priority: 50,
        requiresLineStart: true,
      },
    ],
    majorSectionPatterns: [
      /(?:^|\n)\s*([A-Z])[\.\s:]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gm,
      /(?:^|\n)\s*(?:SECTION|Section|Appendix|APPENDIX)\s+([A-Z])[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim,
    ],
  },

  // ==========================================================================
  // PARENTHETICAL: (1), (a), (i), 1), a)
  // ==========================================================================
  {
    id: 'parenthetical',
    name: 'Parenthetical ((1), (a))',
    detectionPatterns: [
      /(?:^|\n)\s*\(\d+\)\s+[A-Z]/gm,      // (1) followed by text
      /(?:^|\n)\s*\([a-z]\)\s+[A-Z]/gm,    // (a) followed by text
      /(?:^|\n)\s*\d+\)\s+[A-Z]/gm,        // 1) followed by text
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
    ],
    majorSectionPatterns: [
      // Parenthetical sections usually don't have major headers, but check for Section (1):
      /(?:^|\n)\s*\((\d+)\)[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{5,}?)(?=\n|$)/gm,
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

    const rawText = match[0].trim();

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
}

export interface ClassifiedExtractionResult {
  requirements: ClassifiedRequirement[];
  stats: {
    total: number;
    byType: Record<RequirementType, number>;
    mandatory: number;
    optional: number;
    lowConfidenceCount: number;
    avgTypeConfidence: number;
    avgMandatoryConfidence: number;
    extractionTimeMs: number;
  };
  /** Requirement IDs that may benefit from LLM refinement */
  lowConfidenceIds: string[];
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

    // Track if low confidence
    const isLowConfidence =
      typeClassification.confidence < confidenceThreshold ||
      mandatoryClassification.confidence < confidenceThreshold;

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
    avgTypeConfidence: stats.avgTypeConfidence,
    avgMandatoryConfidence: stats.avgMandatoryConfidence,
    timeMs: elapsed,
  });
  console.log(`[heuristic-extractor] Type distribution:`, typeCounters);

  return {
    requirements,
    stats,
    lowConfidenceIds,
  };
}
