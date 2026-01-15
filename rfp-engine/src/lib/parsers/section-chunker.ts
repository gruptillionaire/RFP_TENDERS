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
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Threshold for switching to chunked extraction.
 * ~60K tokens = ~240K characters
 * This leaves room for the extraction prompt and output.
 */
const LARGE_DOCUMENT_CHAR_THRESHOLD = 100000; // 100K chars (~25K tokens of content)

/**
 * Minimum section size to be considered a valid chunk.
 * Prevents creating tiny chunks from false positive section headers.
 */
const MIN_SECTION_CHARS = 500;

/**
 * Pattern for major section headers.
 * Matches: "1.", "2.", "A.", "B.", "Section 3:", etc.
 */
const MAJOR_SECTION_PATTERNS = [
  // Numbered sections with period: "1.", "2.", "3.0"
  /(?:^|\n)\s*((?:Section\s+)?(\d+)(?:\.0?)?)\s*[.:\-]\s*([A-Z][A-Za-z\s,&\-:]{3,})/gi,
  // Letter sections: "A.", "B.", "C:"
  /(?:^|\n)\s*((?:Section\s+)?([A-Z]))(?:\.|:|\))\s*([A-Z][A-Za-z\s,&\-:]{3,})/gi,
  // Markdown-style: "# 3. Title" or "## A: Title"
  /(?:^|\n)\s*#{1,3}\s*((\d+)|([A-Z]))[.:\)]\s*([A-Z][A-Za-z\s,&\-:]{3,})/gi,
];

// =============================================================================
// SECTION DETECTION
// =============================================================================

interface DetectedSection {
  sectionNumber: string;
  sectionTitle: string;
  startIndex: number;
  level: number;
}

/**
 * Detect all major section boundaries in the document.
 */
function detectSectionBoundaries(text: string): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const seenPositions = new Set<number>();

  for (const pattern of MAJOR_SECTION_PATTERNS) {
    // Reset pattern state for each iteration
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const startIndex = match.index;

      // Skip if we've already found a section at this position
      // (patterns may overlap)
      if (seenPositions.has(startIndex)) continue;

      // Extract section number and title
      const fullMatch = match[0];
      const sectionNumber = (match[2] || match[3] || "").toString().trim();
      const sectionTitle = (match[3] || match[4] || "").toString().trim();

      // Determine section level (1 = major like "3", 2 = sub like "3.1")
      const level = sectionNumber.includes(".") ? 2 : 1;

      // Only include major sections (level 1)
      if (level === 1 && sectionNumber && sectionTitle) {
        sections.push({
          sectionNumber,
          sectionTitle,
          startIndex,
          level,
        });
        seenPositions.add(startIndex);
      }
    }
  }

  // Sort by position in document
  sections.sort((a, b) => a.startIndex - b.startIndex);

  // Remove duplicates that are too close together (within 50 chars)
  const dedupedSections: DetectedSection[] = [];
  for (const section of sections) {
    const lastSection = dedupedSections[dedupedSections.length - 1];
    if (!lastSection || section.startIndex - lastSection.startIndex > 50) {
      dedupedSections.push(section);
    }
  }

  return dedupedSections;
}

// =============================================================================
// CHUNKING LOGIC
// =============================================================================

/**
 * Split document into chunks based on detected section boundaries.
 */
function createChunksFromSections(
  text: string,
  sections: DetectedSection[]
): SectionChunk[] {
  const chunks: SectionChunk[] = [];

  // If no sections detected, treat entire document as one chunk
  if (sections.length === 0) {
    return [
      {
        sectionNumber: "1",
        sectionTitle: "Document",
        content: text,
        startIndex: 0,
        endIndex: text.length,
        level: 1,
      },
    ];
  }

  // Create chunks for each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const nextSection = sections[i + 1];

    const startIndex = section.startIndex;
    const endIndex = nextSection ? nextSection.startIndex : text.length;
    const content = text.substring(startIndex, endIndex).trim();

    // Skip sections that are too small (likely false positives)
    if (content.length < MIN_SECTION_CHARS) {
      continue;
    }

    chunks.push({
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
      content,
      startIndex,
      endIndex,
      level: section.level,
    });
  }

  // If we filtered out all sections, return the whole document
  if (chunks.length === 0) {
    return [
      {
        sectionNumber: "1",
        sectionTitle: "Document",
        content: text,
        startIndex: 0,
        endIndex: text.length,
        level: 1,
      },
    ];
  }

  // Handle any content before the first section
  if (chunks[0].startIndex > MIN_SECTION_CHARS) {
    const introContent = text.substring(0, chunks[0].startIndex).trim();
    if (introContent.length >= MIN_SECTION_CHARS) {
      chunks.unshift({
        sectionNumber: "0",
        sectionTitle: "Introduction",
        content: introContent,
        startIndex: 0,
        endIndex: chunks[0].startIndex,
        level: 1,
      });
    }
  }

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

  // Small document: return as single chunk, use existing single-pass extraction
  if (text.length < LARGE_DOCUMENT_CHAR_THRESHOLD) {
    console.log(
      `[section-chunker] Small document (${text.length} chars, ~${estimatedTokens} tokens), using single-pass`
    );
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
    };
  }

  // Large document: detect sections and create chunks
  console.log(
    `[section-chunker] Large document (${text.length} chars, ~${estimatedTokens} tokens), detecting sections...`
  );

  const sections = detectSectionBoundaries(text);
  console.log(
    `[section-chunker] Detected ${sections.length} major sections:`,
    sections.map((s) => `${s.sectionNumber}: ${s.sectionTitle.substring(0, 30)}...`)
  );

  // If we couldn't detect meaningful sections, fall back to single-pass
  if (sections.length < 2) {
    console.log(
      `[section-chunker] Could not detect enough sections, falling back to single-pass`
    );
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
      documentType: "large",
      estimatedTokens,
      wasChunked: false,
    };
  }

  const chunks = createChunksFromSections(text, sections);

  console.log(
    `[section-chunker] Created ${chunks.length} chunks:`,
    chunks.map(
      (c) =>
        `${c.sectionNumber}: ${c.sectionTitle.substring(0, 20)}... (${c.content.length} chars)`
    )
  );

  return {
    chunks,
    documentType: "large",
    estimatedTokens,
    wasChunked: true,
  };
}

/**
 * Estimate the number of requirements in a section based on pattern matching.
 * Used for progress estimation and validation.
 */
export function estimateRequirementCount(text: string): number {
  // Count requirement-like patterns: X.Y.Z, X.Y followed by text
  const threeLevel = (text.match(/\b\d+\.\d+\.\d+\b/g) || []).length;
  const twoLevel = (text.match(/\b\d+\.\d+\b/g) || []).length;

  // Also count question marks as potential requirements
  const questions = (text.match(/\?/g) || []).length;

  // Rough estimate: unique numbered items + questions
  return Math.max(threeLevel, twoLevel - threeLevel) + Math.floor(questions / 2);
}
