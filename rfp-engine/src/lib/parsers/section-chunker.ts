/**
 * Section Chunker for Large RFP Documents
 *
 * Splits documents by major sections for parallel extraction.
 * This solves the output token limit problem (16,384 tokens) when
 * extracting 100+ requirements from a single document.
 *
 * Architecture:
 * - Detect major section boundaries (1., 2., 3., A., B., etc.)
 * - Split document into chunks at section boundaries
 * - Each chunk can be extracted independently
 * - Results merged after extraction
 *
 * Fallback Strategy:
 * - If section detection fails, chunk by requirement number patterns
 * - If that fails, chunk by character count
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SectionChunk {
  /** Section identifier: "3", "A", "3.1" */
  sectionNumber: string;
  /** Section title: "Technical Requirements" */
  sectionTitle: string;
  /** Full section content including all subsections */
  content: string;
  /** Position in original document */
  startIndex: number;
  endIndex: number;
  /** Nesting level: 1 = major (3.), 2 = sub (3.1) */
  level: number;
}

export interface ChunkingResult {
  /** Array of section chunks */
  chunks: SectionChunk[];
  /** Document classification based on size */
  documentType: "small" | "large";
  /** Estimated total tokens (~4 chars = 1 token) */
  estimatedTokens: number;
  /** Whether chunking was applied */
  wasChunked: boolean;
  /** How chunking was determined */
  chunkingMethod?: "sections" | "requirements" | "size" | "none";
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Threshold for switching to chunked extraction.
 * Lowered to 50K chars to catch more edge cases.
 */
const LARGE_DOCUMENT_CHAR_THRESHOLD = 50000; // 50K chars (~12.5K tokens)

/**
 * If estimated requirements exceed this, force chunking regardless of size.
 * This catches dense documents that would overflow output tokens.
 */
const HIGH_REQUIREMENT_DENSITY_THRESHOLD = 60;

/**
 * Minimum section size to be considered a valid chunk.
 * Prevents creating tiny chunks from false positive section headers.
 */
const MIN_SECTION_CHARS = 500;

/**
 * Target chunk size for fallback character-based chunking.
 * Smaller chunks process faster and are less likely to timeout.
 */
const FALLBACK_CHUNK_SIZE = 15000; // ~4K tokens per chunk - faster processing

// =============================================================================
// REQUIREMENT ESTIMATION
// =============================================================================

/**
 * Estimate the number of requirements in a document based on pattern matching.
 * Used to determine if chunking is needed regardless of document size.
 */
export function estimateRequirementCount(text: string): number {
  // Count requirement-like patterns: X.Y.Z (three-level numbering)
  const threeLevelMatches = text.match(/\b\d+\.\d+\.\d+\b/g) || [];

  // Count unique three-level patterns (not just occurrences)
  const uniqueThreeLevel = new Set(threeLevelMatches).size;

  // Also count question marks as potential requirements
  const questions = (text.match(/\?/g) || []).length;

  // Estimate: unique numbered items + half of questions (some are rhetorical)
  return uniqueThreeLevel + Math.floor(questions / 3);
}

/**
 * Find all major section boundaries based on requirement numbering patterns.
 * Detects when the first digit changes (e.g., 3.1.1 -> 4.1.1).
 */
function detectMajorSectionsByRequirementNumbers(text: string): number[] {
  const boundaries: number[] = [];

  // Find all X.Y or X.Y.Z patterns - more flexible pattern that doesn't require line start
  // This catches "3.1.1" even when inline or after spaces
  const pattern = /\b(\d+)\.(\d+)(?:\.(\d+))?\b/g;
  let match;
  let lastMajorNumber = -1;
  let matchCount = 0;

  while ((match = pattern.exec(text)) !== null) {
    const majorNumber = parseInt(match[1], 10);
    matchCount++;

    // When the major number changes, it's a section boundary
    if (majorNumber !== lastMajorNumber && lastMajorNumber !== -1) {
      // Find the start of the line containing this match for cleaner splits
      // Handle both \n and \r\n line endings (PDFs often have \r\n or mixed)
      let lineStart = match.index;
      while (lineStart > 0 && text[lineStart - 1] !== '\n' && text[lineStart - 1] !== '\r') {
        lineStart--;
      }
      // If we couldn't find a line break (walked all the way to 0), use match position directly
      // This prevents all boundaries collapsing to position 0
      if (lineStart === 0 && match.index > 100) {
        lineStart = match.index;
      }
      boundaries.push(lineStart);
    }
    lastMajorNumber = majorNumber;
  }

  console.log(`[section-chunker] Scanned ${matchCount} requirement patterns, found ${boundaries.length} major section transitions`);
  return boundaries;
}

/**
 * Check if boundaries are valid (not all clustered at the same positions).
 * Returns true if boundaries are usable for chunking.
 */
function areBoundariesValid(boundaries: number[]): boolean {
  if (boundaries.length < 2) return false;

  // Count unique positions
  const uniquePositions = new Set(boundaries);

  // If more than 50% of boundaries are at the same position, they're broken
  const maxDuplicates = Math.floor(boundaries.length / 2);
  for (const pos of uniquePositions) {
    const count = boundaries.filter(b => b === pos).length;
    if (count > maxDuplicates) {
      console.log(`[section-chunker] Boundaries invalid: ${count}/${boundaries.length} at position ${pos}`);
      return false;
    }
  }

  return true;
}

// =============================================================================
// SECTION DETECTION - IMPROVED PATTERNS
// =============================================================================

interface DetectedSection {
  sectionNumber: string;
  sectionTitle: string;
  startIndex: number;
  level: number;
}

/**
 * Detect all major section boundaries in the document.
 * Uses multiple strategies for robust detection.
 */
function detectSectionBoundaries(text: string): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const seenPositions = new Set<number>();

  // Strategy 1: Section with title on same line (various formats)
  const sameLinePatterns = [
    // "3.0 Title" or "3. Title" or "3: Title" (number + punctuation + title)
    /(?:^|\n)\s*(\d+)(?:\.0?)?[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gm,
    // "Section 3: Title" or "SECTION 3 - Title"
    /(?:^|\n)\s*(?:SECTION|Section)\s+(\d+)[.:\-\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gim,
    // "A. Title" or "A: Title" (letter sections)
    /(?:^|\n)\s*([A-Z])[.:\-)\s]+([A-Z][A-Za-z\s,&\-:'"()]{3,}?)(?=\n|$)/gm,
    // ALL CAPS title after number: "3.0 DIRECT QUERY QUESTIONS"
    /(?:^|\n)\s*(\d+)(?:\.0?)?[.:\-\s]+([A-Z][A-Z\s,&\-:'"()]{5,}?)(?=\n|$)/gm,
  ];

  for (const pattern of sameLinePatterns) {
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const startIndex = match.index;

      // Skip if already found at this position
      if (seenPositions.has(startIndex)) continue;

      // Check if position is within 20 chars of an existing section
      let tooClose = false;
      for (const pos of seenPositions) {
        if (Math.abs(startIndex - pos) < 20) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const sectionNumber = match[1].trim();
      let sectionTitle = match[2].trim();

      // Clean up title (remove trailing punctuation, limit length)
      sectionTitle = sectionTitle.replace(/[.:\-,]+$/, "").substring(0, 60);

      // Skip if section number contains a dot (it's a subsection like 3.1)
      if (sectionNumber.includes(".")) continue;

      // Skip single-digit matches that are likely false positives
      if (sectionTitle.length < 5) continue;

      sections.push({
        sectionNumber,
        sectionTitle,
        startIndex,
        level: 1,
      });
      seenPositions.add(startIndex);
    }
  }

  // Strategy 2: Section number on its own line, title on next line
  // Matches: "3.0\n\nDirect Query Questions" or "3.\nTitle Here"
  const splitLinePattern = /(?:^|\n)\s*(\d+)(?:\.0?)?\s*\n+\s*([A-Z][A-Za-z\s,&\-:'"()]{5,}?)(?=\n)/gm;
  splitLinePattern.lastIndex = 0;
  let match;

  while ((match = splitLinePattern.exec(text)) !== null) {
    const startIndex = match.index;

    // Skip if already found nearby
    let tooClose = false;
    for (const pos of seenPositions) {
      if (Math.abs(startIndex - pos) < 50) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const sectionNumber = match[1].trim();
    let sectionTitle = match[2].trim().replace(/[.:\-,]+$/, "").substring(0, 60);

    if (sectionNumber.includes(".")) continue;
    if (sectionTitle.length < 5) continue;

    sections.push({
      sectionNumber,
      sectionTitle,
      startIndex,
      level: 1,
    });
    seenPositions.add(startIndex);
  }

  // Sort by position in document
  sections.sort((a, b) => a.startIndex - b.startIndex);

  // Remove duplicates with same section number (keep first occurrence)
  const uniqueSections: DetectedSection[] = [];
  const seenNumbers = new Set<string>();

  for (const section of sections) {
    if (!seenNumbers.has(section.sectionNumber)) {
      uniqueSections.push(section);
      seenNumbers.add(section.sectionNumber);
    }
  }

  return uniqueSections;
}

// =============================================================================
// CHUNKING STRATEGIES
// =============================================================================

/**
 * Split document into chunks based on detected section boundaries.
 * Small sections are MERGED with adjacent sections (not skipped).
 */
function createChunksFromSections(
  text: string,
  sections: DetectedSection[]
): SectionChunk[] {
  if (sections.length === 0) {
    return [];
  }

  // First pass: create raw chunks for every section (no filtering)
  const rawChunks: SectionChunk[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const nextSection = sections[i + 1];

    const startIndex = section.startIndex;
    const endIndex = nextSection ? nextSection.startIndex : text.length;
    const content = text.substring(startIndex, endIndex).trim();

    rawChunks.push({
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
      content,
      startIndex,
      endIndex,
      level: section.level,
    });
  }

  // Second pass: merge small sections with the PREVIOUS section
  // This ensures 3.2 (small) is included in chunk with 3.1, not skipped entirely
  const mergedChunks: SectionChunk[] = [];
  for (const chunk of rawChunks) {
    if (chunk.content.length < MIN_SECTION_CHARS && mergedChunks.length > 0) {
      // Merge this small section into the previous chunk
      const prevChunk = mergedChunks[mergedChunks.length - 1];
      prevChunk.content += "\n\n" + chunk.content;
      prevChunk.endIndex = chunk.endIndex;
      console.log(`[section-chunker] Merged small section ${chunk.sectionNumber} (${chunk.content.length} chars) into ${prevChunk.sectionNumber}`);
    } else {
      mergedChunks.push(chunk);
    }
  }

  // Handle any content before the first section
  if (mergedChunks.length > 0 && mergedChunks[0].startIndex > MIN_SECTION_CHARS) {
    const introContent = text.substring(0, mergedChunks[0].startIndex).trim();
    if (introContent.length >= MIN_SECTION_CHARS) {
      mergedChunks.unshift({
        sectionNumber: "0",
        sectionTitle: "Introduction",
        content: introContent,
        startIndex: 0,
        endIndex: mergedChunks[0].startIndex,
        level: 1,
      });
    }
  }

  return mergedChunks;
}

/**
 * Fallback: Create chunks based on requirement number boundaries.
 * Splits when the major section number changes (3.x.x -> 4.x.x).
 */
function createChunksByRequirementBoundaries(text: string): SectionChunk[] {
  const boundaries = detectMajorSectionsByRequirementNumbers(text);

  // Need at least 1 boundary to create 2 chunks
  if (boundaries.length < 1) {
    console.log(`[section-chunker] No requirement boundaries found`);
    return [];
  }

  // Validate that boundaries are actually useful (not all at position 0)
  if (!areBoundariesValid(boundaries)) {
    console.log(`[section-chunker] Requirement boundaries are invalid, skipping`);
    return [];
  }

  // Deduplicate and sort boundaries
  const uniqueBoundaries = [...new Set(boundaries)].sort((a, b) => a - b);
  console.log(`[section-chunker] Found ${uniqueBoundaries.length} valid unique boundaries at positions:`, uniqueBoundaries.slice(0, 5));

  const chunks: SectionChunk[] = [];

  // Add start boundary
  const allBoundaries = [0, ...uniqueBoundaries, text.length];

  for (let i = 0; i < allBoundaries.length - 1; i++) {
    const startIndex = allBoundaries[i];
    const endIndex = allBoundaries[i + 1];
    const content = text.substring(startIndex, endIndex).trim();

    if (content.length < MIN_SECTION_CHARS) continue;

    // Try to extract section number from the first requirement in this chunk
    const firstReqMatch = content.match(/^\s*(\d+)\.\d+/);
    const sectionNumber = firstReqMatch ? firstReqMatch[1] : String(i + 1);

    chunks.push({
      sectionNumber,
      sectionTitle: `Section ${sectionNumber}`,
      content,
      startIndex,
      endIndex,
      level: 1,
    });
  }

  return chunks;
}

/**
 * Find the best split point near a target position.
 * Prefers subsection boundaries (X.Y) over arbitrary positions.
 */
function findBestSplitPoint(text: string, targetPos: number, searchRange: number = 2000): number {
  const searchStart = Math.max(0, targetPos - searchRange);
  const searchEnd = Math.min(text.length, targetPos + searchRange);
  const searchText = text.substring(searchStart, searchEnd);

  // Look for subsection headers (e.g., "3.2 " or "4.1 " at start of line)
  const subsectionPattern = /\n\s*\d+\.\d+\s+[A-Z]/g;
  let match;
  let bestPos = targetPos;
  let bestDistance = searchRange;

  while ((match = subsectionPattern.exec(searchText)) !== null) {
    const absolutePos = searchStart + match.index;
    const distance = Math.abs(absolutePos - targetPos);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPos = absolutePos;
    }
  }

  // If no subsection found, try to split at a requirement boundary (X.Y.Z at start of line)
  if (bestPos === targetPos) {
    const reqPattern = /\n\s*\d+\.\d+\.\d+\s/g;
    while ((match = reqPattern.exec(searchText)) !== null) {
      const absolutePos = searchStart + match.index;
      const distance = Math.abs(absolutePos - targetPos);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPos = absolutePos;
      }
    }
  }

  // Last resort: split at paragraph break
  if (bestPos === targetPos) {
    const paragraphBreak = text.indexOf("\n\n", targetPos - 500);
    if (paragraphBreak !== -1 && paragraphBreak < targetPos + 500) {
      bestPos = paragraphBreak;
    }
  }

  return bestPos;
}

/**
 * Last resort fallback: Create chunks based on character count.
 * Tries to split at subsection or requirement boundaries when possible.
 */
function createChunksBySize(text: string): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  let currentStart = 0;

  while (currentStart < text.length) {
    let targetEnd = currentStart + FALLBACK_CHUNK_SIZE;

    // If this isn't the last chunk, find a better split point
    if (targetEnd < text.length) {
      targetEnd = findBestSplitPoint(text, targetEnd);
    } else {
      targetEnd = text.length;
    }

    const content = text.substring(currentStart, targetEnd).trim();

    if (content.length > 0) {
      // Detect the major section from content for better labeling
      const majorMatch = content.match(/\b(\d+)\.\d+/);
      const majorSection = majorMatch ? majorMatch[1] : String(chunks.length + 1);

      chunks.push({
        sectionNumber: majorSection,
        sectionTitle: `Section ${majorSection} (Part ${chunks.length + 1})`,
        content,
        startIndex: currentStart,
        endIndex: targetEnd,
        level: 1,
      });
    }

    currentStart = targetEnd;
  }

  console.log(`[section-chunker] Size-based chunks created:`, chunks.map(c => `${c.sectionTitle} (${c.content.length} chars)`));
  return chunks;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Chunk a document by major sections for parallel extraction.
 *
 * @param text - Preprocessed document text
 * @returns Chunking result with sections and document type classification
 */
export function chunkDocumentBySections(text: string): ChunkingResult {
  const estimatedTokens = Math.ceil(text.length / 4);
  const estimatedRequirements = estimateRequirementCount(text);

  console.log(`[section-chunker] Document stats: ${text.length} chars, ~${estimatedTokens} tokens, ~${estimatedRequirements} estimated requirements`);

  // Determine if chunking is needed based on size OR requirement density
  const needsChunkingBySize = text.length >= LARGE_DOCUMENT_CHAR_THRESHOLD;
  const needsChunkingByDensity = estimatedRequirements >= HIGH_REQUIREMENT_DENSITY_THRESHOLD;
  const needsChunking = needsChunkingBySize || needsChunkingByDensity;

  if (!needsChunking) {
    console.log(`[section-chunker] Small document with low requirement density, using single-pass`);
    return {
      chunks: [
        {
          sectionNumber: "full",
          sectionTitle: "Full Document",
          content: text,
          startIndex: 0,
          endIndex: text.length,
          level: 0,
        },
      ],
      documentType: "small",
      estimatedTokens,
      wasChunked: false,
      chunkingMethod: "none",
    };
  }

  const reason = needsChunkingByDensity
    ? `high requirement density (~${estimatedRequirements} requirements)`
    : `large size (${text.length} chars)`;
  console.log(`[section-chunker] Chunking needed: ${reason}`);

  // Strategy 1: Try to detect major sections
  console.log(`[section-chunker] Trying section detection...`);
  const sections = detectSectionBoundaries(text);

  if (sections.length >= 2) {
    console.log(
      `[section-chunker] Detected ${sections.length} major sections:`,
      sections.map((s) => `${s.sectionNumber}: ${s.sectionTitle.substring(0, 25)}...`)
    );

    const chunks = createChunksFromSections(text, sections);

    if (chunks.length >= 2) {
      console.log(`[section-chunker] Created ${chunks.length} section-based chunks`);
      return {
        chunks,
        documentType: "large",
        estimatedTokens,
        wasChunked: true,
        chunkingMethod: "sections",
      };
    }
  }

  // Strategy 2: Size-based chunking (most reliable fallback)
  // NOTE: We skip requirement boundary detection because it creates too many small chunks
  // when documents have frequent section number transitions (1.x, 2.x, 3.x, etc.)
  // Size-based with smart split points is more reliable and faster.
  console.log(`[section-chunker] Section detection failed, using size-based chunking...`);
  const sizeChunks = createChunksBySize(text);

  console.log(`[section-chunker] Created ${sizeChunks.length} size-based chunks`);
  return {
    chunks: sizeChunks,
    documentType: "large",
    estimatedTokens,
    wasChunked: true,
    chunkingMethod: "size",
  };
}
