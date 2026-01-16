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
// CANDIDATE EXTRACTION
// =============================================================================

/**
 * Find all requirement candidates in a document using pattern matching.
 *
 * Looks for numbered patterns like:
 * - 3.1.2 (numeric three-level)
 * - 3.1 (numeric two-level)
 * - A.1.2 (letter + numeric)
 *
 * For each match, extracts the text until the next numbered item.
 */
export function findRequirementCandidates(text: string): RequirementCandidate[] {
  // Step 1: Find all section number positions
  // We use TWO patterns:
  // 1. X.Y.Z (3 levels) - can appear after any whitespace (very likely section numbers)
  // 2. X.Y (2 levels) - require newline/start (to avoid matching "version 2.0", dates, etc.)

  interface Match {
    sectionNumber: string;
    index: number;
    majorSection: string;
    textStart: number; // Where the actual text starts (after the number)
  }

  const matches: Match[] = [];

  // Pattern 1: X.Y.Z format - allow after any whitespace (common in RFPs like "3.1.1 Does the...")
  // This catches inline section numbers that don't start on a new line
  const pattern3Level = /(?:^|\s)(\d+)\.(\d+)\.(\d+)\s+/gm;
  let match;

  while ((match = pattern3Level.exec(text)) !== null) {
    const major = match[1];
    const minor = match[2];
    const sub = match[3];
    const sectionNumber = `${major}.${minor}.${sub}`;

    // Calculate actual match start (skip leading whitespace)
    const leadingWhitespace = match[0].match(/^\s*/)?.[0].length || 0;
    const actualIndex = match.index + leadingWhitespace;

    matches.push({
      sectionNumber,
      index: actualIndex,
      majorSection: major,
      textStart: match.index + match[0].length,
    });
  }

  // Pattern 2: X.Y format at start of line only (to avoid false positives)
  // Only match if NOT followed by another digit (which would make it X.Y.Z)
  const pattern2Level = /(?:^|\n)\s*(\d+)\.(\d+)(?!\.?\d)\s+/gm;

  while ((match = pattern2Level.exec(text)) !== null) {
    const major = match[1];
    const minor = match[2];
    const sectionNumber = `${major}.${minor}`;

    // Skip if we already have a 3-level match at similar position
    const isDuplicate = matches.some(m =>
      Math.abs(m.index - match!.index) < 10 && m.sectionNumber.startsWith(sectionNumber)
    );

    if (!isDuplicate) {
      matches.push({
        sectionNumber,
        index: match.index,
        majorSection: major,
        textStart: match.index + match[0].length,
      });
    }
  }

  // Sort matches by position in document
  matches.sort((a, b) => a.index - b.index);

  console.log(`[heuristic-extractor] Found ${matches.length} section number patterns`);

  // Step 2: Extract text for each match
  const candidates: RequirementCandidate[] = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    // Text starts after the section number
    const startIndex = current.textStart;

    // Text ends at next section number or max 1500 chars
    const maxEnd = startIndex + 1500;
    const endIndex = next
      ? Math.min(next.index, maxEnd)
      : Math.min(maxEnd, text.length);

    const rawText = text.substring(startIndex, endIndex).trim();

    // Strip trailing section number + title contamination
    // Pattern: X.Y or X.Y.Z followed by title-like text at end (e.g., "...testing? 3.5 Integrations")
    let cleanedText = rawText.replace(
      /\s+\d+\.\d+(?:\.\d+)?\s+[A-Z][A-Za-z\s,&\-:]+$/,
      ''
    ).trim();

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

    // Skip if it looks like a version number or decimal (e.g., "version 2.0")
    const beforeText = text.substring(Math.max(0, current.index - 20), current.index).toLowerCase();
    if (beforeText.includes('version') || beforeText.includes('v.') || beforeText.includes('release')) {
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
 * Looks for patterns like:
 * - "3.0 Technical Requirements"
 * - "3. TECHNICAL REQUIREMENTS"
 * - "Section 3: Technical Requirements"
 *
 * Returns a map of section number -> title
 */
export function detectMajorSections(text: string): Map<string, MajorSection> {
  const sections = new Map<string, MajorSection>();

  // Pattern 1: "3.0 Title" or "3. Title" at start of line
  const pattern1 = /(?:^|\n)\s*(\d+)(?:\.0?)?\s+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gm;

  // Pattern 2: "Section 3: Title" or "SECTION 3 - Title"
  const pattern2 = /(?:^|\n)\s*(?:SECTION|Section)\s+(\d+)[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim;

  // Pattern 3: ALL CAPS headers "3.0 DIRECT QUERY QUESTIONS"
  const pattern3 = /(?:^|\n)\s*(\d+)(?:\.0?)?\s+([A-Z][A-Z\s,&\-:'"()]{5,}?)(?=\n|$)/gm;

  // Pattern 4: Inline "X.0 Title" (for PDFs without proper newlines)
  // Matches: "3.0 Direct Query Questions" followed by subsection or page number
  const pattern4 = /(?:^|\s)(\d+)\.0\s+([A-Z][A-Za-z\s,&\-:'"()]{5,}?)(?=\s+\d|\s+\.{2,}|$)/gm;

  // Pattern 5: "X.0: Title" or "X.0 - Title" format
  const pattern5 = /(?:^|\s)(\d+)\.0[:\-]\s*([A-Z][A-Za-z\s,&\-:'"()]{5,}?)(?=\s+\d|$)/gm;

  const patterns = [pattern1, pattern2, pattern3, pattern4, pattern5];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const sectionNum = match[1];
      let title = match[2].trim();

      // Skip if already found (first match wins)
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
    const majorSection = majorSections.get(candidate.majorSection);
    const sectionGroup = majorSection?.title || `Section ${candidate.majorSection}`;

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
