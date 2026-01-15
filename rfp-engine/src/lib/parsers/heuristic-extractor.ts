/**
 * Heuristic Requirement Extractor
 *
 * Phase 1 of two-phase extraction: Find requirement candidates using regex/heuristics.
 * No LLM calls - pure pattern matching for speed and reliability.
 *
 * This solves the fundamental problem with chunked extraction:
 * - Chunking loses section context and corrupts section numbers
 * - Here, we find EXACT section numbers and their text directly
 * - The LLM's job (Phase 2) is just classification, not hunting
 */

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
  // Pattern matches: 3.1.2, 3.1, A.1.2, A.1 (at word boundary)
  const pattern = /(?:^|\n)\s*(\d+|\b[A-Z])\.(\d+)(?:\.(\d+))?\s+/gm;

  interface Match {
    sectionNumber: string;
    index: number;
    majorSection: string;
    textStart: number; // Where the actual text starts (after the number)
  }

  const matches: Match[] = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Build section number from captured groups
    const major = match[1];
    const minor = match[2];
    const sub = match[3];

    const sectionNumber = sub
      ? `${major}.${minor}.${sub}`
      : `${major}.${minor}`;

    matches.push({
      sectionNumber,
      index: match.index,
      majorSection: major,
      textStart: match.index + match[0].length,
    });
  }

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

    // Skip very short matches (likely false positives)
    if (rawText.length < 10) {
      continue;
    }

    // Skip if it looks like a version number or decimal (e.g., "version 2.0")
    const beforeText = text.substring(Math.max(0, current.index - 20), current.index).toLowerCase();
    if (beforeText.includes('version') || beforeText.includes('v.') || beforeText.includes('release')) {
      continue;
    }

    candidates.push({
      sectionNumber: current.sectionNumber,
      rawText,
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

  // Pattern 1: "3.0 Title" or "3. Title" (number at start of line)
  const pattern1 = /(?:^|\n)\s*(\d+)(?:\.0?)?\s+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gm;

  // Pattern 2: "Section 3: Title" or "SECTION 3 - Title"
  const pattern2 = /(?:^|\n)\s*(?:SECTION|Section)\s+(\d+)[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim;

  // Pattern 3: ALL CAPS headers "3.0 DIRECT QUERY QUESTIONS"
  const pattern3 = /(?:^|\n)\s*(\d+)(?:\.0?)?\s+([A-Z][A-Z\s,&\-:'"()]{5,}?)(?=\n|$)/gm;

  const patterns = [pattern1, pattern2, pattern3];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const sectionNum = match[1];
      let title = match[2].trim();

      // Skip if already found (first match wins)
      if (sections.has(sectionNum)) continue;

      // Clean up title
      title = title.replace(/[.:\-,]+$/, '').substring(0, 60);

      // Skip if title is too short
      if (title.length < 3) continue;

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
