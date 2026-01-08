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

17.2 Performance Optimizations (COMPLETED)
- ✅ Memoized components with React.memo
- ✅ Stable callback references to prevent re-renders
- ✅ Single-pass stats computation
- ✅ Debounced draft saves with separate refs
- ✅ Event delegation for matrix cell clicks
- ✅ Sticky table headers for scroll UX

17.3 Security Enhancements (COMPLETED)
- ✅ Rate limiting on API endpoints (auth, signup)
- ✅ Input sanitization for LLM prompts
- ✅ File upload validation with magic bytes
- ✅ CSRF protection via origin/referer verification
- ✅ Password strength validation
- ✅ User enumeration prevention
- ✅ Session maxAge configuration
- ✅ Security headers (CSP, HSTS, X-Frame-Options)

17.4 Legal Compliance (COMPLETED)
- ✅ GDPR compliance (Articles 7, 13-17, 20, 30)
- ✅ CCPA compliance (Do Not Sell, data deletion)
- ✅ Cookie consent banner with granular controls
- ✅ Privacy Policy, Terms of Service, Cookie Policy pages
- ✅ Data Processing Agreement (DPA) for enterprise
- ✅ Audit logging for compliance verification
- ✅ Data export API (JSON format)
- ✅ Account deletion with soft delete option
- ✅ Consent checkboxes on signup

---

18. Critical Gaps (Launch Blockers)

The following features are REQUIRED before commercial launch:

18.1 Stripe Billing Integration (Priority: CRITICAL)
Status: NOT IMPLEMENTED
Effort: 2-3 days

Required functionality:
- Stripe Checkout integration for subscription signup
- Customer portal for subscription management
- Webhook handling for payment events
- Plan upgrade/downgrade flows
- Invoice generation and history
- FREE → SOLO → PRO → TEAM tier transitions
- Usage-based billing consideration for pay-per-tender option
- Subscription status synced to user record
- Grace period handling for failed payments

18.2 Document Export (Priority: CRITICAL)
Status: COMPLETED ✅
Effort: 2 days

Implemented functionality:
- ✅ Export to Microsoft Word (.docx) format
- ✅ Compliance matrix format template (table layout)
- ✅ Question-and-answer format template (grouped by section)
- ✅ Unfinished content blockers (see Section 15.3)
- ✅ Export button in project view (visible when status is READY)
- ✅ Watermark option for draft exports
- ✅ Export caching for re-download without regeneration
- ✅ Export history with download/delete options
- ⏳ PDF export (planned, not yet implemented)

Libraries used:
- docx (npm package) for Word generation

18.3 Password Reset Flow (Priority: CRITICAL)
Status: COMPLETED ✅
Effort: 0.5 days

Implemented functionality:
- ✅ "Forgot Password" link on login page
- ✅ Email input form with user enumeration prevention
- ✅ Secure token generation (crypto.randomBytes, 32 bytes)
- ✅ Token expiration (1 hour)
- ✅ Reset link email via Resend
- ✅ New password form with validation
- ✅ Token invalidation after use
- ✅ Rate limiting on reset requests

---

19. Missing Competitive Features

Features not in original brief but expected by users of modern RFP tools:

19.1 Past Responses Library UI (Priority: HIGH)
Status: Database model exists, UI NOT IMPLEMENTED
Effort: 1-2 days

Why it matters:
- 70% time savings come from reusing previous answers
- Competitors (Loopio, RFPIO) have this as core feature
- Users expect to build a knowledge base over time

Required functionality:
- Library page showing all saved responses
- Tag-based organization
- Full-text search across responses
- Insert from library into current requirement
- Save current response to library
- Usage tracking (how often reused)
- AI-suggested similar responses

19.2 Response Templates Library (Priority: HIGH)
Status: Backend templates exist, UI NOT IMPLEMENTED
Effort: 1 day

Why it matters:
- Pre-built answers for common questions
- Reduces AI API costs
- Consistent company messaging

Required functionality:
- Browse template categories
- Preview template content
- One-click insert into requirement
- Custom template creation (PRO tier)
- Template usage analytics

19.3 Team Collaboration (Priority: MEDIUM)
Status: NOT IMPLEMENTED
Effort: 3-5 days

Why it matters:
- Enterprise customers expect multi-user access
- RFP responses often involve multiple SMEs
- Enables £249/month TEAM tier

Required functionality:
- Organization/workspace model
- Invite team members by email
- Role-based permissions (Admin, Editor, Viewer)
- Assign requirements to team members
- Comment threads on requirements
- Activity feed showing recent changes
- @mentions and notifications

19.4 AI Knowledge Base (Priority: MEDIUM)
Status: NOT IMPLEMENTED
Effort: 2-3 days

Why it matters:
- Generic AI answers lack company-specific details
- Users want AI trained on their content
- Major differentiator vs. generic ChatGPT

Required functionality:
- Upload company documents (capabilities, case studies, policies)
- Document chunking and embedding
- Vector storage (Pinecone, Supabase pgvector)
- RAG retrieval during draft generation
- Source citation in responses
- Knowledge base management UI

19.5 Version History (Priority: MEDIUM)
Status: NOT IMPLEMENTED
Effort: 1-2 days

Why it matters:
- Track changes over review cycles
- Restore accidentally deleted content
- Audit trail for compliance

Required functionality:
- Automatic versioning on save
- Version diff view
- Restore previous version
- Version comparison side-by-side
- Retention policy (last 50 versions)

19.6 Email Notifications (Priority: MEDIUM)
Status: NOT IMPLEMENTED
Effort: 1 day

Why it matters:
- Users miss submission deadlines
- Keep users engaged with product
- Standard SaaS expectation

Required functionality:
- Deadline reminders (7 days, 3 days, 1 day before)
- Weekly progress summary email
- Team activity notifications
- Email preferences in settings
- Unsubscribe handling

19.7 Analytics Dashboard (Priority: LOW)
Status: NOT IMPLEMENTED
Effort: 2-3 days

Why it matters:
- Demonstrate ROI to users
- Identify power users for upsell
- Product usage insights

Required functionality:
- Time saved metrics
- Requirements answered per project
- AI vs. manual response ratio
- Win/loss tracking (user-reported)
- Monthly usage trends
- Export analytics data

19.8 CRM Integrations (Priority: LOW)
Status: NOT IMPLEMENTED
Effort: 3-5 days per integration

Why it matters:
- Enterprise sales workflows
- Opportunity tracking
- Competitive requirement for large deals

Potential integrations:
- Salesforce
- HubSpot
- Pipedrive
- Microsoft Dynamics

---

20. Competitive Landscape Analysis

20.1 Direct Competitors

| Competitor | Pricing | Key Differentiator |
|------------|---------|-------------------|
| Loopio | $500+/month | Content library, enterprise focus |
| RFPIO | $400+/month | AI-powered, integrations |
| Responsive | $300+/month | Collaboration, analytics |
| Qvidian | Enterprise | Workflow automation |
| Proposify | $49+/month | Design-focused proposals |

20.2 Our Positioning
- **Target**: SMEs priced out of enterprise tools
- **Price Point**: £39-99/month (10x cheaper than enterprise)
- **Core Value**: Speed to first draft, compliance assurance
- **Differentiator**: AI requirement classification (Type + Domain)

20.3 Feature Parity Requirements
Minimum features needed to compete:
- ✅ Document parsing
- ✅ Requirement extraction
- ✅ Compliance matrix
- ✅ AI draft generation
- ❌ Content/response library (UI missing)
- ❌ Export to Word/PDF
- ❌ Team collaboration
- ❌ Analytics

---

21. Launch Readiness Checklist

Pre-Launch (Required):
- [ ] Stripe billing integration
- [ ] Word/PDF export functionality
- [ ] Password reset flow
- [ ] Past responses library UI
- [ ] Production environment setup
- [ ] Error monitoring (Sentry)
- [ ] Uptime monitoring
- [ ] Backup strategy

Post-Launch (Week 1-4):
- [ ] Response templates UI
- [ ] Email notifications
- [ ] Analytics dashboard (basic)
- [ ] User feedback collection

Growth Phase:
- [ ] Team collaboration
- [ ] AI knowledge base
- [ ] CRM integrations
- [ ] Mobile-responsive improvements

---

22. Future Version Features (V2+)

The following features were identified through competitive analysis. They are NOT required for MVP but represent potential enhancements for future versions based on market demand.

22.1 Browser Extension for RFP Detection
Priority: LOW
Why consider: Auto-detect RFP links on procurement portals (SAM.gov, Contracts Finder), one-click import

Potential functionality:
- Browser extension (Chrome/Firefox)
- Detects RFP/tender document links
- One-click "Import to RFP Engine" button
- Auto-extract deadline and basic metadata
- Portal integrations (government procurement sites)

22.2 Smart Answer Suggestions
Priority: MEDIUM
Why consider: Beyond current AI drafting, suggest answers from past responses based on semantic similarity

Potential functionality:
- Semantic matching against response library
- Suggest 3-5 similar past answers
- Confidence score per suggestion
- One-click insert with attribution
- Learn from user selections

22.3 Bid/No-Bid Decision Support
Priority: LOW
Why consider: Enterprise feature for qualification before investing time in response

Potential functionality:
- Bid/No-Bid scoring criteria checklist
- Automatic risk factor extraction
- Win probability estimation
- Resource requirement analysis
- Decision documentation and history

22.4 Slack/Microsoft Teams Integration
Priority: LOW
Why consider: Team collaboration in familiar tools

Potential functionality:
- Deadline notifications in Slack/Teams channels
- Assignment notifications
- Status update alerts
- Quick actions from chat (mark complete, assign)
- Link previews for requirements

22.5 Win/Loss Tracking & Analytics
Priority: MEDIUM
Why consider: ROI demonstration, pattern identification for improvement

Potential functionality:
- Mark project as Won/Lost/No-bid
- Win rate tracking over time
- Pattern analysis (which requirements correlate with wins)
- Revenue tracking
- Loss reason categorization

22.6 Built-in E-Signature Support
Priority: LOW
Why consider: Some RFPs require signed compliance statements

Potential functionality:
- Integration with DocuSign/HelloSign/PandaDoc
- Signature request workflow
- Signed document storage
- Signature audit trail
- Multi-signer support

22.7 Proposal View Tracking
Priority: LOW
Why consider: Know when clients review your proposal

Potential functionality:
- Shareable proposal links
- View tracking (who viewed, when, how long)
- Page-level engagement analytics
- Follow-up reminders based on views
- Watermarked viewer identification

22.8 Multi-level Approval Workflows
Priority: MEDIUM
Why consider: Enterprise compliance requirement for proposal sign-off

Potential functionality:
- Configurable approval chains
- Role-based approval requirements
- Approval status dashboard
- Reminder notifications
- Audit trail for compliance

22.9 Document Comparison (Diff View)
Priority: LOW
Why consider: RFP amendments often require comparing versions

Potential functionality:
- Upload original and amended RFP
- Visual diff highlighting changes
- Auto-identify new/changed requirements
- Track which changes have been addressed
- Version comparison for own responses

22.10 RFP Alerts & Market Intelligence
Priority: LOW
Why consider: Proactive opportunity discovery

Potential functionality:
- Keyword-based RFP alerts
- Procurement portal monitoring
- Industry trend analysis
- Competitor win tracking (public contracts)
- Opportunity scoring based on profile

22.11 Offline Mode / Desktop App
Priority: LOW
Why consider: Work on proposals without internet

Potential functionality:
- Electron/Tauri desktop application
- Offline document access
- Local draft editing
- Sync when online
- Export without network

22.12 Custom Branding for Exports
Priority: MEDIUM
Why consider: Professional proposals need company branding (already noted in 16.1 for PRO tier)

Potential functionality:
- Logo upload
- Custom header/footer
- Brand color themes
- Font selection
- Cover page templates

22.13 Automated Compliance Checking
Priority: MEDIUM
Why consider: Beyond placeholder detection, verify actual compliance claims

Potential functionality:
- Industry-specific compliance rules (GDPR, HIPAA, SOC2)
- Automatic claim verification against uploaded documents
- Compliance certificate tracking
- Expiration alerts for certifications
- Compliance scoring per proposal

22.14 Proposal Templates Library (Pre-built)
Priority: LOW
Why consider: Starter templates for different industries/proposal types

Potential functionality:
- Industry-specific templates (IT, Construction, Healthcare)
- Proposal type templates (technical, financial, capability)
- Best practice structure suggestions
- Community-contributed templates
- Template customization

22.15 Time Tracking per Proposal
Priority: LOW
Why consider: Understand true cost of proposal creation

Potential functionality:
- Time logging per requirement
- Project-level time totals
- Cost calculation based on hourly rates
- Efficiency metrics over time
- ROI calculation (time invested vs. contract value)

---

23. Feature Prioritization Framework

When evaluating future features, consider:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Revenue Impact | 30% | Will this feature unlock new pricing tiers or reduce churn? |
| User Demand | 25% | How often is this requested? |
| Competitive Parity | 20% | Do major competitors have this? |
| Implementation Effort | 15% | Days of development required |
| Strategic Alignment | 10% | Does it reinforce our SME positioning? |

Priority Matrix:
- **Implement Now**: High demand + Low effort
- **Plan for V2**: High demand + High effort
- **Consider for V3+**: Low demand + Any effort
- **Avoid**: Low demand + High effort + No strategic value
