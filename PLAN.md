# MAJOR INFRASTRUCTURE CHANGE: Hybrid Heuristic + LLM Extraction

## Problem Statement

The previous LLM-based extraction approach has critical scaling issues:

| Issue | Impact |
|-------|--------|
| 8 API calls per large document | 10K RPD limit → only 1,250 docs/day |
| 30-60 seconds per API call | Exceeds Vercel 300s timeout |
| ~150K tokens per extraction | High cost at scale |
| Rate limits hit with single user | Cannot serve 1,000 users |

## Solution: Hybrid Heuristic + Optional LLM

### Core Insight

Most RFP requirement classifications are **pattern-based**:
- "Does your system..." → DECLARATIVE (yes/no question)
- "Describe your approach..." → DESCRIPTIVE (open-ended)
- "Provide three client references..." → REFERENCE_BASED
- "shall", "must" → Mandatory
- "may", "optional" → Optional

**We don't need an LLM for 80%+ of classifications.**

### New Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: INSTANT HEURISTIC EXTRACTION                    │
│                              (0 API calls)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Parse PDF → raw text                                                    │
│  2. Find all section numbers (3.1.1, 3.1.2, etc.)                          │
│  3. Extract requirement text for each section                               │
│  4. Classify TYPE by pattern matching:                                      │
│     - "Does...", "Can...", "Is..." → DECLARATIVE (90% confidence)          │
│     - "Describe...", "Explain..." → DESCRIPTIVE (90% confidence)           │
│     - "$", "price", "cost" → QUANTITATIVE (85% confidence)                 │
│     - "references", "clients" → REFERENCE_BASED (85% confidence)           │
│     - etc.                                                                  │
│  5. Classify MANDATORY by pattern matching:                                 │
│     - "shall", "must", "required" → Mandatory (85% confidence)             │
│     - "may", "optional" → Optional (85% confidence)                        │
│  6. Assign confidence score (0-100) to each classification                 │
│  7. Return ALL requirements immediately                                     │
│                                                                             │
│  Time: < 2 seconds                                                          │
│  API calls: 0                                                               │
│  Accuracy: ~75-80%                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER REVIEWS RESULTS                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  384 requirements extracted                              [Export]   │   │
│  │  ════════════════════════════════════════════════════════════════   │   │
│  │  ⚠ 47 items have low confidence classifications                    │   │
│  │                                                                     │   │
│  │  [ Improve Accuracy with AI ]    ← Optional, triggers Phase 2      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  User can:                                                                  │
│  - Accept results as-is (most users)                                       │
│  - Manually correct individual items                                        │
│  - Click "Improve Accuracy" for LLM refinement                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (only if user clicks button)
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: LLM REFINEMENT (Optional)                       │
│                              (1 API call)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Collect low-confidence requirements (confidence < 70%)                 │
│  2. Send batch to LLM with FULL EXTRACTION_PROMPT                          │
│  3. LLM returns corrected classifications                                   │
│  4. Update requirements in database                                         │
│  5. Return updated results to user                                          │
│                                                                             │
│  Time: 10-20 seconds                                                        │
│  API calls: 1                                                               │
│  Input: ~5K tokens (only low-confidence items)                             │
│  Accuracy: 90%+ after refinement                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Scaling Comparison

| Metric | Old (LLM-only) | New (Hybrid) |
|--------|----------------|--------------|
| API calls per doc | 8 | 0-1 |
| Time per extraction | 3-5 minutes | 2 seconds |
| Max docs/day (10K RPD) | 1,250 | 10,000+ |
| Cost per doc | ~$0.15 | ~$0.00-0.02 |
| Vercel timeout risk | High | None |

## Type Classification Patterns

### DECLARATIVE (Yes/No Questions)
```
Priority: 50
Patterns:
  /^(does|can|is|are|will|would|has|have|do)\s+/i
  /^(is\s+there|are\s+there|does\s+your|can\s+your)\b/i

Examples:
  "Does your system support SSO?" → DECLARATIVE (95%)
  "Can users export data to CSV?" → DECLARATIVE (95%)
  "Is the solution cloud-based?" → DECLARATIVE (95%)
```

### DESCRIPTIVE (Open-Ended Questions)
```
Priority: 40
Patterns:
  /^(describe|explain|outline|detail|discuss)\b/i
  /^(how|what|why)\s+(does|do|is|are|will|would|can|should)/i
  /^please\s+(describe|explain|provide\s+details)/i

Examples:
  "Describe your implementation approach" → DESCRIPTIVE (90%)
  "How does your system handle failover?" → DESCRIPTIVE (90%)
  "Explain your security architecture" → DESCRIPTIVE (90%)
```

### QUANTITATIVE (Financial/Numeric)
```
Priority: 80
Patterns:
  /\$\s*\d/
  /\b(price|pricing|cost|fee|rate|budget|amount)\b/i
  /\b(how\s+much|how\s+many|number\s+of|quantity)\b/i

Examples:
  "Provide pricing for Year 1" → QUANTITATIVE (90%)
  "What is the cost per user?" → QUANTITATIVE (85%)
  "How many FTEs are required?" → QUANTITATIVE (85%)
```

### REFERENCE_BASED (References/Experience)
```
Priority: 90
Patterns:
  /\b(client\s+)?reference/i
  /\bcase\s+stud/i
  /\bsimilar\s+project/i
  /\bpast\s+performance/i

Examples:
  "Provide three client references" → REFERENCE_BASED (95%)
  "Describe similar projects completed" → REFERENCE_BASED (90%)
  "Include case studies" → REFERENCE_BASED (90%)
```

### EVIDENCE_BASED (Documentation)
```
Priority: 85
Patterns:
  /\b(attach|upload|include|submit|provide)\b.*\b(copy|proof|document|certificate)/i
  /\b(ISO|SOC|HIPAA|PCI)\s*\d*/i

Examples:
  "Attach proof of insurance" → EVIDENCE_BASED (95%)
  "Provide ISO 27001 certificate" → EVIDENCE_BASED (95%)
  "Include sample reports" → EVIDENCE_BASED (85%)
```

### STAFFING (Personnel)
```
Priority: 100 (highest - specific patterns)
Patterns:
  /\b(staff|personnel|team|resource|FTE|employee|role|resume)\b/i
  /\b(project\s+manager|lead|coordinator|developer)\b/i

Examples:
  "Provide resumes for key staff" → STAFFING (95%)
  "List the project team roles" → STAFFING (90%)
  "How many FTEs will be assigned?" → STAFFING (85%)
```

### PROCEDURAL (Confirmations)
```
Priority: 70
Patterns:
  /^(please\s+)?(confirm|acknowledge|agree|accept|certify)\b/i
  /\bsign.*\b(form|document|agreement)/i

Examples:
  "Confirm acceptance of terms" → PROCEDURAL (90%)
  "Sign the attached NDA" → PROCEDURAL (90%)
```

### CONTEXTUAL (Background/Instructions)
```
Priority: 60
Patterns:
  /^(this\s+section|the\s+following|note\s+that|background)\b/i
  /\bfailure\s+to.*(?:may|will)\s+result/i
  /\bshall\s+be\s+submitted/i

Examples:
  "This section describes the requirements" → CONTEXTUAL (90%)
  "Failure to respond may result in disqualification" → CONTEXTUAL (95%)
```

## Mandatory Classification Patterns

### Mandatory Indicators
```
Patterns:
  /\bshall\b/i
  /\bmust\b/i
  /\brequired\b/i
  /\bmandatory\b/i
  /\bwill\s+be\s+(evaluated|scored)/i

Also check section headers:
  "Required Items" → All items mandatory (90%)
  "Mandatory Requirements" → All items mandatory (95%)
```

### Optional Indicators
```
Patterns:
  /\bmay\b/i
  /\boptional\b/i
  /\bif\s+(applicable|available|desired)/i
  /\bpreferred\b/i
  /\bnot\s+required\b/i

Also check section headers:
  "Optional Requirements" → All items optional (90%)
  "Preferred Qualifications" → All items optional (85%)
```

## Implementation Files

### New Files

1. **src/lib/parsers/heuristic-classifier.ts**
   - `classifyTypeHeuristically(text): { type, confidence, pattern }`
   - `classifyMandatoryHeuristically(text, sectionTitle?): { isMandatory, confidence, pattern }`
   - All pattern definitions and matching logic

2. **src/app/api/projects/[id]/refine/route.ts**
   - POST endpoint for LLM refinement
   - Accepts requirement IDs to refine
   - Uses full EXTRACTION_PROMPT for quality

### Modified Files

1. **src/lib/parsers/heuristic-extractor.ts**
   - Import classifier functions
   - Add `extractAndClassifyHeuristically()` combining extraction + classification
   - Return confidence scores with each requirement

2. **src/lib/openai.ts**
   - Update `extractRequirementsFullContext()` to use heuristic classification
   - Add `refineRequirementsWithLLM()` for batch refinement
   - Keep single-pass LLM for small documents (still works well)

## API Changes

### Existing: POST /api/projects/[id]/extract

Now returns additional fields:
```json
{
  "requirements": [
    {
      "id": "...",
      "text": "Does your system support SSO?",
      "type": "DECLARATIVE",
      "typeConfidence": 95,
      "isMandatory": true,
      "mandatoryConfidence": 60,
      "section": "3.1.1",
      ...
    }
  ],
  "lowConfidenceCount": 47,
  "extractionMethod": "heuristic"
}
```

### New: POST /api/projects/[id]/refine

Request:
```json
{
  "requirementIds": ["id1", "id2", ...],  // Optional: specific IDs
  "confidenceThreshold": 70               // Optional: refine all below this
}
```

Response:
```json
{
  "refined": 47,
  "requirements": [
    {
      "id": "id1",
      "type": "DESCRIPTIVE",        // Updated
      "typeConfidence": 95,          // Now high
      "isMandatory": false,          // Updated
      "mandatoryConfidence": 90      // Now high
    }
  ]
}
```

## Confidence Scoring

| Confidence | Meaning | Action |
|------------|---------|--------|
| 90-100% | Strong pattern match | Trust classification |
| 70-89% | Good match with some ambiguity | Probably correct |
| 50-69% | Weak match or default | May need review |
| 0-49% | No match, pure guess | Recommend LLM refinement |

## Migration Notes

- Existing extractions are unaffected (already in DB)
- New extractions use heuristic-first approach
- Users with old extractions can re-extract to get confidence scores
- The refine endpoint works with any extraction (old or new)

## Testing Checklist

1. [ ] Extract troublesome RFP with heuristics only
2. [ ] Verify all 384 requirements extracted
3. [ ] Check type distribution (should be diverse, not 99% DESCRIPTIVE)
4. [ ] Check confidence scores (most should be 70%+)
5. [ ] Test refine endpoint with low-confidence items
6. [ ] Verify total time < 5 seconds for initial extraction
7. [ ] Verify zero API calls for initial extraction
