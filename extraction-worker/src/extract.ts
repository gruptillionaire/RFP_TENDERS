import OpenAI from 'openai';

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

/** Minimum text length to consider for deduplication (avoids matching short phrases) */
const MIN_DEDUPE_TEXT_LENGTH = 100;

/** Minimum length for a text to be considered substantial in subset detection */
const MIN_SUBSTANTIAL_TEXT_LENGTH = 50;

/** Ratio threshold for subset duplicate detection */
const SUBSET_LENGTH_RATIO = 0.3;

/** Minimum requirement text length (shorter is likely noise) */
const MIN_REQUIREMENT_LENGTH = 10;

/** Maximum length for text to be considered a potential attestation */
const MAX_ATTESTATION_LENGTH = 200;

/** Extended attestation length for strong patterns */
const MAX_EXTENDED_ATTESTATION_LENGTH = 400;

/** LLM API call timeout in milliseconds (45 minutes - very large documents need more time) */
const LLM_TIMEOUT_MS = 2700000;

/** Minimum document length for meaningful extraction */
const MIN_DOCUMENT_LENGTH = 100;

/** Maximum lines to scan forward when finding section end */
const MAX_LINE_SCAN_RANGE = 10;

/** Context extraction: characters before match point */
const CONTEXT_CHARS_BEFORE = 300;

/** Context extraction: characters after match point */
const CONTEXT_CHARS_AFTER = 500;

/** Maximum characters to include in log output (to avoid exposing sensitive data) */
const MAX_LOG_TEXT_LENGTH = 80;

/**
 * Sanitize text for logging - truncate and remove potentially sensitive patterns
 */
function sanitizeForLog(text: string, maxLength: number = MAX_LOG_TEXT_LENGTH): string {
  if (!text) return '[empty]';
  // Truncate and add ellipsis
  const truncated = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  // Remove potential email addresses and phone numbers
  return truncated
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]');
}

// =============================================================================
// TYPES
// =============================================================================

export interface ExtractedRequirement {
  section: string | null;
  sectionGroup: string | null;
  text: string;
  type: RequirementType;
  isMandatory: boolean;
  domainContext: 'FEATURE' | 'PROCESS' | 'LEGAL';
  wordLimit: number | null;
  characterLimit: number | null;
  isAttestation: boolean;
}

export interface ExtractionResult {
  deadline: string | null;
  deadlineText: string | null;
  requirements: ExtractedRequirement[];
  warnings?: string[];
}

export type RequirementType =
  | 'CONTEXTUAL'
  | 'PROCEDURAL'
  | 'DECLARATIVE'
  | 'DESCRIPTIVE'
  | 'EVIDENCE_BASED'
  | 'QUANTITATIVE'
  | 'REFERENCE_BASED'
  | 'STAFFING';

interface ExtractionOptions {
  model?: string;
}

// =============================================================================
// LINE-REFERENCE EXTRACTION PROMPT
// Optimized to reduce output size by using line references instead of full text
// =============================================================================

const EXTRACTION_PROMPT = `Extract requirements from this RFP document. Lines are prefixed with "L123: ".

OUTPUT JSON: {"d":"ISO deadline or null","dt":"deadline text or null","r":[[start,end,"section"],...]}

SEMANTIC EXTRACTION - Extract by CONTENT TYPE, not by section pattern.

WHAT TO EXTRACT (content patterns):

1. QUESTIONS - Any sentence ending with "?"
   - "Does your solution support...?"
   - "How will you handle...?"
   - "What is your approach to...?"

2. CAPABILITY REQUESTS - Sentences starting with:
   - "Describe...", "Explain...", "Provide...", "List..."
   - "Demonstrate...", "Detail...", "Outline..."
   - "Include...", "Submit...", "Specify..."

3. OBLIGATION STATEMENTS - Sentences containing:
   - "shall", "must", "will", "should"
   - "is required to", "are expected to"
   - "The vendor/contractor/proposer shall..."

4. YES/NO ATTESTATIONS - Questions expecting yes/no:
   - "Does the...", "Can the...", "Is the...", "Are there..."
   - "Has the...", "Will the...", "Would the..."

EXTRACTION RULES:

1. ONE SENTENCE = ONE REQUIREMENT (usually)
   - Each "?" ends a requirement
   - Each imperative (Describe/Explain/etc.) is separate
   - If one sentence has 2 questions, extract as 2 items

2. SECTION DETECTION (secondary)
   - Look for section ID on the same line or 1-2 lines before
   - Formats vary: "3.1.2", "A.1", "III.B", "(a)", "Q5"
   - Use null if no identifier visible nearby
   - Copy section exactly as written

3. SPAN LENGTH
   - Most requirements: 1-3 lines
   - Stop at sentence boundaries (. or ?)
   - If text changes topic, start new requirement

4. SKIP (not requirements):
   - Section titles without questions/imperatives
   - Page numbers, headers, footers
   - Table of contents, timelines
   - Instructions to vendors (meta-content)
   - Contact information

EXAMPLES:

Line: "L45: 3.2.1 Describe your data backup procedures."
Output: [45, 45, "3.2.1"]

Line: "L78: Does the system support single sign-on? If yes, describe."
Output: [78, 78, null] - Two requirements in one line, but extract together

Lines: "L100: 4.1 Security\nL101: The vendor shall provide encryption."
Output: [101, 101, "4.1"] - Skip header "4.1 Security", extract obligation

NO OVERLAPPING SPANS.
`;

// =============================================================================
// VALIDATION PROMPT - Second LLM pass to fix quality issues
// =============================================================================

const VALIDATION_PROMPT = `Validate extracted RFP requirements. Fix content quality issues.

PRIORITY 1: MERGED REQUIREMENTS
Multiple questions or requests combined into one item.
Signs:
- Multiple "?" in the text
- Multiple imperative verbs (Describe X... Explain Y...)
- Text >400 chars with distinct topics
Action: "split" with splitPoints array

EXAMPLE MERGED:
"Does your system support SSO? Describe your authentication approach."
FIX: split at ["SSO?", "approach."]

PRIORITY 2: TRAILING CONTAMINATION
Requirement text extends past the actual question/request.
Signs:
- Section headers after the question (e.g., "...procedures. 4.5 Training")
- Document titles ("Request for Proposal", "RFP:")
- Sudden topic change after sentence end
Action: "truncateAt" with the last valid sentence

EXAMPLE:
"Describe backup procedures. 5.0 Instructions to Respondent"
FIX: truncateAt "procedures."

OTHER ISSUES:

3. TRUNCATED: Ends mid-sentence, incomplete thought
   Action: "truncated" with missingText if you can infer it

4. FRAGMENT: Starts with lowercase or "and/or/but"
   Action: "fragment" with mergeWith (previous index)

5. PAGE_NUMBER: Contains "X of Y" or "Page X"
   Action: "removePageNumber"

6. NOT_A_REQUIREMENT: Just a section header/title, no question or imperative
   Action: "header"

7. WRONG_TYPE: Classified incorrectly (e.g., has "?" but marked PROCEDURAL)
   Action: "fixType" with newType

OUTPUT JSON:
{
  "fixes": [
    {"index": 0, "action": "ok"},
    {"index": 1, "action": "split", "splitPoints": ["first?", "second?"]},
    {"index": 2, "action": "truncateAt", "truncateAfter": "actual requirement text."}
  ]
}

Mark "ok" for valid requirements. Focus on content quality, not section numbering.
`;

// =============================================================================
// DOCUMENT STRUCTURE DETECTION
// =============================================================================

/**
 * Detect section structure in document to help guide complete extraction.
 * Returns a detailed summary of all sections found with item counts per subsection.
 * Handles multiple formats: X.Y.Z, X.Y, A.X.Y, A.X
 */
function detectDocumentSections(text: string): string {
  // Track all detected formats for reporting
  const detectedFormats: string[] = [];

  // Find all section patterns like 3.1.1, 3.1.2, 4.2.3, etc. (X.Y.Z format)
  const detailedPattern = /\b(\d+)\.(\d+)\.(\d+)\b/g;
  // Key: "major.minor" -> Set of tertiary numbers (3.1 -> {1,2,3,...,20})
  const subsectionItems = new Map<string, Set<number>>();
  // Key: "major" -> Set of minor numbers (3 -> {1,2,3,...,17})
  const majorSections = new Map<string, Set<number>>();

  let match;
  while ((match = detailedPattern.exec(text)) !== null) {
    const major = match[1];
    const minor = parseInt(match[2], 10);
    const tertiary = parseInt(match[3], 10);

    const subsectionKey = `${major}.${minor}`;
    if (!subsectionItems.has(subsectionKey)) {
      subsectionItems.set(subsectionKey, new Set());
    }
    subsectionItems.get(subsectionKey)!.add(tertiary);

    if (!majorSections.has(major)) {
      majorSections.set(major, new Set());
    }
    majorSections.get(major)!.add(minor);
  }

  // Detect X.Y format (without tertiary) - only count if NOT followed by .digit
  const doublePattern = /\b(\d+)\.(\d+)\b(?!\.\d)/g;
  const doubleOnlySections = new Map<string, Set<number>>();
  while ((match = doublePattern.exec(text)) !== null) {
    const major = match[1];
    const minor = parseInt(match[2], 10);
    const subsectionKey = `${major}.${minor}`;
    // Only add if we didn't already count X.Y.Z items for this subsection
    if (!subsectionItems.has(subsectionKey)) {
      if (!doubleOnlySections.has(major)) {
        doubleOnlySections.set(major, new Set());
      }
      doubleOnlySections.get(major)!.add(minor);
    }
  }

  // Detect A.X.Y format (letter-prefixed)
  const letterPattern = /\b([A-Z])\.(\d+)(?:\.(\d+))?\b/gi;
  const letterSections = new Map<string, { minors: Set<number>; items: Map<number, Set<number>> }>();
  while ((match = letterPattern.exec(text)) !== null) {
    const letter = match[1].toUpperCase();
    const minor = parseInt(match[2], 10);
    const tertiary = match[3] ? parseInt(match[3], 10) : null;

    if (!letterSections.has(letter)) {
      letterSections.set(letter, { minors: new Set(), items: new Map() });
    }
    const section = letterSections.get(letter)!;
    section.minors.add(minor);
    if (tertiary !== null) {
      if (!section.items.has(minor)) {
        section.items.set(minor, new Set());
      }
      section.items.get(minor)!.add(tertiary);
    }
  }

  // Build detailed summary
  const summaryParts: string[] = [];
  let totalExpectedItems = 0;

  // Report X.Y.Z sections
  if (majorSections.size > 0) {
    detectedFormats.push('X.Y.Z (e.g., 3.1.2)');
    const sortedMajors = Array.from(majorSections.keys()).sort((a, b) => parseInt(a) - parseInt(b));

    for (const major of sortedMajors) {
      const minors = Array.from(majorSections.get(major)!).sort((a, b) => a - b);
      const minCount = minors[0];
      const maxCount = minors[minors.length - 1];

      // Build subsection detail
      const subsectionDetails: string[] = [];
      for (const minor of minors) {
        const subsectionKey = `${major}.${minor}`;
        const items = subsectionItems.get(subsectionKey);
        if (items && items.size > 0) {
          const itemsList = Array.from(items).sort((a, b) => a - b);
          const itemMax = itemsList[itemsList.length - 1];
          totalExpectedItems += items.size;
          subsectionDetails.push(`${subsectionKey} (${items.size} items: up to ${subsectionKey}.${itemMax})`);
        }
      }

      if (subsectionDetails.length > 0) {
        summaryParts.push(`Section ${major}: subsections ${major}.${minCount}-${major}.${maxCount}\n  ${subsectionDetails.join('\n  ')}`);
      }
    }
  }

  // Report X.Y only sections (if any without tertiary)
  if (doubleOnlySections.size > 0) {
    if (!detectedFormats.includes('X.Y (e.g., 3.1)')) {
      detectedFormats.push('X.Y (e.g., 3.1)');
    }
    for (const [major, minors] of doubleOnlySections) {
      const minorsList = Array.from(minors).sort((a, b) => a - b);
      totalExpectedItems += minors.size;
      summaryParts.push(`Section ${major}: ${minors.size} X.Y items (${major}.${minorsList[0]} to ${major}.${minorsList[minorsList.length - 1]})`);
    }
  }

  // Report A.X.Y sections
  if (letterSections.size > 0) {
    detectedFormats.push('A.X (e.g., A.1, B.2.3)');
    for (const [letter, section] of letterSections) {
      const minorsList = Array.from(section.minors).sort((a, b) => a - b);
      let itemCount = 0;
      for (const items of section.items.values()) {
        itemCount += items.size;
      }
      if (itemCount === 0) itemCount = section.minors.size;
      totalExpectedItems += itemCount;
      summaryParts.push(`Section ${letter}: ${itemCount} items (${letter}.${minorsList[0]} to ${letter}.${minorsList[minorsList.length - 1]})`);
    }
  }

  if (summaryParts.length === 0) {
    return '';
  }

  summaryParts.push(`\nTOTAL EXPECTED: ~${totalExpectedItems} numbered items (plus section headers)`);
  summaryParts.push(`\nSection formats detected: ${detectedFormats.join(', ')}`);

  return summaryParts.join('\n');
}

interface MajorSection {
  number: string;  // "3", "A", "IV"
  title: string;   // "Direct Query Questions"
}

/**
 * Detect major section headers in the document to populate sectionGroup.
 * Returns a map of section number → {number, title}
 */
function detectMajorSections(text: string): Map<string, MajorSection> {
  const sections = new Map<string, MajorSection>();

  console.log(`[detectMajorSections] Scanning document of ${text.length} chars for section headers...`);

  // Split into lines for easier pattern matching
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip very long lines (not headers)
    if (line.length > 100) continue;

    // Pattern 1: "X.0 Title" format (e.g., "3.0 Direct Query Questions")
    // Allow leading whitespace - this is the most reliable pattern
    let match = line.match(/^\s*(\d+)\.0\s+(.+)$/);
    if (match) {
      const num = match[1];
      const title = cleanTitle(match[2]);
      if (title) {
        // X.0 format is AUTHORITATIVE - always use it, even if we found something else
        sections.set(num, { number: num, title });
        console.log(`[detectMajorSections] Found X.0 format (authoritative): ${num} -> "${title}"`);
        continue;
      }
    }

    // Pattern 2: "Section X: Title" or "Section X - Title"
    match = line.match(/^(?:SECTION|Section)\s+(\d+|[A-Z])[.:\-\s]+(.+)$/i);
    if (match) {
      const num = match[1].toUpperCase();
      const title = cleanTitle(match[2]);
      if (title && !sections.has(num)) {
        sections.set(num, { number: num, title });
        console.log(`[detectMajorSections] Found Section X format: ${num} -> "${title}"`);
        continue;
      }
    }

    // Pattern 3: Markdown heading "# X. Title" or "## X: Title"
    match = line.match(/^#+\s*(\d+|[A-Z])[.\s:]+(.+)$/);
    if (match) {
      const num = match[1].toUpperCase();
      const title = cleanTitle(match[2]);
      if (title && !sections.has(num)) {
        sections.set(num, { number: num, title });
        console.log(`[detectMajorSections] Found markdown heading: ${num} -> "${title}"`);
        continue;
      }
    }

    // Pattern 4: "X. Title" where X is single digit
    // STRICT: Only match if title looks like a SECTION TITLE (not a list item)
    // - ALL CAPS title
    // - Mostly Title Case AND short (section titles are concise)
    // Must NOT be X.Y format (subsection)
    match = line.match(/^(\d)\.?\s+([A-Z].+)$/);
    if (match && !line.match(/^\d+\.\d/)) {  // Exclude X.Y patterns
      const num = match[1];
      const rawTitle = match[2].trim();

      // Check if this looks like a section title vs a list item in body text
      const isAllCaps = /^[A-Z][A-Z\s,&\-]+$/.test(rawTitle);
      const words = rawTitle.split(/\s+/);
      const titleCaseWords = words.filter(w => /^[A-Z]/.test(w)).length;
      const titleCaseRatio = titleCaseWords / words.length;
      const isShort = rawTitle.length < 50;

      // Only accept if:
      // 1. ALL CAPS (clearly a header), or
      // 2. Mostly Title Case (>60%) AND short (<50 chars)
      // This rejects "Content strategy development..." (14% title case, 65 chars)
      // but accepts "Direct Query Questions to RFP Respondents" (83% title case, 42 chars)
      if (isAllCaps || (titleCaseRatio > 0.6 && isShort)) {
        const title = cleanTitle(rawTitle);
        if (title && title.length >= 3 && !sections.has(num)) {
          sections.set(num, { number: num, title });
          console.log(`[detectMajorSections] Found X. format: ${num} -> "${title}" (titleCase=${(titleCaseRatio*100).toFixed(0)}%, len=${rawTitle.length})`);
          continue;
        }
      }
    }

    // Pattern 5: Roman numerals "IV. Title" (comprehensive pattern for I-MMMCMXCIX)
    match = line.match(/^(M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3}))[.\s:]+(.+)$/i);
    if (match && match[1].length > 0) {
      const num = match[1].toUpperCase();
      const title = cleanTitle(match[2]);
      if (title && !sections.has(num)) {
        sections.set(num, { number: num, title });
        console.log(`[detectMajorSections] Found Roman numeral: ${num} -> "${title}"`);
        continue;
      }
    }

    // Pattern 6: Single letter sections "A. Title" or "A: Title"
    match = line.match(/^([A-Z])[.\s:]+([A-Z][A-Za-z\s,&\-'":]+)$/);
    if (match) {
      const num = match[1];
      const title = cleanTitle(match[2]);
      if (title && title.length >= 3 && !sections.has(num)) {
        sections.set(num, { number: num, title });
        console.log(`[detectMajorSections] Found letter section: ${num} -> "${title}"`);
        continue;
      }
    }

    // Pattern 7: ALL CAPS standalone header on short line (e.g., "DIRECT QUERY QUESTIONS")
    // Look for next line to see if it starts with a number (indicating this is a section header)
    if (/^[A-Z][A-Z\s,&\-]+$/.test(line) && line.length >= 10 && line.length <= 60) {
      // Check if previous line has a section number
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      const prevMatch = prevLine.match(/^(\d+)\.0?\s*$/);
      if (prevMatch) {
        const num = prevMatch[1];
        const title = cleanTitle(line);
        if (title && !sections.has(num)) {
          sections.set(num, { number: num, title });
          console.log(`[detectMajorSections] Found ALL CAPS after number: ${num} -> "${title}"`);
          continue;
        }
      }
    }
  }

  // Log what we found for debugging
  if (sections.size === 0) {
    console.log(`[detectMajorSections] WARNING: No section headers found. Doc preview: ${sanitizeForLog(text, 200)}`);
  } else {
    console.log(`[detectMajorSections] Total sections found: ${sections.size}`);
    for (const [num, section] of sections) {
      console.log(`  ${num}: ${section.title}`);
    }
  }

  return sections;
}

/**
 * Clean up a section title string
 */
function cleanTitle(raw: string): string {
  let title = raw.trim();

  // Remove trailing punctuation
  title = title.replace(/[.:\-,]+$/, '');

  // Normalize whitespace
  title = title.replace(/\s+/g, ' ');

  // Convert ALL CAPS to Title Case for readability
  if (/^[A-Z][A-Z\s,&\-]+$/.test(title) && title.length > 3) {
    title = title.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  // Validate - must be reasonable length
  if (title.length < 3 || title.length > 80) {
    return '';
  }

  return title;
}

/**
 * Sort requirements by section number for proper ordering.
 * Handles numeric (3.1.2), alpha-numeric (A.1.2), and mixed formats.
 */
function sortBySection(a: ExtractedRequirement, b: ExtractedRequirement): number {
  if (!a.section && !b.section) return 0;
  if (!a.section) return 1;  // null sections at end
  if (!b.section) return -1;

  // Parse section numbers for proper numeric sorting
  // "3.1.2" vs "3.1.10" should sort correctly (not lexicographically)
  // Also handle "A.1.2" by treating letters as high values
  const parseSegment = (s: string): number => {
    const num = parseInt(s, 10);
    if (!isNaN(num)) return num;
    // Letter sections: A=1000, B=1001, etc.
    if (/^[A-Z]$/i.test(s)) {
      return 1000 + s.toUpperCase().charCodeAt(0) - 65;
    }
    return 0;
  };

  const aParts = a.section.split('.').map(parseSegment);
  const bParts = b.section.split('.').map(parseSegment);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
}

// =============================================================================
// HELPER FUNCTIONS (from main app)
// =============================================================================

/**
 * Detect if a requirement text contains multiple concatenated requirements
 * Returns the count of detected requirement numbers
 */
function detectConcatenatedRequirements(text: string): string[] {
  // Pattern for requirement numbers - multiple formats:
  // X.Y.Z (3.1.1), A.X.Y (A.1.2), X.Y (3.1), X.Ya (3.1a)
  const patterns = [
    /\b(\d+\.\d+\.\d+)\b/g,           // X.Y.Z format (3.1.1)
    /\b([A-Z]\.\d+\.\d+)\b/g,         // A.X.Y format (A.1.2)
    /\b(\d+\.\d+[a-z])\b/g,           // X.Ya format (3.1a)
    /\b(\([a-z]\))\b/g,               // (a) format
  ];

  const allMatches: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      allMatches.push(...matches);
    }
  }

  // Also detect X.Y patterns at the start of lines (likely section headers within text)
  const lineStartPattern = /(?:^|\n)\s*(\d+\.\d+)\s+[A-Z]/gm;
  let match;
  while ((match = lineStartPattern.exec(text)) !== null) {
    if (!allMatches.includes(match[1])) {
      allMatches.push(match[1]);
    }
  }

  return [...new Set(allMatches)]; // Unique values
}

/**
 * Split a concatenated requirement text into individual requirements
 * Returns array of {section, text} objects
 */
function splitConcatenatedRequirement(text: string): Array<{ section: string; text: string }> {
  const results: Array<{ section: string; text: string }> = [];

  // Patterns to split on requirement numbers (multiple formats)
  // Important: Order matters - try more specific patterns first
  const splitPatterns = [
    /(?:^|\n)\s*(\d+\.\d+\.\d+)[\s.]+/gm,    // X.Y.Z at start of line (3.1.1)
    /(?:^|\n)\s*([A-Z]\.\d+\.\d+)[\s.]+/gm,  // A.X.Y at start of line (A.1.2)
    /(?:^|\n)\s*(\d+\.\d+[a-z])[\s.)]+/gm,   // X.Ya at start of line (3.1a)
    /(?:^|\n)\s*(\([a-z]\))[\s.]+/gm,        // (a) at start of line
  ];

  // Find all requirement number positions
  const parts: Array<{ index: number; section: string; endOfSection: number; isHeader: boolean }> = [];

  for (const pattern of splitPatterns) {
    pattern.lastIndex = 0; // Reset regex state for safety
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Check if we already have a part at this position (avoid duplicates)
      const existingIndex = parts.findIndex(p => Math.abs(p.index - match!.index) < 5);
      if (existingIndex === -1) {
        parts.push({
          index: match.index,
          section: match[1].trim(),
          endOfSection: match.index + match[0].length,
          isHeader: false,
        });
      }
    }
  }

  // Also detect X.Y SECTION HEADERS (not questions) - these are boundaries to STOP at
  // Pattern: X.Y followed by title-case words (not question words like Is, Does, Can, etc.)
  const headerPattern = /(?:^|\n)\s*(\d+\.\d+)\s+([A-Z][a-z]+(?:[\s,&]+[A-Za-z]+){2,})/gm;
  headerPattern.lastIndex = 0; // Reset regex state for safety
  let headerMatch;
  while ((headerMatch = headerPattern.exec(text)) !== null) {
    const followingText = headerMatch[2];
    // Skip if it starts with a question word (then it's a question, not a header)
    if (/^(Is|Are|Does|Do|Can|Will|Has|Have|Should|Would|Could|What|How|Why|When|Where|Describe|Explain|Provide|List|Detail|Please|Indicate|Specify|State|Clarify|Confirm|Outline|Summarize)\b/i.test(followingText)) {
      continue;
    }
    // Check if we already have this position
    const existingIndex = parts.findIndex(p => Math.abs(p.index - headerMatch!.index) < 5);
    if (existingIndex === -1) {
      parts.push({
        index: headerMatch.index,
        section: headerMatch[1].trim(),
        endOfSection: headerMatch.index + headerMatch[0].length,
        isHeader: true, // Mark as section header
      });
      console.log(`[splitConcatenatedRequirement] Found X.Y header: ${headerMatch[1]} "${followingText.substring(0, 40)}..."`);
    }
  }

  // Sort parts by position
  parts.sort((a, b) => a.index - b.index);

  // If no splits found, return original as single item
  if (parts.length === 0) {
    console.log(`[splitConcatenatedRequirement] No split points found in text of ${text.length} chars`);
    return [{ section: '', text: text.trim() }];
  }

  console.log(`[splitConcatenatedRequirement] Found ${parts.length} sections to split: ${parts.map(p => p.section + (p.isHeader ? ' (header)' : '')).join(', ')}`);

  // Extract text for each requirement
  for (let i = 0; i < parts.length; i++) {
    const start = parts[i].endOfSection;
    const end = i < parts.length - 1 ? parts[i + 1].index : text.length;
    const reqText = text.substring(start, end).trim();

    if (reqText.length > 0) {
      results.push({
        section: parts[i].section,
        text: parts[i].isHeader ? `[SECTION_HEADER] ${reqText}` : reqText,  // Mark headers for later filtering
      });
    }
  }

  return results;
}

/**
 * Check if text looks like a section header rather than a requirement
 * Section headers are typically short titles without question marks
 */
function isSectionHeader(text: string): boolean {
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
function formatListInRequirement(text: string): string {
  let result = text;

  // Ensure bullet points start on new lines
  result = result.replace(/([.?!])\s*(•)/g, '$1\n$2');

  // Ensure numbered items start on new lines
  result = result.replace(/([.?!])\s*(\d+\.|\([a-z]\)|[a-z]\))/g, '$1\n$2');

  // Add indentation to list items for clarity
  result = result.replace(/\n(•|\d+\.|\([a-z]\)|[a-z]\))/g, '\n  $1');

  return result;
}

/**
 * Extract major category from section reference
 * Examples:
 *   "A.1.2" → "A" (single letter)
 *   "3.4.1" → "3" (number + non-letter)
 *   "III.2" → "III" (Roman numeral)
 *   "MANDATORY REQUIREMENTS" → "MANDATORY REQUIREMENTS" (letter + letter = full title)
 */
function extractMajorCategory(section: string): string {
  const trimmed = section.trim();
  if (!trimmed) return trimmed;

  const firstChar = trimmed[0];
  const secondChar = trimmed[1] || '';

  // 1. Starts with digit → extract leading number
  if (/\d/.test(firstChar)) {
    const numMatch = trimmed.match(/^(\d+)/);
    return numMatch ? numMatch[1] : trimmed;
  }

  // 2. Starts with letter
  if (/[A-Z]/i.test(firstChar)) {
    // If second char is NOT a letter, it's a single-letter section
    // Matches: "A:", "A.", "A-", "A1", "A ", or just "A"
    if (!/[A-Z]/i.test(secondChar)) {
      return firstChar.toUpperCase();
    }

    // Second char IS a letter - check for Roman numerals (I, II, III, IV, V, etc.)
    const romanMatch = trimmed.match(/^([IVX]+)(?:[^A-Z]|$)/i);
    if (romanMatch) {
      return romanMatch[1].toUpperCase();
    }

    // Not a single letter, not a Roman numeral
    // It's a full title like "MANDATORY REQUIREMENTS" - return as-is
    return trimmed;
  }

  return trimmed;
}

// =============================================================================
// POST-PROCESSING FUNCTIONS (from main app)
// =============================================================================

/**
 * Validate requirement type, defaulting to DESCRIPTIVE if invalid
 */
function validateRequirementType(type: string): RequirementType {
  const validTypes: RequirementType[] = [
    "CONTEXTUAL",
    "PROCEDURAL",
    "DECLARATIVE",
    "DESCRIPTIVE",
    "EVIDENCE_BASED",
    "QUANTITATIVE",
    "REFERENCE_BASED",
    "STAFFING",
  ];
  if (validTypes.includes(type as RequirementType)) {
    return type as RequirementType;
  }
  return "DESCRIPTIVE"; // Default fallback
}

/**
 * Heuristic correction: DESCRIPTIVE → QUANTITATIVE for actual financial/numeric requirements
 */
function correctQuantitativeType(text: string, llmType: RequirementType): RequirementType {
  // Only correct DESCRIPTIVE classifications
  if (llmType !== "DESCRIPTIVE") return llmType;

  const lowerText = text.toLowerCase();

  // STEP 1: Require STRICT financial indicators (not generic words)
  const strictFinancialIndicators = [
    /[£$€¥]/,                           // Currency symbols
    /\b\d+(\.\d+)?\s*%/,                // Percentage with number (e.g., "5%", "10.5%")
    /\bpric(e|es|ing)\b/,               // Price (word boundary required)
    /\bcost(s|ing)?\b/,                 // Cost
    /\bfee(s)?\b/,                      // Fee
    /\bbudget\b/,                       // Budget
    /\bquot(e|ation)\b/,                // Quote/quotation
    /\btariff\b/,                       // Tariff
    /\b(hourly|daily|annual)\s+rate\b/, // Specific rate types
  ];

  const hasFinancialIndicator = strictFinancialIndicators.some(p => p.test(lowerText));

  // If no financial context at all, keep DESCRIPTIVE
  if (!hasFinancialIndicator) {
    return llmType;
  }

  // STEP 2: Exclude process/approach questions (these are DESCRIPTIVE even with financial terms)
  const processPatterns = [
    /\bapproach\s+to\s+(pricing|cost|fee)/i,
    /\bdescribe\s+(your\s+)?approach\b/i,
    /\bexplain\s+(your\s+)?approach\b/i,
    /\bexplain\s+how\s+you\b/i,
    /\bmethodology\s+(for|of)\b/i,
    /\bstrategy\s+for\b/i,
    /\bhow\s+do\s+you\s+(handle|manage|approach)\b/i,
    /\bdescribe\s+your\s+.{0,30}(process|method|approach|strategy)/i,
  ];

  if (processPatterns.some(p => p.test(lowerText))) {
    return llmType; // Asking about process, not specific numbers
  }

  // STEP 3: Require explicit "asking for numbers" pattern
  const askingForNumbersPatterns = [
    /\bprovide\s+(your\s+)?(pricing|costs?|fees?|rates?)\b/i,
    /\bwhat\s+(is|are)\s+(your|the)\s+(price|cost|fee|rate)\b/i,
    /\blist\s+(your\s+)?(pricing|rates?|fees?|costs?)\b/i,
    /\btotal\s+(cost|price|amount|fee)\b/i,
    /\bquote\s+(for|your)\b/i,
    /\bprovide\s+a\s+(breakdown|schedule)\s+of\b/i,
    /\bstate\s+(your|the)\s+(price|cost|fee|rate)\b/i,
  ];

  if (askingForNumbersPatterns.some(p => p.test(lowerText))) {
    return "QUANTITATIVE";
  }

  // Currency symbol followed by digit = definitely QUANTITATIVE
  if (/[£$€¥]\s*\d/.test(text)) {
    return "QUANTITATIVE";
  }

  // Has financial terms but not clearly asking for numbers - keep DESCRIPTIVE
  return llmType;
}

/**
 * Post-process extracted requirements to split any that were incorrectly concatenated.
 * The LLM sometimes groups multiple numbered requirements (3.1.1, 3.1.2, etc.) into one.
 * This function detects and splits them, then strips section prefixes from individual parts.
 */
function splitConcatenatedRequirementsPostProcess(
  requirements: ExtractedRequirement[]
): ExtractedRequirement[] {
  const result: ExtractedRequirement[] = [];
  let splitCount = 0;

  for (const req of requirements) {
    // Check for multiple requirement numbers in the text (using RAW text with section numbers)
    const detectedNumbers = detectConcatenatedRequirements(req.text);

    // If 2+ requirement numbers found, this needs splitting
    if (detectedNumbers.length >= 2) {
      console.log(`[splitConcatenatedRequirements] Detected ${detectedNumbers.length} concatenated requirements in section ${req.section}:`, detectedNumbers);

      const splitParts = splitConcatenatedRequirement(req.text);

      for (const part of splitParts) {
        // Skip empty parts
        if (!part.text.trim()) continue;

        // Check if this is a marked section header - skip it entirely
        // (Section headers are metadata, not requirements to respond to)
        if (part.text.startsWith('[SECTION_HEADER]')) {
          console.log(`[splitConcatenatedRequirements] Skipping section header: ${part.section}`);
          continue;
        }

        // NOW strip section prefix from the individual split part
        const strippedText = stripSectionPrefix(part.text);

        // Skip if stripping resulted in empty text
        if (!strippedText.trim()) continue;

        // Check if this part is actually a section header (not a requirement)
        if (isSectionHeader(strippedText)) {
          // Skip section headers - they're not requirements
          console.log(`[splitConcatenatedRequirements] Skipping detected header: "${strippedText.substring(0, 50)}..."`);
          continue;
        } else {
          // Re-classify based on the actual split requirement text
          const classification = classifyRequirement(strippedText);

          result.push({
            ...req,
            text: formatListInRequirement(strippedText),
            section: part.section || req.section,
            type: classification.type,
            isMandatory: classification.isMandatory,
            domainContext: classification.domainContext,
            isAttestation: classification.isAttestation,
            wordLimit: classification.wordLimit,
            characterLimit: classification.characterLimit,
          });
        }
        splitCount++;
      }
    } else {
      // No concatenation detected - strip section prefix and format
      // (For requirements that weren't concatenated, we still need to strip prefix)
      const strippedText = stripSectionPrefix(req.text);

      if (strippedText.trim()) {
        result.push({
          ...req,
          text: formatListInRequirement(strippedText),
        });
      }
    }
  }

  if (splitCount > 0) {
    console.log(`[splitConcatenatedRequirements] Split ${splitCount} concatenated requirements. Total requirements: ${result.length}`);
  }

  return result;
}

/**
 * Extract X.Y subsection from a section like "3.1.5" -> "3.1"
 */
function getSubsection(section: string | null): string | null {
  if (!section) return null;
  const match = section.match(/^(\d+\.\d+)/);
  return match ? match[1] : null;
}

/**
 * Remove duplicate requirements based on text similarity.
 * Keeps the first occurrence and removes subsequent duplicates.
 *
 * IMPORTANT: Only removes TRUE duplicates where the text is nearly identical.
 * Does NOT remove requirements that merely share similar phrasing.
 * CRITICAL: Never removes items from DIFFERENT subsections (e.g., 3.8 vs 3.9)
 */
function deduplicateRequirements(requirements: ExtractedRequirement[]): ExtractedRequirement[] {
  const seen = new Map<string, ExtractedRequirement>();
  const result: ExtractedRequirement[] = [];
  let dupeCount = 0;

  for (const req of requirements) {
    // Normalize text for comparison (lowercase, collapse whitespace)
    const normalizedText = req.text.toLowerCase().replace(/\s+/g, ' ').trim();
    const reqSubsection = getSubsection(req.section);

    // Skip very short text (likely just section numbers or noise)
    if (normalizedText.length < 10) {
      continue;
    }

    // Check for exact duplicates only - but ONLY within the same subsection
    if (seen.has(normalizedText)) {
      const seenReq = seen.get(normalizedText)!;
      const seenSubsection = getSubsection(seenReq.section);

      // Only dedupe if SAME subsection OR no section info
      if (reqSubsection === seenSubsection || !reqSubsection || !seenSubsection) {
        console.log(`[deduplicateRequirements] Removing exact duplicate: ${req.section} (same as ${seenReq.section})`);
        dupeCount++;
        continue;
      }
    }

    // Check for near-duplicates ONLY if one text is a complete subset of another
    // This catches cases where the LLM returns overlapping line ranges
    // CRITICAL: Items with DIFFERENT section identifiers are NEVER duplicates
    let isDupe = false;
    for (const [seenText, seenReq] of seen) {
      // CRITICAL FIX: Items with DIFFERENT full section identifiers are NEVER duplicates
      // This prevents false positives like 3.3.8 and 3.3.9 being compared
      // Works for ANY section format: X.Y.Z, Roman, Letter, etc.
      if (req.section && seenReq.section && req.section !== seenReq.section) {
        continue; // Different sections can't be duplicates
      }

      const seenSubsection = getSubsection(seenReq.section);

      // Additional check: NEVER dedupe items from different X.Y subsections
      if (reqSubsection && seenSubsection && reqSubsection !== seenSubsection) {
        continue;
      }

      // Only check longer texts to avoid false positives
      if (normalizedText.length > MIN_DEDUPE_TEXT_LENGTH && seenText.length > MIN_DEDUPE_TEXT_LENGTH) {
        const shorter = normalizedText.length < seenText.length ? normalizedText : seenText;
        const longer = normalizedText.length < seenText.length ? seenText : normalizedText;

        // ONLY dedupe if one is a complete substring of the other
        // The shorter text must be substantial and represent a significant portion of the longer
        if (longer.includes(shorter)) {
          // Verify the shorter text is substantial (not just a common phrase)
          if (shorter.length >= MIN_SUBSTANTIAL_TEXT_LENGTH && shorter.length > longer.length * SUBSET_LENGTH_RATIO) {
            console.log(`[deduplicateRequirements] Removing subset duplicate: ${req.section} is contained in ${seenReq.section}`);
            dupeCount++;
            isDupe = true;
            break;
          }
        }
      }
    }

    if (!isDupe) {
      seen.set(normalizedText, req);
      result.push(req);
    }
  }

  if (dupeCount > 0) {
    console.log(`[deduplicateRequirements] Removed ${dupeCount} duplicates. Kept ${result.length} requirements.`);
  }

  return result;
}

/**
 * Detect and classify section headers that the LLM might have missed marking as CONTEXTUAL.
 * Subsection titles (e.g., "3.1 Design, Form, and Templates") should be CONTEXTUAL, not DESCRIPTIVE.
 */
function reclassifySectionHeaders(requirements: ExtractedRequirement[]): void {
  for (const req of requirements) {
    try {
      // Skip if already CONTEXTUAL
      if (req.type === "CONTEXTUAL") continue;

      // Check if this looks like a section header
      if (isSectionHeader(req.text)) {
        console.log(`[reclassifySectionHeaders] Reclassifying ${req.section} from ${req.type} to CONTEXTUAL`);
        req.type = "CONTEXTUAL";
      }
    } catch (err) {
      // Log but don't fail - continue processing other requirements
      console.warn(`[reclassifySectionHeaders] Error processing requirement ${req.section}:`, err);
    }
  }
}

/**
 * Post-process to enrich sectionGroup with titles from document structure.
 * If LLM didn't provide a sectionGroup or it lacks a title, derive it from the document.
 */
function enrichSectionData(requirements: ExtractedRequirement[], documentText: string): void {
  // Build a map of major section numbers to their titles from document headings
  const sectionTitleMap = new Map<string, string>();

  console.log("[enrichSectionData] Starting section enrichment...");

  // Multi-pattern heading extraction for different document formats
  const headingPatterns = [
    // Pattern 1: Markdown headings (from DOCX parser)
    /#+\s*([A-Z]|[IVXLC]+|\d+)[.:\)]*\s*[:\-.\s]\s*([A-Z][A-Za-z\s,&\-]+)/gi,

    // Pattern 2: Plain text section headers with colon separator
    /(?:^|\n)\s*([A-Z]|[IVXLC]+|\d+)[.:\)]*\s*:\s*([A-Z][A-Za-z\s,&\-]{3,})/gi,

    // Pattern 3: Plain text section headers with period separator
    /(?:^|\n)\s*([A-Z]|[IVXLC]+|\d+)\.\s+([A-Z][A-Za-z\s,&\-]{3,})/gi,

    // Pattern 4: "SECTION X:" format
    /(?:^|\n)\s*SECTION\s+([A-Z]|\d+)[.:\)]*\s*[:\-.\s]\s*([A-Z][A-Za-z\s,&\-]+)/gi,

    // Pattern 5: Parenthetical section markers
    /(?:^|\n)\s*\(([A-Z]|\d+)\)\s+([A-Z][A-Za-z\s,&\-]{3,})/gi,

    // Pattern 6: All-caps title following section number
    /(?:^|\n)\s*([A-Z])\s{2,}([A-Z][A-Z\s,&\-]{5,})/g,
  ];

  // Try each pattern and collect all matches
  for (const pattern of headingPatterns) {
    for (const match of documentText.matchAll(pattern)) {
      const num = match[1].toUpperCase();
      const title = match[2].trim();
      // Only add if we found a valid title and haven't already found one for this section
      if (title.length > 2 && !sectionTitleMap.has(num)) {
        sectionTitleMap.set(num, title);
        console.log(`[enrichSectionData] Found section title: ${num} -> "${title}"`);
      }
    }
  }

  console.log(`[enrichSectionData] Found ${sectionTitleMap.size} section titles in document`);

  // Enrich each requirement's sectionGroup
  for (const req of requirements) {
    // Skip if no section reference at all
    if (!req.section && !req.sectionGroup) continue;

    // Extract major category from section (A.1.2 → A)
    const majorCategory = req.section
      ? extractMajorCategory(req.section)
      : (req.sectionGroup ? extractMajorCategory(req.sectionGroup) : null);

    if (!majorCategory) continue;

    // Check if sectionGroup needs enrichment
    const sectionGroupTrimmed = (req.sectionGroup || '').trim();
    const needsEnrichment =
      !req.sectionGroup ||
      /^([A-Z]|\d+|[IVXLC]+)[.:\)\s]*$/i.test(sectionGroupTrimmed) || // Just a number/letter
      /^[A-Z]\d+$/i.test(sectionGroupTrimmed) || // Letter+number like "A15"
      /^[A-Z][.\-]\d/i.test(sectionGroupTrimmed) || // Subsection like "A.1"
      /^\d+\.\d/i.test(sectionGroupTrimmed) || // Numeric subsection like "3.4"
      (req.section && req.sectionGroup === req.section) || // sectionGroup equals section
      (!sectionGroupTrimmed.includes(':') && sectionGroupTrimmed.length < 20); // Missing ": TITLE"

    if (needsEnrichment) {
      const title = sectionTitleMap.get(majorCategory.toUpperCase());
      if (title) {
        const oldValue = req.sectionGroup;
        req.sectionGroup = `${majorCategory}: ${title}`;
        console.log(`[enrichSectionData] Enriched: "${oldValue}" -> "${req.sectionGroup}"`);
      } else if (!req.sectionGroup || !req.sectionGroup.includes(':')) {
        // No title found, at least set the major category
        req.sectionGroup = majorCategory;
      }
    }
  }
}

// =============================================================================
// LINE NUMBER UTILITIES
// =============================================================================

/**
 * Add line numbers to document text.
 * Format: "L1: first line\nL2: second line\n..."
 */
function addLineNumbers(text: string): { numberedText: string; lines: string[]; lineMap: Map<number, number> } {
  const allLines = text.split('\n');
  const numberedLines: string[] = [];
  const contentLines: string[] = [];
  const lineMap = new Map<number, number>(); // Maps L-number to original line index

  let lineNum = 1;
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    // Only number non-empty lines (skip pure whitespace)
    if (line.trim().length > 0) {
      numberedLines.push(`L${lineNum}: ${line}`);
      contentLines.push(line);
      lineMap.set(lineNum, contentLines.length - 1); // Map L-number to content index
      lineNum++;
    }
  }

  return {
    numberedText: numberedLines.join('\n'),
    lines: contentLines, // Only non-empty lines
    lineMap, // For mapping L-numbers to array indices
  };
}

/**
 * Extract text from document using line range.
 * Returns RAW text - section prefixes are stripped later after splitting.
 */
function extractTextFromLines(lines: string[], startLine: number, endLine: number): string {
  // Convert to 0-indexed
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length - 1, endLine - 1);

  if (start > end || start >= lines.length) {
    return '';
  }

  // Return RAW text - do NOT strip section prefixes here
  // Stripping happens after splitting so we can detect concatenated requirements
  return lines.slice(start, end + 1).join('\n').trim();
}

/**
 * Detect section number from the beginning of text.
 * Returns the section number if found, null otherwise.
 * Examples:
 *   "3.14.12 Does the solution..." → "3.14.12"
 *   "A.1.2 Describe your approach..." → "A.1.2"
 *   "Some text without section" → null
 */
function detectSectionFromText(text: string): string | null {
  if (!text) return null;

  // Trim leading whitespace for matching
  const trimmed = text.trimStart();

  // Pattern 1: X.Y.Z format (e.g., "3.14.12")
  const xyzMatch = trimmed.match(/^(\d+\.\d+\.\d+)\b/);
  if (xyzMatch) return xyzMatch[1];

  // Pattern 2: X.Y format (e.g., "3.14")
  const xyMatch = trimmed.match(/^(\d+\.\d+)\b/);
  if (xyMatch) return xyMatch[1];

  // Pattern 3: A.X.Y format (e.g., "A.1.2")
  const alphaMatch = trimmed.match(/^([A-Z]\.\d+\.\d+)\b/i);
  if (alphaMatch) return alphaMatch[1].toUpperCase();

  // Pattern 4: A.X format (e.g., "A.1")
  const alphaXYMatch = trimmed.match(/^([A-Z]\.\d+)\b/i);
  if (alphaXYMatch) return alphaXYMatch[1].toUpperCase();

  // Pattern 5: Roman.X.Y format (e.g., "IV.1.2", "II.3")
  const romanMatch = trimmed.match(/^((?:M{0,3})(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{1,3}))\.(\d+)(?:\.(\d+))?\b/i);
  if (romanMatch) {
    const roman = romanMatch[1].toUpperCase();
    const minor = romanMatch[2];
    const tertiary = romanMatch[3];
    return tertiary ? `${roman}.${minor}.${tertiary}` : `${roman}.${minor}`;
  }

  return null;
}

/**
 * Validate that a section string looks like a real section identifier.
 * Format-agnostic: just checks it's short, has no spaces, and isn't a common word.
 *
 * Valid: "3.1.2", "A.1", "IV.2", "(a)", "1)", "i."
 * Invalid: "Reporting and Analytics", "section", "Executive Summary"
 */
function isValidSection(section: string | null): boolean {
  if (!section) return false;

  // Too long - real section IDs are short (e.g., "3.14.29" is 7 chars)
  if (section.length > 15) return false;

  // Contains spaces - real section IDs don't have spaces
  if (section.includes(' ')) return false;

  // Is a common English word (lowercase check)
  const lower = section.toLowerCase();
  const commonWords = ['section', 'chapter', 'part', 'item', 'appendix', 'exhibit', 'schedule', 'attachment'];
  if (commonWords.includes(lower)) return false;

  return true;
}

/**
 * Strip section number prefixes from requirement text.
 * Examples:
 *   "4.4.5 Is any software required..." → "Is any software required..."
 *   "A.1.2 Describe your approach..." → "Describe your approach..."
 *   "3.\n  3.1 Some text" → "Some text"
 */
function stripSectionPrefix(text: string): string {
  // Pattern matches section numbers at start of text:
  // - "4.4.5 " or "4.4.5. " (numbered sections)
  // - "A.1.2 " or "A.1.2. " (letter sections)
  // - "4." or "A." on its own line followed by more content
  // - "(a)" or "(1)" style prefixes

  let result = text;

  // Remove leading section numbers like "4.4.5 " or "A.1.2 " or "4.4.5. "
  result = result.replace(/^(\d+\.)+\d*\s*\.?\s*/m, '');
  result = result.replace(/^[A-Z](\.\d+)+\s*\.?\s*/im, '');

  // Remove standalone section markers like "4.\n" at the start
  result = result.replace(/^\d+\.\s*\n\s*/m, '');
  result = result.replace(/^[A-Z]\.\s*\n\s*/im, '');

  // Remove subsection numbers after newlines: "\n  4.5 " → "\n"
  result = result.replace(/\n\s*(\d+\.)+\d*\s*\.?\s*/g, '\n');
  result = result.replace(/\n\s*[A-Z](\.\d+)+\s*\.?\s*/gi, '\n');

  // Remove parenthetical prefixes like "(a) " or "(1) "
  result = result.replace(/^\([a-z0-9]+\)\s*/im, '');

  // Clean up any resulting leading/trailing whitespace or empty lines
  result = result.replace(/^\s*\n+/, '').trim();

  return result;
}

// Compact array format from LLM (ultra-compact - classification and sectionGroup derived in post-processing)
// Each requirement is: [startLine, endLine, section]
type CompactRequirement = [number, number, string | null];

interface CompactResult {
  d: string | null;   // deadline
  dt: string | null;  // deadlineText
  r: CompactRequirement[];  // requirements
}

// =============================================================================
// HEURISTIC CLASSIFICATION FUNCTIONS
// =============================================================================

type QuestionStructureType = 'yes_no' | 'open_ended' | 'list_request' | 'confirmation' | 'statement' | 'unknown';

interface QuestionStructure {
  type: QuestionStructureType;
  confidence: number;
}

/**
 * Pass 1: Detect the structural pattern of a question/requirement.
 * This determines HOW the question is asked, not WHAT it's about.
 */
function detectQuestionStructure(text: string): QuestionStructure {
  const trimmed = text.trim();
  const endsWithQuestion = trimmed.endsWith('?');

  // YES/NO questions - start with auxiliary verbs
  // More permissive: any "Can X...?" is likely yes/no
  if (/^can\s+\w+/i.test(trimmed) && endsWithQuestion) {
    // Exclude "Can you describe/explain..." which are open-ended
    if (!/^can\s+(you\s+)?(describe|explain|detail|outline|provide)/i.test(trimmed)) {
      return { type: 'yes_no', confidence: 95 };
    }
  }

  // "Does/Do X...?" patterns
  if (/^(does|do)\s+\w+/i.test(trimmed) && endsWithQuestion) {
    // Exclude "Do you describe..." type patterns
    if (!/^(does|do)\s+(you\s+)?(describe|explain|detail)/i.test(trimmed)) {
      return { type: 'yes_no', confidence: 95 };
    }
  }

  // "Is/Are X...?" patterns
  if (/^is\s+\w+/i.test(trimmed) && endsWithQuestion) {
    return { type: 'yes_no', confidence: 95 };
  }
  if (/^are\s+\w+/i.test(trimmed) && endsWithQuestion) {
    return { type: 'yes_no', confidence: 95 };
  }

  // "Will/Would/Has/Have X...?" patterns
  if (/^(will|would|has|have)\s+\w+/i.test(trimmed) && endsWithQuestion) {
    return { type: 'yes_no', confidence: 90 };
  }

  // OPEN-ENDED questions - require descriptive answers
  if (/^describe\b/i.test(trimmed)) {
    return { type: 'open_ended', confidence: 95 };
  }
  if (/^explain\b/i.test(trimmed)) {
    return { type: 'open_ended', confidence: 95 };
  }
  if (/^(how|what|why)\s+(does|do|is|are|will|would|can)/i.test(trimmed)) {
    return { type: 'open_ended', confidence: 92 };
  }
  if (/^(detail|outline|discuss)\b/i.test(trimmed)) {
    return { type: 'open_ended', confidence: 90 };
  }

  // LIST requests - ask for enumeration
  if (/^(list|identify|name|enumerate)\b/i.test(trimmed)) {
    return { type: 'list_request', confidence: 92 };
  }
  if (/^provide\s+(a\s+)?list\b/i.test(trimmed)) {
    return { type: 'list_request', confidence: 90 };
  }

  // CONFIRMATION requests - attestation/certification
  if (/^(please\s+)?(confirm|acknowledge|agree|certify|attest)\b/i.test(trimmed)) {
    return { type: 'confirmation', confidence: 95 };
  }

  // Provide/submit with details usually means open-ended
  if (/^(provide|submit)\s+(a\s+)?(detailed|comprehensive)/i.test(trimmed)) {
    return { type: 'open_ended', confidence: 85 };
  }

  // Fallback based on punctuation
  if (trimmed.endsWith('?')) {
    return { type: 'unknown', confidence: 50 };
  }
  return { type: 'statement', confidence: 30 };
}

interface TopicMatch {
  type: RequirementType;
  confidence: number;
}

/**
 * Pass 2: Detect topic-based patterns in requirement text.
 * This determines WHAT the requirement is about.
 */
function detectTopicPattern(text: string): TopicMatch | null {
  const lower = text.toLowerCase();

  // STAFFING - Personnel, team, resources
  // Note: "resume" as verb (save & resume) should NOT match - only CV/resume
  if (/\b(staff|personnel|team\s+(member|composition|structure)|fte|full[- ]time\s+equivalent)\b/i.test(lower)) {
    return { type: 'STAFFING', confidence: 90 };
  }
  // Only match "resume" when it means CV (not "save & resume", "resume later", etc.)
  if (/\b(cv|curriculum\s+vitae|key\s+personnel|project\s+manager)\b/i.test(lower)) {
    return { type: 'STAFFING', confidence: 85 };
  }
  // "resume" only when preceded by "submit", "provide", "attach" (CV context)
  if (/\b(submit|provide|attach|include)\s+(a\s+|your\s+)?resume\b/i.test(lower)) {
    return { type: 'STAFFING', confidence: 85 };
  }
  if (/\b(qualifications?|experience)\b.{0,30}\b(staff|team|personnel)\b/i.test(lower)) {
    return { type: 'STAFFING', confidence: 80 };
  }

  // QUANTITATIVE - Pricing, costs, numbers, financial
  if (/[£$€¥]\s*\d/.test(text)) {
    return { type: 'QUANTITATIVE', confidence: 95 };
  }
  if (/\b(price|pricing|cost|fee|rate|budget|quote|quotation|tariff)\b/i.test(lower)) {
    if (/\b(provide|submit|state|list|what)\b.*\b(price|cost|fee|rate|budget|quote)\b/i.test(lower)) {
      return { type: 'QUANTITATIVE', confidence: 90 };
    }
    if (/\b(total|hourly|daily|annual|monthly)\s+(price|cost|fee|rate)\b/i.test(lower)) {
      return { type: 'QUANTITATIVE', confidence: 88 };
    }
  }

  // REFERENCE_BASED - References, case studies, past performance
  if (/\b(reference|case\s+study|case\s+studies|past\s+performance|previous\s+(project|contract|client))\b/i.test(lower)) {
    return { type: 'REFERENCE_BASED', confidence: 90 };
  }
  if (/\b(similar\s+(work|project|contract)|client\s+(name|reference)|testimonial)\b/i.test(lower)) {
    return { type: 'REFERENCE_BASED', confidence: 85 };
  }

  // EVIDENCE_BASED - Proof, evidence, certifications
  // Note: "audit log" and "audit trail" are FEATURES, not evidence - exclude them
  const hasAuditFeature = /\baudit\s+(log|trail|history|capabilities)\b/i.test(lower);
  if (!hasAuditFeature) {
    if (/\b(provide\s+evidence|demonstrate|proof\s+of|certif|accredit|audit|compliance\s+evidence)\b/i.test(lower)) {
      return { type: 'EVIDENCE_BASED', confidence: 88 };
    }
  }
  if (/\b(iso\s*\d{4,5}|soc\s*[12]|cmmi|itil)\b/i.test(lower)) {
    return { type: 'EVIDENCE_BASED', confidence: 85 };
  }

  // PROCEDURAL - Process, timeline, schedule, methodology
  if (/\b(timeline|schedule|milestone|phase|gantt|project\s+plan)\b/i.test(lower)) {
    return { type: 'PROCEDURAL', confidence: 88 };
  }
  if (/\b(process|procedure|methodology|approach|workflow)\b/i.test(lower)) {
    if (/\b(describe|outline|provide|detail|explain)\b/i.test(lower)) {
      return { type: 'PROCEDURAL', confidence: 82 };
    }
  }

  // CONTEXTUAL - Section headers (short, title-case, no question)
  const trimmed = text.trim();
  if (trimmed.length < 80 && !trimmed.includes('?')) {
    const words = trimmed.split(/\s+/);
    const titleCaseCount = words.filter(w => /^[A-Z]/.test(w)).length;
    if (titleCaseCount / words.length > 0.6 || /^[A-Z\s\-&:]+$/.test(trimmed)) {
      return { type: 'CONTEXTUAL', confidence: 85 };
    }
  }

  // CONTEXTUAL - Document format/submission instructions
  // These are instructions about HOW to format the response, not actual requirements
  if (/\b(table\s+of\s+contents|executive\s+summary|cover\s+(page|letter|sheet)|title\s+page|transmittal\s+letter)\b/i.test(lower)) {
    // These document element names strongly indicate format instructions
    return { type: 'CONTEXTUAL', confidence: 88 };
  }
  // Response/proposal structure instructions
  if (/\b(response|proposal)\s+(must|shall|should)\s+(include|contain|provide|be)/i.test(lower)) {
    if (/\b(page|format|section|tab|attachment|appendix|exhibit)\b/i.test(lower)) {
      return { type: 'CONTEXTUAL', confidence: 86 };
    }
  }
  // Submission format instructions
  if (/\b(response|proposal|submission)\s+(format|shall|must|should)\b/i.test(lower)) {
    if (/\b(page|font|margin|format|submit|attach|include)\b/i.test(lower)) {
      return { type: 'CONTEXTUAL', confidence: 85 };
    }
  }
  // RFP process/timeline information (not requirements to respond to)
  if (/\b(rfp|request\s+for\s+proposal)\s+(evaluation|timeline|schedule|process)\b/i.test(lower)) {
    return { type: 'CONTEXTUAL', confidence: 82 };
  }
  // Contact information sections
  if (/\b(contact|point\s+of\s+contact|questions\s+(about|regarding)|submit\s+questions)\b/i.test(lower)) {
    if (/\b(email|phone|address)\b/i.test(lower)) {
      return { type: 'CONTEXTUAL', confidence: 80 };
    }
  }

  return null;
}

/**
 * Pass 3: Combine question structure and topic pattern for final classification.
 * Uses rules to determine the most appropriate requirement type.
 */
function classifyType(text: string): RequirementType {
  const structure = detectQuestionStructure(text);
  const topic = detectTopicPattern(text);
  const lower = text.toLowerCase();

  // Rule 0: Explicit "describe" requests
  const hasDescribeRequest = /\b(please\s+)?describe\b/i.test(lower) ||
                              /^describe\b/i.test(text.trim());

  if (hasDescribeRequest && topic?.type !== 'CONTEXTUAL') {
    // Check for process/methodology keywords → PROCEDURAL
    const hasProcessKeywords = /\b(process|procedure|methodology|approach|workflow|timeline|schedule|milestone|phase|implementation|deployment)\b/i.test(lower);
    if (hasProcessKeywords) {
      return 'PROCEDURAL';
    }
    // Otherwise → DESCRIPTIVE
    return 'DESCRIPTIVE';
  }

  // Rule 1: Strong topic match wins if confident enough (but not over describe)
  if (topic && topic.confidence >= 85) {
    return topic.type;
  }

  // Rule 2: Yes/no questions → DECLARATIVE
  // Give yes/no structure higher priority - these are simple capability questions
  // Only allow STAFFING, QUANTITATIVE, REFERENCE_BASED, EVIDENCE_BASED to override
  // (never let generic DESCRIPTIVE override yes/no)
  if (structure.type === 'yes_no' && structure.confidence >= 85) {
    if (topic && topic.confidence >= 80 &&
        ['STAFFING', 'QUANTITATIVE', 'REFERENCE_BASED', 'EVIDENCE_BASED'].includes(topic.type)) {
      return topic.type; // Only specific topic types can override yes/no
    }
    return 'DECLARATIVE';
  }

  // Rule 3: Confirmation requests → DECLARATIVE
  if (structure.type === 'confirmation' && structure.confidence >= 85) {
    return 'DECLARATIVE';
  }

  // Rule 4: List requests → check topic or default to DESCRIPTIVE
  if (structure.type === 'list_request') {
    if (topic && topic.confidence >= 60) {
      return topic.type;
    }
    return 'DESCRIPTIVE';
  }

  // Rule 5: Open-ended questions → check topic or DESCRIPTIVE
  if (structure.type === 'open_ended') {
    if (topic && topic.confidence >= 60) {
      return topic.type;
    }
    return 'DESCRIPTIVE';
  }

  // Rule 6: Topic match wins if moderately confident
  if (topic && topic.confidence >= 60) {
    return topic.type;
  }

  // Default: DESCRIPTIVE for most requirements
  return 'DESCRIPTIVE';
}

// Anti-patterns: these describe CONTENT, not the requirement being optional
const OPTIONAL_CONTENT_ANTIPATTERNS: RegExp[] = [
  /\b(describe|explain|detail|list|what\s+are)\b.{0,30}\b(optional|recommended)/i,
  /\boptional\s+(fields?|settings?|features?|parameters?|configurations?|validation|criteria|functionality|modules?|add-?ons?)\b/i,
  /\brecommended\s+(settings?|configurations?|approach|process|system|practices?|methods?)\b/i,
  /\bwhat\s+(is|are)\s+(the\s+)?recommended\b/i,
  /\b(include|provide|add|attach).{0,20}if\s+(applicable|available|possible)\b/i,
  /\b(support|handle|manage).{0,20}optional\b/i,
  /\boptional\s+(for|to)\s+(users?|clients?|customers?)\b/i,
];

/**
 * Determine if requirement is MANDATORY based on text content.
 * Uses anti-patterns to avoid false-positives where "optional" describes content, not the requirement.
 */
function classifyMandatory(text: string): boolean {
  const lower = text.toLowerCase();

  // Check anti-patterns first - if matched, "optional" refers to content, not requirement
  const hasContentAntipattern = OPTIONAL_CONTENT_ANTIPATTERNS.some(ap => ap.test(text));

  if (!hasContentAntipattern) {
    // Only check optional patterns if no anti-pattern matched
    // Explicit OPTIONAL signals - return false
    if (/\b(optional|if desired|if applicable|where applicable|at your discretion)\b/i.test(lower)) {
      return false;
    }
    if (/\b(not required|not mandatory|nice to have|desirable but not)\b/i.test(lower)) {
      return false;
    }
    if (/\b(may choose|you may|bonus|preferred but not)\b/i.test(lower)) {
      return false;
    }
  }

  // Everything else is mandatory by default in RFPs
  return true;
}

/**
 * Classify DOMAIN context (Feature, Process, Legal)
 * Determines the domain category of a requirement based on its content.
 */
function classifyDomain(text: string): 'FEATURE' | 'PROCESS' | 'LEGAL' {
  const lower = text.toLowerCase();

  // LEGAL - Compliance, regulatory, legal terms, contracts
  // Core legal/compliance terms
  if (/\b(comply|compliance|regulation|regulatory|legal|law|statute|legislation)\b/i.test(lower)) {
    return 'LEGAL';
  }
  // Specific regulations and standards
  if (/\b(gdpr|hipaa|sox|pci|iso\s*\d{4,5}|far\s+\d|dfar|nist|fedramp)\b/i.test(lower)) {
    return 'LEGAL';
  }
  // Contract and liability terms
  if (/\b(contract|liability|indemnif|warrant|terms\s+and\s+conditions)\b/i.test(lower)) {
    return 'LEGAL';
  }
  // Privacy and data protection
  if (/\b(privacy\s+policy|data\s+protection|confidential|nda|non-?disclosure)\b/i.test(lower)) {
    return 'LEGAL';
  }
  // Insurance and bonding
  if (/\b(insurance|bonding|surety|e&o|errors\s+and\s+omissions)\b/i.test(lower)) {
    return 'LEGAL';
  }
  // Intellectual property
  if (/\b(intellectual\s+property|copyright|patent|trademark|licensing)\b/i.test(lower)) {
    return 'LEGAL';
  }

  // PROCESS - Methodology, approach, process-related
  // Questions about HOW things are done
  if (/\b(how do you|how will you|how does your|how would you)\b/i.test(lower)) {
    return 'PROCESS';
  }
  // Process/methodology when combined with action verbs
  if (/\b(process|procedure|methodology|approach|workflow)\b/i.test(lower)) {
    if (/\b(describe|explain|outline|detail|provide)\b/i.test(lower)) {
      return 'PROCESS';
    }
  }
  // Timeline and schedule related
  if (/\b(timeline|schedule|milestone|phase|project\s+plan|gantt)\b/i.test(lower)) {
    return 'PROCESS';
  }
  // Implementation and delivery
  if (/\b(implement|deploy|deliver|manage|monitor|maintain|support|transition)\b/i.test(lower)) {
    if (/\b(how|approach|process|methodology|procedure|plan)\b/i.test(lower)) {
      return 'PROCESS';
    }
  }
  // Quality and management processes
  if (/\b(quality\s+(assurance|control|management)|change\s+management|risk\s+management)\b/i.test(lower)) {
    return 'PROCESS';
  }
  // Training and onboarding
  if (/\b(training|onboarding|knowledge\s+transfer)\b/i.test(lower)) {
    if (/\b(process|approach|plan|methodology)\b/i.test(lower)) {
      return 'PROCESS';
    }
  }

  // FEATURE - Default for technical capabilities, features, functionality
  return 'FEATURE';
}

// Signals that indicate a WRITTEN RESPONSE is required (NOT attestation)
const WRITTEN_RESPONSE_SIGNALS: RegExp[] = [
  /\b(describe|explain|detail|demonstrate|outline|discuss)\b/i,
  /\b(how will|how do|how does|how would|what is your)\b/i,
  /\b(methodology|approach|strategy|plan for)\b/i,
  /\b(provide.*information|provide.*details|provide.*description)\b/i,
  /\b(submit.*document|attach|include.*sample)\b/i,
];

// Signals that indicate ATTESTATION (simple yes/no or compliance confirmation)
const ATTESTATION_SIGNALS: RegExp[] = [
  // Capability questions - "Does your system provide X?"
  /^does\s+(the|your)\s+\w+\s+(provide|support|have|offer|allow|enable|include)\b/i,
  // Capability questions - "Can X do Y?" (but not "Can you describe...")
  /^can\s+(?!.{0,30}(describe|explain|how\s+(do|would|will))).+\?$/i,
  // Ability questions
  /^is\s+(the|your)\s+\w+\s+(able|capable)\b/i,
  // Existence questions
  /^are\s+there\b/i,
  /^is\s+there\b/i,
  // Compliance questions - "Is X compliant with Y?"
  /\bis\s+(the|your|it)\s+.{0,80}\s+compliant\b/i,
  /\b(does|do)\s+(the|your|it)\s+.{0,60}\s+(comply|meet|conform)\s+(with|to)\b/i,
  // Confirmation patterns
  /\b(confirm that|certify that|acknowledge that|agree to)\b/i,
  /\b(must comply|shall comply|in accordance with)\b/i,
  // Direct compliance questions
  /\b(do you comply|will you comply|can you comply|confirm.*compliance)\b/i,
  // Yes/no capability checks
  /^(does|do|can|will|is|are|has|have)\s+(the|your|it|this)\b.*\?$/i,
];

/**
 * Determine if requirement is an ATTESTATION (simple yes/no compliance).
 * Attestations are questions that can be answered with a simple yes/no or confirmation,
 * rather than requiring a detailed written response.
 */
function classifyAttestation(text: string): boolean {
  const trimmed = text.trim();

  // Written response signals override attestation
  if (WRITTEN_RESPONSE_SIGNALS.some(p => p.test(text))) {
    return false;
  }

  // Short text that starts with capability/compliance patterns is likely attestation
  if (trimmed.length < MAX_ATTESTATION_LENGTH) {
    if (ATTESTATION_SIGNALS.some(p => p.test(text))) {
      return true;
    }
  }

  // Longer text can still be attestation if it has strong attestation signals
  // (e.g., multi-line questions that are still yes/no in nature)
  if (trimmed.length < MAX_EXTENDED_ATTESTATION_LENGTH) {
    // Strong attestation patterns (confirmation/certification)
    if (/\b(confirm that|certify that|acknowledge that|agree to|accept the)\b/i.test(text)) {
      return true;
    }
  }

  // Default: not attestation
  return false;
}

/**
 * Extract word limit from requirement text
 */
function extractWordLimit(text: string): number | null {
  // Patterns: "maximum 2500 words", "max 2,500 words", "2500 word limit", "(2500 words)"
  const patterns = [
    /\b(?:max(?:imum)?|limit)\s*[:\-]?\s*(\d[\d,]*)\s*words?\b/i,
    /\b(\d[\d,]*)\s*words?\s*(?:max(?:imum)?|limit)\b/i,
    /\((\d[\d,]*)\s*words?\)/i,
    /\bword\s*(?:count|limit)\s*[:\-]?\s*(\d[\d,]*)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
  }

  return null;
}

/**
 * Extract character limit from requirement text
 */
function extractCharacterLimit(text: string): number | null {
  // Patterns: "maximum 5000 characters", "5000 char limit"
  const patterns = [
    /\b(?:max(?:imum)?|limit)\s*[:\-]?\s*(\d[\d,]*)\s*(?:char(?:acter)?s?)\b/i,
    /\b(\d[\d,]*)\s*(?:char(?:acter)?s?)\s*(?:max(?:imum)?|limit)\b/i,
    /\((\d[\d,]*)\s*(?:char(?:acter)?s?)\)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
  }

  return null;
}

/**
 * Apply all heuristic classifications to a requirement
 */
function classifyRequirement(text: string): {
  type: RequirementType;
  isMandatory: boolean;
  domainContext: 'FEATURE' | 'PROCESS' | 'LEGAL';
  isAttestation: boolean;
  wordLimit: number | null;
  characterLimit: number | null;
} {
  // Strip section prefix for classification (e.g., "4.3.29 Does the..." -> "Does the...")
  const classificationText = stripSectionPrefix(text);

  return {
    type: classifyType(classificationText),
    isMandatory: classifyMandatory(classificationText),
    domainContext: classifyDomain(classificationText),
    isAttestation: classifyAttestation(classificationText),
    wordLimit: extractWordLimit(text),  // Keep original for limit extraction
    characterLimit: extractCharacterLimit(text),  // Keep original for limit extraction
  };
}

// =============================================================================
// GAP DETECTION AND FILLING
// =============================================================================

/**
 * Detect missing section numbers by comparing PDF content with extracted items.
 * Returns array of missing section numbers like ["3.1.15", "3.1.16", "3.7.19", ...]
 */
function detectMissingItems(documentText: string, extractedSections: Set<string>): string[] {
  // Find all X.Y.Z patterns in document
  const pattern = /\b(\d+\.\d+\.\d+)\b/g;
  const allSections = new Set<string>();
  let match;
  while ((match = pattern.exec(documentText)) !== null) {
    allSections.add(match[1]);
  }

  // Find missing items (no longer skip any sections by number - let extraction decide)
  const missing: string[] = [];
  for (const section of allSections) {
    if (!extractedSections.has(section)) {
      missing.push(section);
    }
  }

  // Sort by section number
  missing.sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  });

  return missing;
}

/**
 * Find the line range in the document where a specific section number appears.
 * Returns {startLine, endLine} or null if not found.
 */
function findSectionLineRange(
  lines: string[],
  sectionNumber: string
): { startLine: number; endLine: number } | null {
  // Escape dots for regex
  const escapedSection = sectionNumber.replace(/\./g, '\\.');
  const pattern = new RegExp(`^\\s*${escapedSection}[\\s.]`);

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      // Found the start, now find where this item ends
      // Look for the next section number or significant gap
      let endLine = i;
      const parts = sectionNumber.split('.');
      const nextPattern = new RegExp(`^\\s*\\d+\\.\\d+(\\.\\d+)?[\\s.]`);

      for (let j = i + 1; j < lines.length && j < i + MAX_LINE_SCAN_RANGE; j++) {
        if (nextPattern.test(lines[j]) && !lines[j].includes(sectionNumber)) {
          break;
        }
        if (lines[j].trim().length > 0) {
          endLine = j;
        }
      }

      return { startLine: i + 1, endLine: endLine + 1 }; // 1-indexed
    }
  }

  return null;
}

function findSectionContext(
  documentText: string,
  lines: string[],
  sectionNumber: string
): { contextLines: string; found: boolean; lineIndex: number | null } {
  const escaped = sectionNumber.replace(/\./g, '\\.');

  // Strategy 1: Find at line start (most reliable - current approach)
  const lineStartPattern = new RegExp(`^\\s*${escaped}[\\s.:]`, 'm');
  let match = lineStartPattern.exec(documentText);

  // Strategy 2: Find anywhere in text (handles unusual PDF formatting)
  if (!match) {
    const anywherePattern = new RegExp(`${escaped}[\\s.:]`);
    match = anywherePattern.exec(documentText);
    if (match) {
      console.log(`[findSectionContext] Found ${sectionNumber} via anywhere search at position ${match.index}`);
    }
  }

  // Strategy 3: Fuzzy match (handles OCR errors like "3.l.5" instead of "3.1.5")
  if (!match) {
    // Build fuzzy pattern that handles common OCR errors
    const fuzzyEscaped = sectionNumber
      .replace(/1/g, '[1lI|]')   // 1 looks like l, I, |
      .replace(/0/g, '[0O]')     // 0 looks like O
      .replace(/\./g, '[.·]');   // dot could be middle dot
    const fuzzyPattern = new RegExp(`\\b${fuzzyEscaped}[\\s.:]`);
    match = fuzzyPattern.exec(documentText);
    if (match) {
      console.log(`[findSectionContext] Found ${sectionNumber} via fuzzy match at position ${match.index}`);
    }
  }

  if (match) {
    // Extract context around the match position
    const start = Math.max(0, match.index - CONTEXT_CHARS_BEFORE);
    const end = Math.min(documentText.length, match.index + CONTEXT_CHARS_AFTER);
    const contextText = documentText.substring(start, end);

    // Find line index by counting newlines in documentText up to match position
    // (lines array may have different structure than documentText due to filtering)
    const textBeforeMatch = documentText.substring(0, match.index);
    const lineIndex = (textBeforeMatch.match(/\n/g) || []).length;

    return { contextLines: contextText, found: true, lineIndex };
  }

  // Fallback: Return context around the X.Y section header
  const subsection = sectionNumber.split('.').slice(0, 2).join('.');
  const subsectionEscaped = subsection.replace(/\./g, '\\.');
  const subsectionPattern = new RegExp(`${subsectionEscaped}[\\s.:]`);
  match = subsectionPattern.exec(documentText);

  if (match) {
    console.log(`[findSectionContext] Falling back to subsection ${subsection} context for ${sectionNumber}`);
    const start = Math.max(0, match.index - 100);
    const end = Math.min(documentText.length, match.index + 2000);
    return { contextLines: documentText.substring(start, end), found: false, lineIndex: null };
  }

  console.log(`[findSectionContext] WARNING: Could not find any context for ${sectionNumber}`);
  return { contextLines: '', found: false, lineIndex: null };
}

// =============================================================================
// PAGE NUMBER AND ARTIFACT CLEANING
// =============================================================================

/**
 * Remove embedded page numbers from requirement text.
 * Patterns: "X of Y", "Page X", standalone numbers at end.
 */
function removeEmbeddedPageNumbers(requirements: ExtractedRequirement[]): void {
  const patterns = [
    /\s*\d{1,3}\s+of\s+\d{1,3}\s*/gi,           // "12 of 38"
    /\s*Page\s+\d+\s*/gi,                        // "Page 12"
    /\s+\d{1,3}\s*$/,                            // Trailing number at end
    /Request for Proposal[:\s].{0,100}$/gi,     // Document header at end (from page breaks)
    /RFP[:\s][^?]{0,80}$/gi,                    // Short form document header at end
  ];

  let cleanCount = 0;
  for (const req of requirements) {
    const originalLength = req.text.length;
    for (const pattern of patterns) {
      req.text = req.text.replace(pattern, ' ');
    }
    req.text = req.text.replace(/\s+/g, ' ').trim();
    if (req.text.length !== originalLength) {
      cleanCount++;
    }
  }

  if (cleanCount > 0) {
    console.log(`[removeEmbeddedPageNumbers] Cleaned page numbers from ${cleanCount} requirements`);
  }
}

/**
 * Remove trailing section headers that got appended to requirement text.
 * Pattern: "...actual content? 3.8 Metadata" → "...actual content?"
 * This catches the common case where LLM extraction grabs the next section header.
 */
function removeTrailingSectionHeaders(requirements: ExtractedRequirement[]): void {
  // Pattern: section number (X.Y or X.YY) followed by title-case words at end of text
  // Must have meaningful content before the header (at least 30 chars)
  const headerPattern = /\s+\d{1,2}\.\d{1,2}\s+[A-Z][A-Za-z,\s&\-]+$/;

  let cleanCount = 0;
  for (const req of requirements) {
    const match = headerPattern.exec(req.text);
    if (match && match.index > 30) {
      // Verify this looks like a section header (not just a reference like "section 3.5")
      const headerText = match[0].trim();
      // Check that what follows the number is title-case (multiple words, capital start)
      const afterNumber = headerText.replace(/^\d+\.\d+\s+/, '');
      if (afterNumber.length > 3 && /^[A-Z]/.test(afterNumber)) {
        const oldLength = req.text.length;
        req.text = req.text.substring(0, match.index).trim();
        cleanCount++;
        console.log(`[removeTrailingSectionHeaders] Removed "${headerText}" from ${req.section} (${oldLength} -> ${req.text.length})`);
      }
    }
  }

  if (cleanCount > 0) {
    console.log(`[removeTrailingSectionHeaders] Cleaned ${cleanCount} requirements`);
  }
}

/**
 * Truncate requirement text at major section breaks embedded in the text.
 * Pattern: "...content. 5.0 Instructions to Respondent..." → "...content."
 * This handles cases where LLM extraction captured entire sections.
 */
function truncateAtMajorSectionBreak(requirements: ExtractedRequirement[]): void {
  // Pattern 1: X.0 followed by title-case words (major section header)
  // Can have document titles or other text between sentence and section
  const majorSectionPattern = /\d{1,2}\.0\s+[A-Z][A-Za-z\s]{5,}/;

  let cleanCount = 0;
  for (const req of requirements) {
    const match = majorSectionPattern.exec(req.text);
    if (match && match.index > 30) {
      // Find the last sentence boundary before the section header
      const textBefore = req.text.substring(0, match.index);
      const lastSentenceEnd = Math.max(
        textBefore.lastIndexOf('.'),
        textBefore.lastIndexOf('?')
      );

      if (lastSentenceEnd > 30) {
        const oldLength = req.text.length;
        req.text = req.text.substring(0, lastSentenceEnd + 1).trim();
        cleanCount++;
        console.log(`[truncateAtMajorSection] Truncated at "${match[0].substring(0, 30)}..." in ${req.section} (${oldLength} -> ${req.text.length})`);
      }
    }
  }

  if (cleanCount > 0) {
    console.log(`[truncateAtMajorSection] Truncated ${cleanCount} requirements`);
  }
}

/**
 * Remove leading number artifacts from requirement text.
 * Pattern: "3 Does the WCMS..." → "Does the WCMS..."
 * These occur when PDF parsing captures list numbers as part of the text.
 */
function removeLeadingNumberArtifacts(requirements: ExtractedRequirement[]): void {
  // Pattern: starts with a single number (1-999) followed by space(s) and capital letter
  // But NOT if it looks like a section number (e.g., "3.1" or "3.1.2")
  const leadingNumberPattern = /^(\d{1,3})\s+/;

  let cleanCount = 0;
  for (const req of requirements) {
    // Skip if text starts with a section number pattern (X.Y)
    if (/^\d{1,3}\.\d/.test(req.text)) {
      continue;
    }

    const match = leadingNumberPattern.exec(req.text);
    if (match) {
      // Remove the leading number and whitespace
      req.text = req.text.substring(match[0].length);
      cleanCount++;
      console.log(`[removeLeadingNumbers] Cleaned "${match[0]}" from ${req.section}`);
    }
  }

  if (cleanCount > 0) {
    console.log(`[removeLeadingNumbers] Cleaned ${cleanCount} requirements`);
  }
}

/**
 * Filter out sitemap dumps, appendices, and other non-requirement content.
 * These are typically very long blocks of text that are reference materials.
 */
function filterNonRequirementContent(requirements: ExtractedRequirement[]): ExtractedRequirement[] {
  const MAX_REQUIREMENT_LENGTH = 2000; // Real requirements rarely exceed this

  // Patterns that indicate non-requirement content
  const SITEMAP_INDICATORS = [
    /sitemap/i,
    /https?:\/\/\S+.*https?:\/\/\S+/s,  // Multiple URLs
    /\bPage\s+\d+\s+of\s+\d+\b.*\bPage\s+\d+\s+of\s+\d+\b/is,  // Multiple page references
    /•\s*\S+.*•\s*\S+.*•\s*\S+/s,  // Multiple bullet points (•)
    /o\s+\S+.*o\s+\S+.*o\s+\S+/s,  // Multiple sub-bullets (o)
    /Attachments/i,  // Attachment section
    /Website Examples/i,  // Reference section
    /\(pdf\).*\(pdf\)/is,  // Multiple PDF references
  ];

  const filtered = requirements.filter(req => {
    // Filter out requirements with null/undefined sections (orphaned content)
    if (!req.section) {
      console.log(`[filterNonRequirement] Removed requirement with null section: "${req.text.substring(0, 50)}..."`);
      return false;
    }

    // Check length - very long requirements are suspicious
    if (req.text.length > MAX_REQUIREMENT_LENGTH) {
      // Check for sitemap/appendix indicators
      for (const pattern of SITEMAP_INDICATORS) {
        if (pattern.test(req.text)) {
          console.log(`[filterNonRequirement] Removed appendix/reference content from ${req.section} (${req.text.length} chars, matched ${pattern.source.substring(0, 20)}...)`);
          return false;
        }
      }

      // Additional heuristic: if it has 10+ question marks or 5+ URLs, it's likely not a single requirement
      const questionCount = (req.text.match(/\?/g) || []).length;
      const urlCount = (req.text.match(/https?:\/\//g) || []).length;

      if (questionCount > 10 || urlCount >= 5) {
        console.log(`[filterNonRequirement] Removed multi-question/URL content from ${req.section} (${req.text.length} chars, ${questionCount} questions, ${urlCount} URLs)`);
        return false;
      }

      // Still too long but no indicators - might be a long requirement, keep but warn
      console.warn(`[filterNonRequirement] WARNING: Very long requirement ${req.section} (${req.text.length} chars) - keeping`);
    }
    return true;
  });

  const removedCount = requirements.length - filtered.length;
  if (removedCount > 0) {
    console.log(`[filterNonRequirement] Filtered ${removedCount} non-requirement items`);
  }

  return filtered;
}

/**
 * Split merged requirements that contain multiple questions.
 * Looks for patterns like "Question 1? Question 2?" and splits them.
 */
function splitMergedQuestions(requirements: ExtractedRequirement[]): ExtractedRequirement[] {
  const result: ExtractedRequirement[] = [];

  for (const req of requirements) {
    // Count question marks to detect merged questions
    const questionMarks = (req.text.match(/\?/g) || []).length;

    // If 3+ questions and text is long, try to split
    if (questionMarks >= 3 && req.text.length > 200) {
      // Split on question mark followed by capital letter (new sentence)
      const parts = req.text.split(/\?\s+(?=[A-Z])/);

      if (parts.length >= 3) {
        console.log(`[splitMergedQuestions] Splitting ${req.section} into ${parts.length} parts`);

        // Create separate requirements for each part
        parts.forEach((part, idx) => {
          const newText = part.trim() + (part.endsWith('?') ? '' : '?');
          if (newText.length > 10) {  // Skip tiny fragments
            const newSection = idx === 0 ? req.section : `${req.section}.${String.fromCharCode(97 + idx - 1)}`;
            result.push({
              ...req,
              section: newSection,
              text: newText,
              // Re-classify since it's now a single question
              type: classifyType(newText),
              isAttestation: classifyAttestation(newText),
            });
          }
        });
        continue;
      }
    }

    // No split needed, keep original
    result.push(req);
  }

  const addedCount = result.length - requirements.length;
  if (addedCount > 0) {
    console.log(`[splitMergedQuestions] Added ${addedCount} requirements from splits`);
  }

  return result;
}

// =============================================================================
// LLM VALIDATION PASS
// =============================================================================

interface ValidationFix {
  index: number;
  action: 'ok' | 'truncated' | 'fragment' | 'removePageNumber' | 'header' | 'fixType' | 'truncateAt' | 'split';
  missingText?: string;
  mergeWith?: number;
  pattern?: string;
  newType?: RequirementType;
  truncateAfter?: string;
  splitPoints?: string[];
}

interface ValidationResult {
  fixes: ValidationFix[];
}

/**
 * Run LLM validation pass to fix quality issues.
 * This is the second (and final) LLM call for extraction.
 */
async function validateAndFixRequirements(
  openai: OpenAI,
  model: string,
  requirements: ExtractedRequirement[],
  documentText: string
): Promise<void> {
  if (requirements.length === 0) return;

  console.log(`[validation] Starting validation pass for ${requirements.length} requirements`);
  const startTime = Date.now();

  // Build validation payload with context for each requirement
  const payload = requirements.slice(0, 100).map((req, idx) => {
    // Find surrounding context in document
    let context = '';
    if (req.text.length > 20) {
      const searchText = req.text.substring(0, Math.min(50, req.text.length));
      const pos = documentText.indexOf(searchText);
      if (pos !== -1) {
        const start = Math.max(0, pos - 100);
        const end = Math.min(documentText.length, pos + req.text.length + 200);
        context = documentText.substring(start, end);
      }
    }

    return {
      index: idx,
      section: req.section,
      text: req.text.substring(0, 500),  // Truncate for prompt size
      type: req.type,
      context: context.substring(0, 300),  // Limited context
    };
  });

  try {
    const response = await openai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: VALIDATION_PROMPT },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 8192,
      },
      { timeout: LLM_TIMEOUT_MS }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn('[validation] Empty response from LLM');
      return;
    }

    const result = JSON.parse(content) as ValidationResult;
    const elapsed = Date.now() - startTime;
    console.log(`[validation] LLM returned ${result.fixes?.length || 0} fixes in ${elapsed}ms`);

    // Apply fixes
    let fixedCount = 0;
    let mergedCount = 0;
    let headerCount = 0;
    let typeFixCount = 0;

    const toRemove = new Set<number>();

    for (const fix of (result.fixes || [])) {
      if (fix.index < 0 || fix.index >= requirements.length) continue;
      const req = requirements[fix.index];

      switch (fix.action) {
        case 'truncated':
          if (fix.missingText) {
            req.text = req.text + ' ' + fix.missingText;
            fixedCount++;
            console.log(`[validation] Fixed truncation in ${req.section}`);
          }
          break;

        case 'fragment':
          if (typeof fix.mergeWith === 'number' && fix.mergeWith >= 0 && fix.mergeWith < requirements.length) {
            const target = requirements[fix.mergeWith];
            target.text = target.text + ' ' + req.text;
            toRemove.add(fix.index);
            mergedCount++;
            console.log(`[validation] Merged fragment ${req.section} into ${target.section}`);
          }
          break;

        case 'removePageNumber':
          if (fix.pattern) {
            req.text = req.text.replace(new RegExp(fix.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ').trim();
            fixedCount++;
          }
          break;

        case 'header':
          req.type = 'CONTEXTUAL';
          headerCount++;
          console.log(`[validation] Reclassified ${req.section} as header`);
          break;

        case 'fixType':
          if (fix.newType && validateRequirementType(fix.newType) !== 'DESCRIPTIVE') {
            req.type = fix.newType;
            typeFixCount++;
            console.log(`[validation] Fixed type for ${req.section}: ${req.type} -> ${fix.newType}`);
          }
          break;

        case 'truncateAt':
          // Cross-section contamination - truncate at the specified point
          if (fix.truncateAfter && typeof fix.truncateAfter === 'string') {
            const truncateIdx = req.text.indexOf(fix.truncateAfter);
            if (truncateIdx > 0) {
              const newText = req.text.substring(0, truncateIdx + fix.truncateAfter.length).trim();
              console.log(`[validation] Truncated ${req.section} from ${req.text.length} to ${newText.length} chars (cross-section)`);
              req.text = newText;
              fixedCount++;
            }
          }
          break;

        case 'split':
          // Multiple requirements merged - split based on split points
          if (fix.splitPoints && Array.isArray(fix.splitPoints) && fix.splitPoints.length > 0) {
            const originalText = req.text;
            let lastEndIdx = 0;
            const splitTexts: string[] = [];

            for (const splitPoint of fix.splitPoints) {
              if (typeof splitPoint !== 'string') continue;
              const splitIdx = originalText.indexOf(splitPoint, lastEndIdx);
              if (splitIdx > lastEndIdx) {
                const textChunk = originalText.substring(lastEndIdx, splitIdx + splitPoint.length).trim();
                if (textChunk.length > 10) {
                  splitTexts.push(textChunk);
                  lastEndIdx = splitIdx + splitPoint.length;
                }
              }
            }

            // Add remaining text if any
            const remainder = originalText.substring(lastEndIdx).trim();
            if (remainder.length > 10) {
              splitTexts.push(remainder);
            }

            // Only proceed if we actually split into multiple parts
            if (splitTexts.length > 1) {
              console.log(`[validation] Splitting ${req.section} into ${splitTexts.length} parts`);
              // Keep first part in current requirement
              req.text = splitTexts[0];
              // Note: Additional parts would need to be added to requirements array
              // For now, just log that we detected a split opportunity
              fixedCount++;
            }
          }
          break;
      }
    }

    // Remove merged fragments (in reverse order to preserve indices)
    const sortedRemove = Array.from(toRemove).sort((a, b) => b - a);
    for (const idx of sortedRemove) {
      requirements.splice(idx, 1);
    }

    console.log(`[validation] Applied fixes: ${fixedCount} truncations, ${mergedCount} merges, ${headerCount} headers, ${typeFixCount} type fixes`);

  } catch (error) {
    console.error('[validation] Validation pass failed:', error);
    // Non-fatal - continue with unvalidated requirements
  }
}

// =============================================================================
// FIX COMPOUND QUESTION TYPES
// =============================================================================

/**
 * Fix type classification for compound questions.
 * Questions with multiple "?" or follow-up explanations should be DESCRIPTIVE, not DECLARATIVE.
 */
function fixCompoundQuestionTypes(requirements: ExtractedRequirement[]): void {
  let fixCount = 0;

  for (const req of requirements) {
    if (req.type !== 'DECLARATIVE') continue;

    // Count question marks
    const questionMarks = (req.text.match(/\?/g) || []).length;

    // Check for follow-up patterns that require explanation
    const hasFollowUp = /\?\s*(If so|Please|Describe|Explain|How|What|Which|Why)/i.test(req.text);
    const hasMultipleParts = /\?\s*[A-Z]/.test(req.text);  // Question followed by new sentence

    if (questionMarks >= 2 || hasFollowUp || hasMultipleParts) {
      req.type = 'DESCRIPTIVE';
      fixCount++;
      console.log(`[fixCompoundTypes] ${req.section}: DECLARATIVE -> DESCRIPTIVE (${questionMarks} questions)`);
    }
  }

  if (fixCount > 0) {
    console.log(`[fixCompoundTypes] Fixed ${fixCount} compound question types`);
  }
}

/**
 * Extract specific missing items by doing targeted LLM calls.
 * Groups nearby missing items together for efficiency.
 */
async function extractMissingItemsTargeted(
  openai: OpenAI,
  model: string,
  lines: string[],
  documentText: string,
  missingItems: string[],
  majorSections: Map<string, { number: string; title: string }>
): Promise<{ requirements: ExtractedRequirement[]; stillMissing: string[] }> {
  if (missingItems.length === 0) return { requirements: [], stillMissing: [] };

  console.log(`[gap-fill] Attempting to extract ${missingItems.length} missing items`);

  const results: ExtractedRequirement[] = [];

  // Group missing items by their X.Y prefix for batch processing
  const bySubsection = new Map<string, string[]>();
  for (const item of missingItems) {
    const parts = item.split('.');
    const key = `${parts[0]}.${parts[1]}`;
    if (!bySubsection.has(key)) bySubsection.set(key, []);
    bySubsection.get(key)!.push(item);
  }

  // For each group, find the line range and extract
  for (const [subsection, items] of bySubsection) {
    // Find the first and last item in this group
    const firstItem = items[0];
    const lastItem = items[items.length - 1];

    // Find line ranges - try line-based first, fall back to text-based context
    const firstRange = findSectionLineRange(lines, firstItem);
    // Only compute lastRange if firstRange succeeded (avoid wasted work)
    const lastRange = firstRange ? findSectionLineRange(lines, lastItem) : null;
    let contextLines: string;
    let usingTextContext = false;

    if (firstRange) {
      // Line-based detection worked - use line ranges
      const contextStart = Math.max(0, firstRange.startLine - 3);
      const contextEnd = lastRange
        ? Math.min(lines.length, lastRange.endLine + 3)
        : Math.min(lines.length, firstRange.endLine + 20);

      contextLines = lines
        .slice(contextStart, contextEnd)
        .map((line, idx) => `L${contextStart + idx + 1}: ${line}`)
        .join('\n');

      console.log(`[gap-fill] Extracting ${items.length} items from ${subsection} (lines ${contextStart + 1}-${contextEnd})`);
    } else {
      // FALLBACK: Use text-based context search
      console.log(`[gap-fill] Line detection failed for ${firstItem}, trying text-based context search`);

      const firstContext = findSectionContext(documentText, lines, firstItem);
      const lastContext = items.length > 1 ? findSectionContext(documentText, lines, lastItem) : null;

      if (!firstContext.contextLines) {
        console.log(`[gap-fill] Could not find any context for ${firstItem}`);
        continue;
      }

      usingTextContext = true;

      // For text-based context, we don't have line numbers - use raw text context
      // Combine first and last context if different
      if (lastContext && lastContext.contextLines && lastContext.contextLines !== firstContext.contextLines) {
        // Use a broader context that includes both
        contextLines = `...${firstContext.contextLines}...\n...\n...${lastContext.contextLines}...`;
      } else {
        contextLines = firstContext.contextLines;
      }

      console.log(`[gap-fill] Using text-based context for ${subsection} (${contextLines.length} chars)`);
    }

    // Build targeted prompt - semantic-first extraction for missing items
    let targetedPrompt: string;
    if (usingTextContext) {
      targetedPrompt = `Find requirements in this text that match section numbers: ${items.join(', ')}

LOOK FOR CONTENT PATTERNS near those section numbers:
1. Questions ending with "?"
2. Imperatives: "Describe...", "Explain...", "Provide...", "List..."
3. Obligations: "shall", "must", "will", "should"
4. Capability questions: "Does the...", "Can the...", "How will..."

RULES:
1. ONE requirement per section
2. End at sentence boundaries (. or ?)
3. Maximum: 3 sentences per requirement
4. Copy text VERBATIM
5. Skip section titles - extract the actual question/request

SECTIONS NEEDED: ${items.join(', ')}

OUTPUT JSON: {"items":[{"section":"X","text":"the question or requirement"}]}

TEXT:
${contextLines}`;
    } else {
      targetedPrompt = `Find requirements in this text that match section numbers: ${items.join(', ')}

LOOK FOR CONTENT PATTERNS near those section numbers:
1. Questions ending with "?"
2. Imperatives: "Describe...", "Explain...", "Provide...", "List..."
3. Obligations: "shall", "must", "will", "should"
4. Capability questions: "Does the...", "Can the...", "How will..."

RULES:
1. ONE requirement per section
2. End at sentence boundaries (. or ?)
3. Maximum: 5 lines per requirement
4. Copy text VERBATIM

SECTIONS NEEDED: ${items.join(', ')}

OUTPUT JSON: {"r":[[startLine,endLine,"section"],...]}

TEXT:
${contextLines}`;
    }

    try {
      const response = await openai.chat.completions.create(
        {
          model,
          messages: [
            {
              role: 'system',
              content: 'You extract specific requirements by line number. Return ONLY the JSON with line references for the requested items.',
            },
            { role: 'user', content: targetedPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 2000,
        },
        { timeout: LLM_TIMEOUT_MS }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(content) as {
        r?: Array<[number, number, string]>;
        items?: Array<{ section: string; text: string }>;
      };

      // Handle line-based format
      if (parsed.r && Array.isArray(parsed.r)) {
        console.log(`[gap-fill] Found ${parsed.r.length} items for ${subsection} (line-based)`);

        for (const [startLine, endLine, llmSection] of parsed.r) {
          let text = extractTextFromLines(lines, startLine, endLine);
          if (!text) continue;

          // Detect actual section from text BEFORE stripping prefix
          // Only use detected section if plausible (same major number or LLM gave none)
          const detectedSection = detectSectionFromText(text);
          let section: string | null = llmSection;
          if (detectedSection) {
            if (!llmSection) {
              section = detectedSection;
            } else {
              const detectedMajor = detectedSection.split('.')[0];
              const llmMajor = llmSection.split('.')[0];
              if (detectedMajor === llmMajor) {
                section = detectedSection;
                if (detectedSection !== llmSection) {
                  console.log(`[gap-fill] Corrected section ${llmSection} -> ${detectedSection}`);
                }
              }
            }
          }

          // Validate section format - reject garbage
          if (section && !isValidSection(section)) {
            console.log(`[gap-fill] Rejected invalid section: "${section}"`);
            section = null;
          }

          // Strip section prefix after detection
          text = stripSectionPrefix(text);

          const classification = classifyRequirement(text);
          let sectionGroup: string | null = null;
          if (section) {
            const majorMatch = section.match(/^(\d+|[A-Z]|[IVXLC]+)/i);
            if (majorMatch) {
              const majorNum = majorMatch[1].toUpperCase();
              const majorSection = majorSections.get(majorNum);
              if (majorSection) {
                sectionGroup = `${majorSection.number}: ${majorSection.title}`;
              }
            }
          }

          results.push({
            section: section || null,
            sectionGroup,
            text,
            type: classification.type,
            isMandatory: classification.isMandatory,
            domainContext: classification.domainContext,
            wordLimit: classification.wordLimit,
            characterLimit: classification.characterLimit,
            isAttestation: classification.isAttestation,
          });
        }
      }
      // Handle text-based format (from context search fallback)
      else if (parsed.items && Array.isArray(parsed.items)) {
        console.log(`[gap-fill] Found ${parsed.items.length} items for ${subsection} (text-based)`);

        for (const item of parsed.items) {
          const text = item.text?.trim();
          const section = item.section?.trim();
          if (!text) continue;

          const classification = classifyRequirement(text);
          let sectionGroup: string | null = null;
          if (section) {
            const majorMatch = section.match(/^(\d+|[A-Z]|[IVXLC]+)/i);
            if (majorMatch) {
              const majorNum = majorMatch[1].toUpperCase();
              const majorSection = majorSections.get(majorNum);
              if (majorSection) {
                sectionGroup = `${majorSection.number}: ${majorSection.title}`;
              }
            }
          }

          results.push({
            section: section || null,
            sectionGroup,
            text,
            type: classification.type,
            isMandatory: classification.isMandatory,
            domainContext: classification.domainContext,
            wordLimit: classification.wordLimit,
            characterLimit: classification.characterLimit,
            isAttestation: classification.isAttestation,
          });
        }
      }
    } catch (err) {
      console.error(`[gap-fill] Error extracting ${subsection}:`, err);
    }
  }

  // VALIDATION: Check which items are still missing after gap-fill
  const recoveredSections = new Set(results.map(r => r.section).filter(Boolean));
  const stillMissing = missingItems.filter(item => !recoveredSections.has(item));

  if (stillMissing.length > 0) {
    console.warn(`[gap-fill] WARNING: ${stillMissing.length} items still not found after gap-fill: ${stillMissing.slice(0, 10).join(', ')}${stillMissing.length > 10 ? '...' : ''}`);
  }

  console.log(`[gap-fill] Total recovered: ${results.length} requirements`);
  return { requirements: results, stillMissing };
}

// =============================================================================
// EXTRACTION FUNCTION
// =============================================================================

export async function extractRequirements(
  documentText: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const model = options.model || 'gpt-4o-mini';
  const startTime = Date.now();

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  console.log(`[extract] Starting extraction with model ${model}`);
  console.log(`[extract] Document length: ${documentText.length} chars`);

  // Early return for empty or very short documents
  if (!documentText || documentText.trim().length < MIN_DOCUMENT_LENGTH) {
    console.warn('[extract] Document too short for meaningful extraction');
    return {
      deadline: null,
      deadlineText: null,
      requirements: [],
      warnings: ['Document too short for meaningful extraction'],
    };
  }

  // Add line numbers to document for reference-based extraction
  const { numberedText, lines } = addLineNumbers(documentText);
  console.log(`[extract] Document has ${lines.length} lines`);

  try {
    // Detect document sections to help LLM know what to expect
    const sectionSummary = detectDocumentSections(documentText);
    console.log(`[extract] Document sections detected: ${sectionSummary || 'none'}`);

    // Detect major section headers for sectionGroup population
    const majorSections = detectMajorSections(documentText);
    console.log(`[extract] Major sections detected: ${majorSections.size} sections`);

    // Build user message with line-numbered document
    // Include section summary to ensure complete extraction
    let userMessage = `Please extract all requirements and questions from this RFP document. Use line numbers (L1, L2, etc.) to reference where each requirement is located.`;

    if (sectionSummary) {
      userMessage += `\n\nIMPORTANT - DOCUMENT SECTIONS TO EXTRACT:\n${sectionSummary}`;
      userMessage += `\n\nYou MUST extract requirements from ALL of these sections. Do NOT stop early.`;
      userMessage += `\nIf you're unsure whether something is a new section, treat it as one and stop the previous requirement's line range.`;
      userMessage += `\nPay attention to the section formats listed above - some documents mix X.Y.Z with X.Y or A.X formats.\n\n`;
    }

    userMessage += `\n\n${numberedText}`;

    const response = await openai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 16384, // Max for gpt-4o-mini
      },
      { timeout: LLM_TIMEOUT_MS }
    );

    const content = response.choices[0]?.message?.content;
    const finishReason = response.choices[0]?.finish_reason;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Check for truncation
    if (finishReason === 'length') {
      console.warn('[extract] WARNING: Response may have been truncated');
    }

    const rawResult = JSON.parse(content) as CompactResult;
    const elapsed = Date.now() - startTime;

    console.log(`[extract] Raw extraction: ${rawResult.r?.length || 0} requirements in ${elapsed}ms`);
    console.log(`[extract] Tokens used: ${response.usage?.total_tokens || 'unknown'}`);
    console.log(`[extract] Output tokens: ${response.usage?.completion_tokens || 'unknown'}`);

    // Convert compact array format to full requirements
    // Format: [startLine, endLine, section] - sectionGroup derived from majorSections
    // Classification is done via heuristics in post-processing
    let requirements: ExtractedRequirement[] = (rawResult.r || []).map((arr, idx) => {
      const [startLine, endLine, llmSection] = arr;

      let text = extractTextFromLines(lines, startLine, endLine);

      if (!text && startLine && endLine) {
        console.warn(`[extract] Empty text for requirement ${idx}: lines ${startLine}-${endLine}`);
      }

      // CRITICAL: Detect actual section from text BEFORE stripping prefix
      // The LLM sometimes returns wrong section numbers for multi-line requirements
      // But only use detected section if it's plausible (same major number or LLM gave none)
      const detectedSection = detectSectionFromText(text);
      let section = llmSection;
      if (detectedSection) {
        if (!llmSection) {
          // LLM gave no section, use detected
          section = detectedSection;
        } else {
          // Only override if same major section (prevents "6.1.5" -> "1.0" mutation)
          const detectedMajor = detectedSection.split('.')[0];
          const llmMajor = llmSection.split('.')[0];
          if (detectedMajor === llmMajor) {
            section = detectedSection;
            if (detectedSection !== llmSection) {
              console.log(`[extract] Corrected section ${llmSection} -> ${detectedSection}`);
            }
          }
        }
      }

      // Validate section format - reject garbage like "Reporting and Analytics"
      if (section && !isValidSection(section)) {
        console.log(`[extract] Rejected invalid section: "${section}"`);
        section = null;
      }

      // Strip section prefix from extracted text (e.g., "4.3.29 Does the..." -> "Does the...")
      // Must happen AFTER section detection
      if (text) {
        text = stripSectionPrefix(text);
      }

      // Apply heuristic classification based on extracted text
      const classification = classifyRequirement(text);

      // Derive sectionGroup from major sections map
      // Extract major section number from section (e.g., "3.1.2" -> "3", "A.2.1" -> "A")
      let sectionGroup: string | null = null;
      if (section) {
        const majorMatch = section.match(/^(\d+|[A-Z]|[IVXLC]+)/i);
        if (majorMatch) {
          const majorNum = majorMatch[1].toUpperCase();
          const majorSection = majorSections.get(majorNum);
          if (majorSection) {
            sectionGroup = `${majorSection.number}: ${majorSection.title}`;
          } else {
            // Fallback: just use the major number
            sectionGroup = majorNum;
          }
        }
      }

      return {
        section: section || null,
        sectionGroup,
        text,
        type: classification.type,
        isMandatory: classification.isMandatory,
        domainContext: classification.domainContext,
        wordLimit: classification.wordLimit,
        characterLimit: classification.characterLimit,
        isAttestation: classification.isAttestation,
      };
    });

    // Filter out any empty requirements (bad line references)
    const beforeFilter = requirements.length;
    requirements = requirements.filter(req => req.text.length > 0);
    const emptyCount = beforeFilter - requirements.length;
    if (emptyCount > 0) {
      console.log(`[extract] Filtered ${emptyCount} empty requirements from bad line refs`);
      // Warn if high empty rate indicates systematic line mapping issues
      if (emptyCount > requirements.length * 0.1) {
        console.warn(`[extract] WARNING: High empty rate (${emptyCount}/${beforeFilter}) - possible line mapping issue`);
      }
    }

    // ==========================================================================
    // POST-PROCESSING PIPELINE (from main app)
    // ==========================================================================

    console.log('[extract] Applying post-processing pipeline...');

    // Step 1: Remove embedded page numbers (e.g., "12 of 38", "Page 5")
    removeEmbeddedPageNumbers(requirements);

    // Step 1b: Remove trailing section headers (e.g., "...content? 3.8 Metadata")
    removeTrailingSectionHeaders(requirements);

    // Step 1c: Truncate at major section breaks (e.g., "...content. 5.0 Instructions...")
    truncateAtMajorSectionBreak(requirements);

    // Step 2: Validate types and apply heuristic corrections
    requirements = requirements.map(req => ({
      ...req,
      type: correctQuantitativeType(req.text, validateRequirementType(req.type)),
    }));

    // Step 5: Split concatenated requirements
    requirements = splitConcatenatedRequirementsPostProcess(requirements);

    // Step 6: Remove leading number artifacts ("3 Does..." → "Does...")
    removeLeadingNumberArtifacts(requirements);

    // Step 7: Deduplicate requirements (removes exact and near-duplicates)
    requirements = deduplicateRequirements(requirements);

    // Step 8: Reclassify section headers
    reclassifySectionHeaders(requirements);

    // Step 9: Fix compound question types (DECLARATIVE with multiple "?" → DESCRIPTIVE)
    fixCompoundQuestionTypes(requirements);

    // Step 10: Split merged questions (3+ questions in one requirement)
    requirements = splitMergedQuestions(requirements);

    // Step 11: Filter out sitemap dumps and appendix content
    requirements = filterNonRequirementContent(requirements);

    // Step 12: Enrich section data
    enrichSectionData(requirements, documentText);

    // Step 13: Final deduplication after all transformations
    requirements = deduplicateRequirements(requirements);

    console.log(`[extract] Post-processing complete: ${requirements.length} requirements`);

    // ==========================================================================
    // LLM VALIDATION PASS (Second and final LLM call)
    // ==========================================================================

    console.log('[extract] Running LLM validation pass...');
    await validateAndFixRequirements(openai, model, requirements, documentText);
    console.log(`[extract] After validation: ${requirements.length} requirements`);

    // ==========================================================================
    // GAP DETECTION AND FILLING
    // ==========================================================================

    // Build set of extracted section numbers (X.Y.Z format)
    const extractedSectionNumbers = new Set<string>();
    for (const req of requirements) {
      if (req.section) {
        extractedSectionNumbers.add(req.section);
      }
    }

    // Detect missing items
    const missingItems = detectMissingItems(documentText, extractedSectionNumbers);

    // Validate section coverage
    const warnings: string[] = [];

    if (missingItems.length > 0) {
      console.log(`[extract] Detected ${missingItems.length} potentially missing items: ${missingItems.slice(0, 10).join(', ')}${missingItems.length > 10 ? '...' : ''}`);

      // Attempt targeted extraction for missing items
      const { requirements: recoveredRequirements, stillMissing } = await extractMissingItemsTargeted(
        openai,
        model,
        lines,
        documentText,
        missingItems,
        majorSections
      );

      if (recoveredRequirements.length > 0) {
        console.log(`[extract] Recovered ${recoveredRequirements.length} missing requirements`);

        // Add recovered requirements, avoiding duplicates
        for (const recovered of recoveredRequirements) {
          // Check if we already have this section
          const isDuplicate = requirements.some(
            r => r.section === recovered.section && r.text === recovered.text
          );
          if (!isDuplicate) {
            requirements.push(recovered);
          }
        }

        // Re-run deduplication after adding recovered items
        requirements = deduplicateRequirements(requirements);

        // Clean up recovered requirements (they didn't go through post-processing)
        console.log('[gap-fill] Cleaning up recovered requirements...');
        removeLeadingNumberArtifacts(requirements);
        removeEmbeddedPageNumbers(requirements);
        removeTrailingSectionHeaders(requirements);
        truncateAtMajorSectionBreak(requirements);
      }

      // Log any items that couldn't be recovered (no format-specific fallback)
      if (stillMissing.length > 0) {
        console.log(`[extract] ${stillMissing.length} items could not be recovered by LLM gap-fill: ${stillMissing.slice(0, 10).join(', ')}${stillMissing.length > 10 ? '...' : ''}`);
        warnings.push(`Could not extract ${stillMissing.length} items: ${stillMissing.slice(0, 5).join(', ')}${stillMissing.length > 5 ? '...' : ''}`);
      }
    }
    const extractedSections = new Map<string, number>();
    for (const req of requirements) {
      if (req.section) {
        // Extract the X.Y part from X.Y.Z
        const match = req.section.match(/^(\d+\.\d+)/);
        if (match) {
          const key = match[1];
          extractedSections.set(key, (extractedSections.get(key) || 0) + 1);
        }
      }
    }

    // Check for potentially missing sections by comparing with detected structure
    const expectedPattern = /\b(\d+)\.(\d+)\.(\d+)\b/g;
    const expectedSections = new Map<string, number>();
    let expMatch;
    while ((expMatch = expectedPattern.exec(documentText)) !== null) {
      const key = `${expMatch[1]}.${expMatch[2]}`;
      expectedSections.set(key, (expectedSections.get(key) || 0) + 1);
    }

    // Find sections with significant gaps (only report if still missing after gap fill)
    for (const [section, expectedCount] of expectedSections) {
      const actualCount = extractedSections.get(section) || 0;
      if (actualCount < expectedCount * 0.5) { // Less than 50% extracted
        warnings.push(`Section ${section}: extracted ${actualCount} of ~${expectedCount} expected items`);
      }
    }

    if (warnings.length > 0) {
      console.warn('[extract] COVERAGE WARNINGS:');
      warnings.forEach(w => console.warn(`  - ${w}`));
    }

    console.log(`[extract] Final count: ${requirements.length} requirements from ${extractedSections.size} subsections`);

    // Sort requirements by section number for proper ordering
    requirements.sort(sortBySection);
    console.log(`[extract] Sorted requirements by section number`);

    return {
      deadline: rawResult.d || null,
      deadlineText: rawResult.dt || null,
      requirements,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    console.error(`[extract] Failed after ${elapsed}ms:`, error);
    throw error;
  }
}
