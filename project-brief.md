Software Design Document – AI RFP / Tender Response Engine
Objective: Define the minimum viable but commercially viable system required to launch an
AI-powered RFP / Tender Response Engine with SME-focused positioning.

1. Product Overview
The AI RFP / Tender Response Engine is a web-based SaaS product designed to help SMEs,
agencies, and consultants respond to RFPs and tenders faster and with higher compliance. The
system focuses on requirement extraction, compliance tracking, and assisted drafting rather than
creative writing.

2. Target Users
- SMEs responding to 1–20 tenders per year
- Agencies and consultancies
- Freelance bid and proposal writers

3. Core Value Proposition
Upload an RFP and receive a structured list of questions, mandatory requirements, and a
compliance matrix within minutes. The product reduces the risk of missing requirements and
accelerates first-draft completion.

4. System Architecture
Frontend (Web Application)
- Single-page web app (React / Next.js equivalent)
- File upload interface (PDF, DOCX)
- Editable compliance matrix table
- Draft answer editor

Backend (API)
- Authentication service (email + password)
- File processing service
- AI orchestration layer (document parsing, extraction, drafting)
- Subscription & billing service (Stripe)

Database
- Users table (email, password hash, plan, status)
- RFP documents table (file metadata, extracted text)
- Requirements/questions table
- Compliance matrix table (status per requirement)
- Past responses / knowledge base table

5. User Accounts & Authentication
- Email/password authentication
- Password reset via email
- Subscription-gated access to features
- No complex onboarding; immediate access post-signup

6. Features – First Release (MVP)
Mandatory Features
- Upload RFP documents (PDF / Word)
- Automatic extraction of questions and mandatory requirements
- Compliance matrix (Answered / Partial / Unanswered)
- Manual status overrides
- Draft response generation per question
- Upload limited past responses for reuse
- Editable outputs
- Single-project, single-user workflow

Explicitly Excluded from First Release
- Team collaboration
- Version control
- Advanced scoring or weighting
- Export formatting automation
- Industry-specific compliance rules

7. Compliance Matrix (First Release)
The compliance matrix is a core deliverable in v1. Each requirement extracted from the RFP is
tracked with:
- Requirement text
- Associated draft answer
- Status: Unanswered / Partial / Answered
- Manual override capability

8. AI Scope and Constraints
- AI assists with extraction and drafting only
- All outputs are editable by the user
- Clear disclaimers that AI output is not final submission-ready
- No full automation or submission guarantees

9. Pricing Model
Primary Plan (Launch)
£99/month
- Up to 10 active tenders
- Compliance matrix access
- Draft responses
- Past response reuse

Future Expansion
- £39/month Solo tier
- £249/month Team tier
- Pay-per-tender option (£29 per tender)

10. Success Metrics
- Time from upload to extracted matrix under 5 minutes
- User completes at least one full tender draft
- First paid conversion without sales call
- Retention across multiple tender cycles

11. Key Risks
- Over-automation reducing user trust
- Poor extraction accuracy on complex RFPs
- Over-expanding scope too early

12. Conclusion
This document defines a focused, compliance-first MVP intended to launch quickly, charge real
money immediately, and validate demand before expanding into enterprise-grade features.

---

13. Implemented Features (Beyond Original MVP)

The following features have been implemented beyond the original MVP scope:

13.1 Requirement Classification System (Layer 1 - Requirement Type)
Each extracted requirement is classified into one of five types that control response formatting:

| Type | Purpose | Response Style |
|------|---------|----------------|
| CONTEXTUAL | Background information, no response needed | No draft section shown |
| PROCEDURAL | Simple confirmations, deadlines, admin tasks | 1-2 sentences |
| DECLARATIVE | Compliance statements, yes/no with justification | 2-3 sentences |
| DESCRIPTIVE | Detailed explanations, methodology descriptions | 150-250 words, bullet points |
| EVIDENCE_BASED | References to documents, certifications, proof | 3-5 sentences + reference list |

- Users can manually change requirement type via dropdown
- Type controls textarea size and placeholder text
- Type-specific prompts guide AI drafting

13.2 Domain Context System (Layer 2)
Each requirement is classified by domain, controlling tone and guardrails:

| Domain | Indicators | Rules |
|--------|------------|-------|
| FEATURE | Capabilities, functionality, integrations | Standard response, comprehensive language |
| PROCESS | "How" questions, methodology, timelines | Require timeframe ranges, discourage vague statements |
| LEGAL | GDPR, compliance, contracts, liability, DPA | Restrained, precise, requires manual review flag |

- Users can manually change domain context via dropdown
- LEGAL domain automatically sets "Requires Review" flag
- Domain-specific prompt modifiers applied during drafting

13.3 Visual Matrix Overview
- Clickable block grid showing all requirements at a glance
- Color-coded by status (green=answered, yellow=partial, gray=unanswered)
- Mandatory requirements shown with red border
- Click any block to jump to that requirement
- Provides quick visual progress assessment

13.4 Template Canonical Answers
- 17 pre-defined templates for common RFP questions
- Pattern and keyword matching with confidence thresholds
- Reduces AI API costs by serving cached responses
- Templates cover: company overview, data protection, security, availability, support, compliance, insurance, subcontractors, pricing, experience, references, team, methodology, timeline, communication, exit strategy, innovation

13.5 AI Quality Guardrails

Anti-Overclaiming System:
- Prevents absolute terms: "guarantee", "always", "never", "100%", "best", "industry-leading"
- Enforces hedged language: "typically", "generally", "designed to", "supports"
- Post-processing replacements for overclaims that slip through
- Placeholder insertion for unverified claims: [CONFIRM capability]

Fluff Removal:
- Regex-based removal of 30+ banned filler phrases
- Examples removed: "We are pleased to...", "Additionally...", "It is worth noting..."
- Cleans double spaces and empty lines after removal

13.6 [DRAFT] Tag
- All AI-generated responses automatically appended with [DRAFT] tag
- Clear visual indicator that response needs human review
- Must be removed before export (see Section 15)

13.7 Company Name Replacement
- Users enter company name in project settings
- [COMPANY NAME] placeholders auto-replaced in new drafts
- "Update Existing Drafts" button to apply to previously generated content
- Supports replacing old company name when changed

13.8 Project Management
- Edit project title from dashboard (hover to reveal edit button)
- Edit project title from project view (click title)
- Delete project functionality
- Projects sorted by creation date

13.9 Quota System
- FREE tier: 2 extractions per month
- Visual quota indicator on dashboard
- Quota banner with remaining extractions
- Upload blocked when quota exhausted

13.10 Status Filtering
- Filter requirements by status: All / Unanswered / Partial / Answered
- Filter persists during session
- Stats bar showing counts per status

---

14. Usage Limits by Subscription Tier

14.1 Extraction Limits (Document Uploads)
| Tier | Monthly Extractions | Active Projects |
|------|---------------------|-----------------|
| FREE | 2 | 2 |
| SOLO (£39/month) | 5 | 5 |
| PRO (£99/month) | 15 | 10 |
| TEAM (£249/month) | Unlimited | Unlimited |

14.2 Draft Generation Limits
| Tier | Drafts per Month | Drafts per Project |
|------|------------------|-------------------|
| FREE | 20 | 10 |
| SOLO (£39/month) | 100 | 50 |
| PRO (£99/month) | 500 | Unlimited |
| TEAM (£249/month) | Unlimited | Unlimited |

14.3 Template Access
| Tier | Template Library |
|------|------------------|
| FREE | Basic (5 templates) |
| SOLO | Standard (17 templates) |
| PRO | Full + Custom templates |
| TEAM | Full + Custom + Shared team templates |

14.4 Past Response Library
| Tier | Stored Responses |
|------|------------------|
| FREE | 10 |
| SOLO | 50 |
| PRO | 200 |
| TEAM | Unlimited |

---

15. Export Functionality (Planned)

15.1 Export Formats
- Microsoft Word (.docx)
- PDF (.pdf)
- Plain text (.txt)
- CSV (requirements list only)

15.2 Export Templates
- Standard compliance matrix format
- Question-and-answer format
- Full proposal format with sections
- Custom templates (PRO tier and above)

15.3 Unfinished Content Blockers
Export will be BLOCKED if any requirement contains unresolved placeholders:

| Blocker Pattern | Meaning | Resolution Required |
|-----------------|---------|---------------------|
| [DRAFT] | AI-generated, not reviewed | Remove tag after human review |
| [COMPANY NAME] | Company name not set | Enter company name in settings |
| [PROVIDE ...] | User input required | Replace with actual information |
| [EXPLAIN ...] | User explanation needed | Write the explanation |
| [DESCRIBE ...] | User description needed | Write the description |
| [OUTLINE ...] | User outline needed | Write the outline |
| [CONFIRM ...] | Capability unverified | Verify and update claim |
| [DATE] | Date placeholder | Insert actual date |
| [NUMBER] | Number placeholder | Insert actual number |
| [SPECIFIC DETAILS] | Details placeholder | Insert actual details |

Export Blocker UI:
- Warning modal listing all unresolved placeholders
- Clickable list to jump to each requirement
- Count of blockers per type
- "Export Anyway (Draft)" option for internal review copies (watermarked)

---

16. Planned Features (Roadmap)

16.1 High Priority

Export to Word/PDF
- Formatted output ready for submission
- Unfinished content blockers (see Section 15.3)
- Multiple export templates
- Custom branding (PRO tier)

Deadline Extraction & Tracking
- Auto-extract submission deadline from RFP
- Prominent countdown display on project page
- Dashboard widget showing upcoming deadlines
- Email reminders at 7 days, 3 days, 1 day

Word/Character Count
- Per-requirement character/word count
- Warning when approaching common limits (500 words, 2000 characters)
- RFP-specific limit configuration
- Visual indicator when limit exceeded

Bulk Generate Drafts
- "Generate All Unanswered" button
- Queue-based processing with progress indicator
- Skip CONTEXTUAL requirements automatically
- Respect rate limits and quotas

Copy to Clipboard
- One-click copy for individual responses
- Copy without [DRAFT] tag option
- Copy as plain text or formatted
- Visual confirmation on copy

16.2 Medium Priority

Requirement Search
- Full-text search across all requirements
- Filter by keyword
- Highlight matches in results
- Search within current project or all projects

Section Grouping
- Group requirements by extracted section
- Collapsible section headers
- Section-level progress indicators
- Jump-to-section navigation

Sort by Priority
- Sort options: Mandatory first, Section order, Status, Type
- Persist sort preference per project
- Quick-sort buttons in header

Internal Notes
- Add private notes to any requirement
- Notes not included in export
- Searchable notes
- Note timestamps

Duplicate Detection
- Identify similar requirements across project
- Suggest shared responses
- Link related requirements
- Bulk apply same response

16.3 Nice to Have

Submission Checklist
- Auto-generated list of required attachments mentioned in RFP
- Manual checklist items
- Checkbox completion tracking
- Print-friendly format

Progress by Section
- Breakdown of completion percentage per RFP section
- Visual progress bars per section
- Section completion indicators in sidebar

Print-Friendly View
- Checklist mode for offline review
- Compact formatting
- Page break optimization
- QR code linking back to online version

Past Responses Library
- Store and tag previous responses
- Search by keyword or tag
- Insert from library into current requirement
- Track reuse frequency
- Suggest relevant past responses

Response Versioning
- Track changes to draft responses
- View response history
- Restore previous versions
- Compare versions side-by-side

AI Response Regeneration Options
- "More formal" / "More concise" quick actions
- Regenerate with specific instructions
- A/B compare two generated options
- Learn from user edits

---

17. Technical Debt & Improvements

17.1 Known Issues
- Turbopack lockfile warning (multiple package-lock.json files)
- Middleware deprecation warning (migrate to proxy)

17.2 Performance Optimizations Needed
- Lazy load requirements for large RFPs (100+ requirements)
- Virtualized table rendering
- Debounced draft saves
- Optimistic UI updates

17.3 Security Enhancements
- Rate limiting on API endpoints
- Input sanitization for LLM prompts (implemented)
- File upload validation and scanning
- Session timeout handling
