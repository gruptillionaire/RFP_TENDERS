# Full-Context Scoped-Output Extraction

## Problem Statement

Large RFPs (300+ requirements) cannot be extracted accurately with current approaches:

| Approach | Problem |
|----------|---------|
| **Single-pass** | Output limit (16K tokens) truncates results |
| **One-by-one classification** | LLM sees isolated sentences, loses context, classifies everything as DESCRIPTIVE |

## Solution: Full Context, Scoped Output

Send the **full document** to the LLM every time (preserving context), but ask it to extract only a **subset of sections** per call (fitting within output limits).

```
┌─────────────────────────────────────────────────────┐
│              FULL DOCUMENT (75K tokens)             │
│                                                     │
│  Section 3: Direct Query Questions (271 reqs)       │
│  Section 4: Technical Questions (107 reqs)          │
│  Section 5: Pricing (3 reqs)                        │
│  Section 6: References (3 reqs)                     │
└─────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   "Extract        "Extract         "Extract
    3.1-3.5"       3.6-3.10"        3.11-3.15" ...
        │                │                │
        ▼                ▼                ▼
   ~50 reqs         ~50 reqs         ~50 reqs
   (fits 16K)       (fits 16K)       (fits 16K)
        │                │                │
        └────────────────┴────────────────┘
                         │
                         ▼
                  Merge + Deduplicate
                         │
                         ▼
                   384 requirements
                   (full quality)
```

## Why This Works

| Aspect | Benefit |
|--------|---------|
| **Context** | LLM sees entire document - knows it's a WCMS RFP, understands section purposes |
| **Classification** | Can recognize "Does..." questions as DECLARATIVE because it sees the pattern across the section |
| **Mandatory detection** | Can see section headers indicating optional vs required |
| **Output size** | Each chunk outputs ~50 requirements = ~8K tokens, well under 16K limit |

## Token Economics

| Approach | API Calls | Input Tokens | Output Tokens | Total |
|----------|-----------|--------------|---------------|-------|
| One-by-one (current) | 384 | 384 × 4K = 1.5M | 384 × 0.5K = 192K | **~1.7M** |
| Full-context scoped | 7 | 7 × 75K = 525K | 7 × 8K = 56K | **~580K** |

**3x more efficient AND better quality.**

---

## Implementation

### New Functions

#### 1. `planExtractionChunks(candidates, targetSize)`

Groups heuristic candidates into chunks of ~55 requirements:

```typescript
interface ExtractionChunk {
  startSection: string;   // "3.1"
  endSection: string;     // "3.5"
  expectedCount: number;  // 52
  sections: string[];     // ["3.1", "3.2", "3.3", "3.4", "3.5"]
}

function planExtractionChunks(
  candidates: RequirementCandidate[],
  targetSize: number = 55
): ExtractionChunk[]
```

**Logic:**
1. Sort candidates by section number
2. Walk through, grouping by subsection (3.1, 3.2, etc.)
3. When accumulated count reaches targetSize, start new chunk
4. Handle edge cases (very large single subsections)

#### 2. `createScopedPrompt(chunk)`

Creates extraction prompt with scope instruction:

```typescript
function createScopedPrompt(chunk: ExtractionChunk): string {
  return EXTRACTION_PROMPT + `

═══════════════════════════════════════════════════════════════════════════════
                            EXTRACTION SCOPE
═══════════════════════════════════════════════════════════════════════════════

For this extraction pass, extract ONLY requirements from sections ${chunk.startSection} through ${chunk.endSection}.

INCLUDE: All subsections within this range
  - ${chunk.startSection}, ${chunk.startSection}.1, ${chunk.startSection}.2, ...
  - ... through ${chunk.endSection}, ${chunk.endSection}.1, ${chunk.endSection}.2, ...

SKIP: All sections outside this range (they will be extracted in separate passes)

The full document is provided so you understand the context, but ONLY output
requirements whose section numbers fall within ${chunk.startSection} to ${chunk.endSection}.
`;
}
```

#### 3. `extractSectionRange(fullDocument, chunk, majorSections)`

Makes one LLM call to extract a chunk:

```typescript
async function extractSectionRange(
  fullDocument: string,
  chunk: ExtractionChunk,
  majorSections: Map<string, MajorSection>
): Promise<ExtractedRequirement[]>
```

**Process:**
1. Create scoped prompt
2. Call LLM with full document
3. Parse response
4. Validate output (check for truncation)
5. Return requirements array

#### 4. `extractRequirementsFullContext(sanitizedText)`

Main orchestrator:

```typescript
async function extractRequirementsFullContext(
  sanitizedText: string
): Promise<ExtractionResult> {
  // Step 1: Heuristic scan (find all section numbers)
  const heuristicResult = extractCandidatesHeuristically(sanitizedText);

  // Step 2: Plan chunks (~55 requirements each)
  const chunks = planExtractionChunks(heuristicResult.candidates, 55);

  // Step 3: Extract each chunk (3 concurrent max)
  const results = await extractChunksWithConcurrency(
    sanitizedText,
    chunks,
    heuristicResult.majorSections,
    { concurrency: 3 }
  );

  // Step 4: Merge and deduplicate
  return mergeExtractionResults(results);
}
```

### Concurrency Control

```typescript
async function extractChunksWithConcurrency(
  fullDocument: string,
  chunks: ExtractionChunk[],
  majorSections: Map<string, MajorSection>,
  options: { concurrency: number }
): Promise<ExtractedRequirement[][]> {
  const results: ExtractedRequirement[][] = [];
  const inFlight: Promise<void>[] = [];

  for (const chunk of chunks) {
    // Wait if at concurrency limit
    if (inFlight.length >= options.concurrency) {
      await Promise.race(inFlight);
    }

    // Start extraction
    const promise = extractSectionRange(fullDocument, chunk, majorSections)
      .then(reqs => { results.push(reqs); })
      .finally(() => {
        const idx = inFlight.indexOf(promise);
        if (idx >= 0) inFlight.splice(idx, 1);
      });

    inFlight.push(promise);
  }

  // Wait for remaining
  await Promise.all(inFlight);
  return results;
}
```

### Deduplication

Requirements at chunk boundaries might appear in multiple chunks:

```typescript
function deduplicateRequirements(
  allRequirements: ExtractedRequirement[]
): ExtractedRequirement[] {
  const seen = new Map<string, ExtractedRequirement>();

  for (const req of allRequirements) {
    const key = req.section || req.text.substring(0, 100);
    if (!seen.has(key)) {
      seen.set(key, req);
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => compareSectionNumbers(a.section, b.section));
}
```

---

## Edge Cases

### 1. Very Large Subsection (>75 requirements)

If a single subsection like "3.1" has 100+ requirements:
- Split at sub-subsection level: 3.1.1-3.1.50, 3.1.51-3.1.100
- Or let it run and handle truncation

### 2. Output Truncation Detection

```typescript
function isResponseTruncated(content: string): boolean {
  try {
    JSON.parse(content);
    return false; // Valid JSON = not truncated
  } catch {
    return true; // Parse error = likely truncated
  }
}
```

If truncated, retry with smaller section range.

### 3. Section Number Formats

Handle variations:
- Numeric: 3.1.2
- Letter-prefix: A.1.2
- Roman: III.A.1
- Mixed: Section 3, Appendix A

---

## File Changes

### `src/lib/openai.ts`

1. Add `planExtractionChunks()` (~40 lines)
2. Add `createScopedPrompt()` (~20 lines)
3. Add `extractSectionRange()` (~60 lines)
4. Add `extractChunksWithConcurrency()` (~30 lines)
5. Add `extractRequirementsFullContext()` (~50 lines)
6. Modify `extractRequirements()` to route large docs to new function
7. Bump `EXTRACTION_VERSION` to "v8"

### No Other Files Changed

All changes contained in openai.ts - the extraction interface remains the same.

---

## Testing

1. Run extraction on troublesome RFP (384 requirements)
2. Verify all sections extracted (3.1-3.20, 4.1-4.6)
3. Check type distribution (should see all 8 types, not just DESCRIPTIVE)
4. Verify mandatory/optional detection works
5. Compare token usage (should be ~3x lower)
6. Test fallback on small RFP (should still use single-pass)

---

## Commit Message

```
MAJOR: Replace one-by-one extraction with full-context scoped-output

This is a significant architectural change to how large RFPs are extracted.

PROBLEM:
- Previous approach sent each requirement to LLM in isolation
- LLM had no context, classified 99% as DESCRIPTIVE
- Mandatory detection failed (99% marked mandatory)
- 1.7M tokens used for 384 requirements

SOLUTION:
- Send FULL document to LLM (preserving context)
- Ask LLM to extract only specific section ranges per call
- Each call outputs ~50 requirements (fits in 16K output limit)
- 3 concurrent calls for performance

BENEFITS:
- Same quality as single-pass extraction (full context)
- 3x more token efficient (~580K vs 1.7M)
- Proper type classification (LLM sees patterns)
- Accurate mandatory/optional detection

New functions:
- planExtractionChunks(): Groups sections into ~55-req chunks
- extractSectionRange(): Extracts one chunk with scoped prompt
- extractRequirementsFullContext(): Orchestrates the extraction
```
