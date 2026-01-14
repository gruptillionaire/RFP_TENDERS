/**
 * Text Pre-Processor for RFP Document Extraction
 *
 * Enhances raw text from PDF/DOCX parsing to help the LLM understand document structure:
 * - Detects and marks section hierarchies (3.0 → 3.1 → 3.1.1)
 * - Preserves list formatting (bullets, numbered items)
 * - Adds visual separators between major sections
 * - Normalizes whitespace while preserving structure
 */

// =============================================================================
// SECTION DETECTION PATTERNS
// =============================================================================

/**
 * Pattern for major sections (single number or letter)
 * Matches: "3.0 Title", "4. Title", "A. Title", "Section 5: Title"
 */
const MAJOR_SECTION_PATTERN = /^(\s*)((?:Section\s+)?(?:\d+\.0?|\d+\.|[A-Z]\.)\s*)([A-Z][A-Za-z\s,&\-:]+)$/gm;

/**
 * Pattern for subsections (two-level numbering)
 * Matches: "3.1 Title", "A.1 Title", "3.1. Title"
 */
const SUBSECTION_PATTERN = /^(\s*)((?:\d+\.\d+\.?|[A-Z]\.\d+\.?)\s*)([A-Z][A-Za-z\s,&\-:]+)$/gm;

/**
 * Pattern for individual requirements (three-level numbering)
 * Matches: "3.1.1 Question text", "A.1.2 Does the solution..."
 */
const REQUIREMENT_PATTERN = /^(\s*)(\d+\.\d+\.\d+\.?|[A-Z]\.\d+\.\d+\.?)\s+/gm;

/**
 * Pattern for detecting when multiple requirements are on one line or concatenated
 * Matches sequences like: "3.1.1 Text 3.1.2 Text 3.1.3 Text"
 */
const CONCATENATED_REQUIREMENTS_PATTERN = /(\d+\.\d+\.\d+)[.\s]+([^0-9]+?)(?=\d+\.\d+\.\d+|$)/g;

// =============================================================================
// LIST DETECTION AND PRESERVATION
// =============================================================================

/**
 * Normalize various bullet point styles to a consistent format
 */
function normalizeBulletPoints(text: string): string {
  // Convert various bullet styles to standard bullet
  return text
    // Unicode bullets and special chars
    .replace(/^(\s*)[○●◦◆◇▪▫►▸→‣⁃]/gm, '$1• ')
    // Asterisks used as bullets
    .replace(/^(\s*)\*\s+/gm, '$1• ')
    // Hyphens used as bullets (but not in words or ranges)
    .replace(/^(\s*)-\s+(?=[A-Z])/gm, '$1• ')
    // En/em dashes used as bullets
    .replace(/^(\s*)[–—]\s+/gm, '$1• ');
}

/**
 * Detect and preserve numbered list formatting
 */
function preserveNumberedLists(text: string): string {
  // Ensure proper spacing after numbered items
  // Matches: "1.", "2.", "a)", "b)", "(i)", "(ii)", "(a)", "(b)"
  return text
    // Standard numbered lists: "1. ", "2. "
    .replace(/^(\s*)(\d+)\.\s*/gm, '$1$2. ')
    // Lettered lists with parenthesis: "a) ", "b) "
    .replace(/^(\s*)([a-z])\)\s*/gm, '$1$2) ')
    // Roman numerals: "(i) ", "(ii) "
    .replace(/^(\s*)\(([ivxlc]+)\)\s*/gim, '$1($2) ')
    // Lettered with parentheses: "(a) ", "(b) "
    .replace(/^(\s*)\(([a-z])\)\s*/gm, '$1($2) ');
}

// =============================================================================
// SECTION MARKER INSERTION
// =============================================================================

/**
 * Add visual markers around major sections to help LLM understand hierarchy
 */
function addSectionMarkers(text: string): string {
  let result = text;

  // Mark major sections (e.g., "3.0 Direct Query Questions")
  // Add clear separator before major section headers
  result = result.replace(
    /\n(\s*)((?:\d+\.0?\s+|[A-Z]\.\s+|Section\s+\d+[.:]\s*))([A-Z][A-Za-z\s,&\-]{5,})/g,
    '\n\n════════════════════════════════════════════════════════════════════════════════\n$1$2$3\n════════════════════════════════════════════════════════════════════════════════\n'
  );

  // Mark subsections (e.g., "3.1 Design, Form, and Templates")
  // Use lighter marker to show it's a subsection header, not a requirement
  result = result.replace(
    /\n(\s*)(\d+\.\d+\s+)([A-Z][A-Za-z\s,&\-:]{3,})(?=\s*\n)/g,
    '\n\n──────────────────────────────────────────────────────────\n[SUBSECTION] $1$2$3\n──────────────────────────────────────────────────────────\n'
  );

  return result;
}

/**
 * Ensure each requirement (3.1.1, 3.1.2, etc.) starts on its own line
 */
function separateRequirements(text: string): string {
  // Split concatenated requirements onto separate lines
  // Pattern: "3.1.1 Text here 3.1.2 More text" → separate lines
  return text.replace(
    /(\S)(\s*)(\d+\.\d+\.\d+\.?\s+)/g,
    (match, precedingChar, whitespace, reqNumber) => {
      // If there's already a newline before, keep it
      if (whitespace.includes('\n')) {
        return match;
      }
      // Add newline before requirement number
      return `${precedingChar}\n\n${reqNumber}`;
    }
  );
}

// =============================================================================
// TABLE DETECTION AND FORMATTING
// =============================================================================

/**
 * Detect table-like structures and add markers
 * Tables in PDFs often lose their structure and become confusing text
 */
function markTableStructures(text: string): string {
  // Detect lines that look like table headers (multiple short items separated by spaces/tabs)
  // This is a heuristic approach - tables in PDFs are notoriously hard to detect

  // Look for patterns like: "Ref | Requirement | Mandatory | Response"
  // Or tab-separated: "Ref\tRequirement\tMandatory\tResponse"
  const tableHeaderPattern = /^(\s*)([A-Za-z]+(?:\s{2,}|\t)[A-Za-z]+(?:\s{2,}|\t)[A-Za-z]+.*)$/gm;

  let result = text;

  // Mark potential table headers
  result = result.replace(tableHeaderPattern, '$1[TABLE HEADER] $2');

  return result;
}

// =============================================================================
// MAIN PREPROCESSING FUNCTION
// =============================================================================

export interface PreprocessOptions {
  /** Add visual section markers (default: true) */
  addMarkers?: boolean;
  /** Normalize bullet points to consistent style (default: true) */
  normalizeBullets?: boolean;
  /** Preserve numbered list formatting (default: true) */
  preserveLists?: boolean;
  /** Separate concatenated requirements (default: true) */
  separateReqs?: boolean;
  /** Mark table structures (default: true) */
  markTables?: boolean;
  /** Log preprocessing stats (default: false) */
  verbose?: boolean;
}

const DEFAULT_OPTIONS: PreprocessOptions = {
  addMarkers: true,
  normalizeBullets: true,
  preserveLists: true,
  separateReqs: true,
  markTables: true,
  verbose: false,
};

/**
 * Pre-process RFP document text to improve extraction quality
 *
 * @param text - Raw text from PDF/DOCX parser
 * @param options - Preprocessing options
 * @returns Enhanced text with structure markers
 */
export function preprocessRFPText(text: string, options: PreprocessOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let result = text;

  // Track original length for logging
  const originalLength = text.length;

  // Step 1: Normalize whitespace but preserve intentional line breaks
  result = result
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive blank lines (3+ → 2)
    .replace(/\n{4,}/g, '\n\n\n')
    // Normalize horizontal whitespace (multiple spaces → single, but preserve indentation)
    .replace(/[^\S\n]{3,}/g, '  ');

  // Step 2: Separate concatenated requirements FIRST (most important)
  if (opts.separateReqs) {
    result = separateRequirements(result);
  }

  // Step 3: Add section markers to help LLM understand hierarchy
  if (opts.addMarkers) {
    result = addSectionMarkers(result);
  }

  // Step 4: Normalize bullet points
  if (opts.normalizeBullets) {
    result = normalizeBulletPoints(result);
  }

  // Step 5: Preserve numbered list formatting
  if (opts.preserveLists) {
    result = preserveNumberedLists(result);
  }

  // Step 6: Mark table structures
  if (opts.markTables) {
    result = markTableStructures(result);
  }

  // Step 7: Final cleanup
  result = result
    // Remove excessive blank lines created by our processing
    .replace(/\n{4,}/g, '\n\n\n')
    // Trim
    .trim();

  if (opts.verbose) {
    console.log('[preprocessRFPText] Stats:', {
      originalLength,
      processedLength: result.length,
      lengthChange: result.length - originalLength,
      sectionsMarked: (result.match(/════/g) || []).length / 2,
      subsectionsMarked: (result.match(/\[SUBSECTION\]/g) || []).length,
    });
  }

  return result;
}

// =============================================================================
// POST-EXTRACTION UTILITIES
// =============================================================================

/**
 * Detect if a requirement text contains multiple concatenated requirements
 * Returns the count of detected requirement numbers
 */
export function detectConcatenatedRequirements(text: string): string[] {
  // Pattern for requirement numbers: 3.1.1, 3.1.2, A.1.1, etc.
  const reqNumberPattern = /\b(\d+\.\d+\.\d+|[A-Z]\.\d+\.\d+)\b/g;
  const matches = text.match(reqNumberPattern);
  return matches || [];
}

/**
 * Split a concatenated requirement text into individual requirements
 * Returns array of {section, text} objects
 */
export function splitConcatenatedRequirement(text: string): Array<{ section: string; text: string }> {
  const results: Array<{ section: string; text: string }> = [];

  // Pattern to split on requirement numbers
  const splitPattern = /(\d+\.\d+\.\d+|\d+\.\d+\s*[a-z]\)|[A-Z]\.\d+\.\d+)\s+/g;

  // Find all requirement number positions
  const parts: Array<{ index: number; section: string }> = [];
  let match;

  while ((match = splitPattern.exec(text)) !== null) {
    parts.push({
      index: match.index,
      section: match[1].trim(),
    });
  }

  // If no splits found, return original as single item
  if (parts.length === 0) {
    return [{ section: '', text: text.trim() }];
  }

  // Extract text for each requirement
  for (let i = 0; i < parts.length; i++) {
    const start = parts[i].index + parts[i].section.length;
    const end = i < parts.length - 1 ? parts[i + 1].index : text.length;
    const reqText = text.substring(start, end).trim();

    if (reqText.length > 0) {
      results.push({
        section: parts[i].section,
        text: reqText,
      });
    }
  }

  return results;
}

/**
 * Check if text looks like a section header rather than a requirement
 * Section headers are typically short titles without question marks
 */
export function isSectionHeader(text: string): boolean {
  const trimmed = text.trim();

  // Headers are typically short (under 100 chars)
  if (trimmed.length > 100) return false;

  // Headers don't contain question marks
  if (trimmed.includes('?')) return false;

  // Headers are usually title case or ALL CAPS
  const words = trimmed.split(/\s+/);
  const titleCaseWords = words.filter(w => /^[A-Z]/.test(w)).length;
  const isTitleCase = titleCaseWords / words.length > 0.5;

  // Headers often end with a colon or are just a title
  const endsWithColon = trimmed.endsWith(':');

  // Headers don't start with common requirement verbs
  const startsWithReqVerb = /^(Does|Do|Can|Will|Should|Must|Is|Are|Has|Have|Describe|Explain|Provide)/i.test(trimmed);

  return (isTitleCase || endsWithColon) && !startsWithReqVerb;
}

/**
 * Format a list within requirement text
 * Ensures proper line breaks and indentation for lists
 */
export function formatListInRequirement(text: string): string {
  let result = text;

  // Ensure bullet points start on new lines
  result = result.replace(/([.?!])\s*(•)/g, '$1\n$2');

  // Ensure numbered items start on new lines
  result = result.replace(/([.?!])\s*(\d+\.|\([a-z]\)|[a-z]\))/g, '$1\n$2');

  // Add indentation to list items for clarity
  result = result.replace(/\n(•|\d+\.|\([a-z]\)|[a-z]\))/g, '\n  $1');

  return result;
}
