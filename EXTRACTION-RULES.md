# RFP Extraction Rules

This document defines the rules and constraints for the RFP requirement extraction system.

---

## 1. Core Principles

### 1.1 Format Agnosticism
- Extraction **MUST** work for any RFP format, including poorly formatted documents
- Support all section identifier formats:
  - Numeric: `3.1.2`, `4.6.10`, `12.3`
  - Letter-prefixed: `A.1`, `B.2.3`, `C.1`
  - Roman numerals: `III.B`, `IV.2.1`
  - Custom IDs: `Q5`, `REQ-001`, `(a)`, `(i)`
  - Mixed formats within same document
- Never assume a specific numbering scheme

### 1.2 Robustness
- Handle OCR errors (e.g., `3.l.5` instead of `3.1.5`)
- Handle inconsistent spacing and formatting
- Handle missing section numbers gracefully
- Handle documents with no clear structure
- Never crash on malformed input

### 1.3 Completeness
- Extract **all** requirements from the document
- Prefer false positives over false negatives (extract too much rather than miss requirements)
- Track and report any gaps in extraction coverage

---

## 2. Requirement Definition

### 2.1 What IS a Requirement
- Questions ending with `?`
- Statements containing `shall`, `must`, `will`, `should`
- Capability requests: `Describe...`, `Explain...`, `Provide...`, `List...`
- Compliance statements requiring attestation
- Requests for information about vendor capabilities

### 2.2 What is NOT a Requirement
- Section titles/headers without questions (classify as CONTEXTUAL)
- Table of contents entries
- Page numbers and headers/footers
- Contact information blocks
- Timeline/schedule sections (extract deadline separately)
- Instructions to respondents (meta-content)
- Boilerplate legal text

---

## 3. Extraction Quality Rules

### 3.1 One Requirement = One Item
- Each question (ending `?`) is a separate requirement
- Each `Describe/Explain/Provide...` statement is separate
- **NEVER** merge multiple distinct requests into one requirement
- If a section contains 5 questions, extract 5 separate requirements

### 3.2 Text Integrity
- Extract text **verbatim** from the document
- Preserve exact wording (don't paraphrase or summarize)
- Clean up only:
  - Extra whitespace (collapse to single spaces)
  - PDF artifacts (embedded page numbers like "12 of 38")
  - Leading list numbers that are parsing artifacts

### 3.3 Section Identifiers
- Copy section IDs **exactly** as they appear in the document
- Use `null` if no identifier is visible
- Never invent or infer section numbers

---

## 4. Boundary Detection Rules

### 4.1 Section Boundaries (CRITICAL)
- A requirement **MUST** end before the next section begins
- Stop extraction at:
  - New section identifier (any format)
  - Topic change (different subject matter)
  - Major structural break (new chapter/part)

### 4.2 Cross-Section Contamination Prevention
- **NEVER** include text from section 5.x in a section 4.x requirement
- If section `4.6.10` is followed by `5.0 Instructions`, requirement 4.6.10 must end before `5.0`
- Watch for section headers embedded in extracted text

### 4.3 Conservative Span Rules
- Most requirements are 1-5 lines
- If a span exceeds 8 lines, verify no boundary crossing
- Prefer ending at sentence boundaries
- When uncertain, extract **LESS** not more

### 4.4 Stop Signals
Immediately stop extraction at:
- New major section (e.g., `5.0`, `Section B`, `Part III`)
- Page breaks with headers
- Document title repetition ("Request for Proposal")
- Contact information blocks
- Submission instructions

---

## 5. Requirement Classification

### 5.1 Types
| Type | Description | Indicators |
|------|-------------|------------|
| DECLARATIVE | Yes/No attestation | "Does the...", "Can the...", "Is the..." |
| DESCRIPTIVE | Open-ended description | "Describe...", "Explain...", "What..." |
| PROCEDURAL | Process/method request | "How does...", "What is your approach..." |
| EVIDENCE_BASED | Documentation request | "Provide evidence...", "Include samples..." |
| QUANTITATIVE | Numeric response | "How many...", "What percentage..." |
| CONTEXTUAL | Background/header info | Section titles, context paragraphs |
| REFERENCE_BASED | External reference | "Per regulation X...", "According to..." |
| STAFFING | Personnel questions | "Who will...", "What roles..." |

### 5.2 Mandatory vs Optional
- Default to **mandatory** (true)
- Mark optional only if explicitly stated ("optional", "if applicable", "bonus")

### 5.3 Attestation Detection
- Short DECLARATIVE questions (<200 chars) are typically attestations
- Questions answerable with Yes/No + brief explanation
- Strong patterns: "Does your solution...", "Can the system..."

---

## 6. Post-Processing Rules

### 6.1 Allowed Cleanup
- Remove embedded page numbers ("Page X of Y", "X of Y")
- Remove leading number artifacts from PDF parsing ("3 Does..." -> "Does...")
- Collapse excessive whitespace
- Strip section prefix from text if duplicated

### 6.2 Deduplication
- Remove exact text duplicates
- Remove near-duplicates (one text is subset of another)
- **NEVER** deduplicate items from different sections
- Items in section 3.8 and 3.9 with similar text are NOT duplicates

### 6.3 Validation Fixes
| Issue | Action |
|-------|--------|
| Truncated text | Append missing text from context |
| Fragment (starts lowercase) | Merge with previous requirement |
| Contains page number | Remove the pattern |
| Section header only | Reclassify as CONTEXTUAL |
| Wrong type | Correct the type |
| Cross-section contamination | Truncate at boundary |
| Merged requirements | Split at question boundaries |

---

## 7. Gap Detection & Recovery

### 7.1 Detection
- Compare extracted sections against document structure
- Identify missing items in sequences (e.g., 4.6.1, 4.6.2, [missing 4.6.3-4.6.8], 4.6.9)
- Flag subsections with <50% expected coverage

### 7.2 Recovery Strategy
1. Attempt targeted LLM extraction for missing items
2. Use expanded context window around missing sections
3. Log items that cannot be recovered
4. Never use format-specific regex fallbacks

---

## 8. Output Requirements

### 8.1 Required Fields per Requirement
```typescript
{
  section: string | null,      // Exact section ID or null
  sectionGroup: string | null, // Major section title
  text: string,                // Verbatim requirement text
  type: RequirementType,       // Classification
  isMandatory: boolean,        // Default true
  domainContext: 'FEATURE' | 'PROCESS' | 'LEGAL',
  wordLimit: number | null,    // If specified in RFP
  characterLimit: number | null,
  isAttestation: boolean       // Yes/No question
}
```

### 8.2 Extraction Metadata
- Deadline (ISO format if found)
- Deadline text (original wording)
- Total requirement count
- Coverage warnings
- Processing errors

---

## 9. Performance Constraints

### 9.1 Cost Efficiency
- Use gpt-4o-mini for standard extraction (~$0.02-0.03 per RFP)
- Minimize token usage through line-reference extraction
- Batch gap-fill requests by subsection

### 9.2 Timeout Handling
- LLM timeout: 45 minutes (large documents need time)
- Graceful degradation on partial failures
- Continue processing if validation fails

---

## 10. Known Limitations & Issues

### 10.1 Current Known Issues
- Cross-section contamination still occurs despite prompts
- Section headers sometimes included in requirement text
- Gap detection may miss items with non-standard numbering
- Some merged requirements not split properly

### 10.2 Intentionally Not Supported
- Image/diagram extraction
- Table data extraction (text only)
- Handwritten content
- Scanned documents without OCR

---

## 11. Quality Metrics

### 11.1 Success Criteria
- Zero requirements missed (completeness)
- Zero cross-section contamination (accuracy)
- All requirements properly classified (classification)
- No duplicate extractions (uniqueness)

### 11.2 Acceptable Trade-offs
- Prefer over-extraction to under-extraction
- Prefer false positives (extra context) to false negatives (missed requirements)
- Accept CONTEXTUAL classification for ambiguous items

---

## Revision History

| Date | Change |
|------|--------|
| 2025-01-19 | Initial version - documented format-agnostic extraction rules |
