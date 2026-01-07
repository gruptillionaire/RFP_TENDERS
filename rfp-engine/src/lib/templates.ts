/**
 * Canonical Template System
 * Pre-defined templates for common RFP questions to save on AI generation costs
 */

import { RequirementType } from "./constants";
import { DomainContext } from "./domain-context";

export interface CanonicalTemplate {
  id: string;
  patterns: RegExp[];
  keywords: string[];
  response: string;
  requirementType: RequirementType;
  domainContext?: DomainContext;
  confidence: number; // Minimum keyword match ratio (0-1)
}

/**
 * Pre-defined templates for common RFP questions
 * Each template includes:
 * - patterns: Regex patterns for exact matching
 * - keywords: Keywords for fuzzy matching (scored by presence ratio)
 * - response: The canonical response template
 * - requirementType: The expected requirement type
 * - confidence: Minimum keyword match ratio to trigger (0-1)
 */
export const CANONICAL_TEMPLATES: CanonicalTemplate[] = [
  // Data Protection & Privacy
  {
    id: "data-protection-policy",
    patterns: [
      /data protection policy/i,
      /privacy policy/i,
      /GDPR policy/i,
    ],
    keywords: ["data", "protection", "policy", "privacy", "GDPR"],
    response: `[COMPANY NAME] maintains a documented data protection policy aligned with applicable regulations. The policy covers data collection, processing, storage, and retention practices. Please refer to Appendix [X] for the complete policy document.

[DRAFT]`,
    requirementType: "DECLARATIVE",
    confidence: 0.6,
  },
  {
    id: "gdpr-compliance",
    patterns: [
      /GDPR compliance/i,
      /compliant with GDPR/i,
      /comply with GDPR/i,
    ],
    keywords: ["GDPR", "compliance", "data", "protection", "regulation"],
    response: `[COMPANY NAME] is designed to support compliance with the General Data Protection Regulation (GDPR). The platform includes features for data subject rights management, consent tracking, and data processing documentation. Specific compliance configurations are subject to customer implementation and should be confirmed during discovery.

[DRAFT]`,
    requirementType: "DECLARATIVE",
    confidence: 0.6,
  },
  {
    id: "data-processor-controller",
    patterns: [
      /data processor/i,
      /data controller/i,
      /processor or controller/i,
    ],
    keywords: ["data", "processor", "controller", "role", "GDPR"],
    response: `[COMPANY NAME] typically acts as a data processor when handling customer data, with the customer acting as data controller. Specific roles and responsibilities are defined in the Data Processing Agreement (DPA). [CONFIRM role for this engagement]

[DRAFT]`,
    requirementType: "DECLARATIVE",
    domainContext: "LEGAL",
    confidence: 0.6,
  },

  // Security & Certifications
  {
    id: "iso-27001",
    patterns: [
      /ISO 27001/i,
      /ISO27001/i,
      /information security management/i,
    ],
    keywords: ["ISO", "27001", "security", "certification", "management"],
    response: `[COMPANY NAME] [CONFIRM certification status] ISO 27001 certification. Information security management practices are documented and subject to regular review. Certificate details available upon request.

[DRAFT]`,
    requirementType: "EVIDENCE_BASED",
    confidence: 0.6,
  },
  {
    id: "soc2-compliance",
    patterns: [
      /SOC 2/i,
      /SOC2/i,
      /SOC II/i,
    ],
    keywords: ["SOC", "2", "II", "compliance", "audit", "report"],
    response: `[COMPANY NAME] [CONFIRM SOC 2 status]. SOC 2 Type [I/II] report is available under NDA. The report covers [CONFIRM scope: Security, Availability, Confidentiality, Processing Integrity, Privacy].

[DRAFT]`,
    requirementType: "EVIDENCE_BASED",
    confidence: 0.6,
  },
  {
    id: "security-certifications",
    patterns: [
      /security certifications/i,
      /what certifications/i,
      /list.*certifications/i,
    ],
    keywords: ["security", "certifications", "standards", "compliance"],
    response: `[COMPANY NAME] maintains the following security certifications and compliance:

- [CONFIRM ISO 27001 certification status]
- [CONFIRM SOC 2 Type II status]
- [CONFIRM additional certifications]

Certification documentation is available upon request under appropriate confidentiality agreements.

[DRAFT]`,
    requirementType: "EVIDENCE_BASED",
    confidence: 0.5,
  },

  // Data Handling
  {
    id: "data-retention",
    patterns: [
      /data retention/i,
      /retention policy/i,
      /how long.*data.*stored/i,
    ],
    keywords: ["data", "retention", "policy", "storage", "period", "delete"],
    response: `[COMPANY NAME] maintains a documented data retention policy. Data retention periods are configurable based on customer requirements and regulatory obligations. Standard retention periods are defined in the service agreement. Data deletion procedures are available upon contract termination.

[DRAFT]`,
    requirementType: "DECLARATIVE",
    confidence: 0.5,
  },
  {
    id: "data-backup",
    patterns: [
      /backup.*policy/i,
      /disaster recovery/i,
      /business continuity/i,
    ],
    keywords: ["backup", "recovery", "disaster", "continuity", "redundancy"],
    response: `[COMPANY NAME] maintains documented backup and disaster recovery procedures. Key features include:

- [PROVIDE backup frequency and retention details]
- [DESCRIBE geographic redundancy approach]
- [OUTLINE recovery time objectives (RTO) and recovery point objectives (RPO)]

Specific SLA commitments are defined in the service agreement.

[DRAFT]`,
    requirementType: "DESCRIPTIVE",
    confidence: 0.5,
  },
  {
    id: "data-location",
    patterns: [
      /where.*data.*stored/i,
      /data.*location/i,
      /data.*residency/i,
      /hosting location/i,
    ],
    keywords: ["data", "location", "stored", "hosting", "residency", "region"],
    response: `[COMPANY NAME] hosts data in [CONFIRM data center locations]. Data residency options are available to meet regional requirements. Specific hosting arrangements can be discussed during the contracting phase.

[DRAFT]`,
    requirementType: "DECLARATIVE",
    confidence: 0.5,
  },

  // Pricing & Commercial
  {
    id: "pricing-model",
    patterns: [
      /pricing model/i,
      /pricing structure/i,
      /how.*pricing.*work/i,
    ],
    keywords: ["pricing", "model", "cost", "structure", "fees"],
    response: `[COMPANY NAME] offers flexible pricing models tailored to customer requirements. Pricing is typically based on [CONFIRM: user count / usage volume / feature tier]. Detailed pricing is provided in a separate commercial proposal.

[DRAFT]`,
    requirementType: "DECLARATIVE",
    confidence: 0.5,
  },

  // Support & SLA
  {
    id: "support-hours",
    patterns: [
      /support hours/i,
      /support availability/i,
      /when.*support.*available/i,
    ],
    keywords: ["support", "hours", "availability", "help", "desk"],
    response: `[COMPANY NAME] provides support during [CONFIRM support hours]. Support channels include [CONFIRM: email / phone / portal / chat]. Enhanced support options are available based on service tier.

[DRAFT]`,
    requirementType: "DECLARATIVE",
    confidence: 0.5,
  },
  {
    id: "sla-uptime",
    patterns: [
      /SLA/i,
      /uptime guarantee/i,
      /service level/i,
      /availability.*guarantee/i,
    ],
    keywords: ["SLA", "uptime", "availability", "service", "level", "guarantee"],
    response: `[COMPANY NAME] offers service level commitments as defined in the service agreement. [CONFIRM SLA terms: target availability percentage, measurement period, exclusions, credits]. Specific SLA terms are subject to contract negotiation.

[DRAFT]`,
    requirementType: "DECLARATIVE",
    confidence: 0.5,
  },

  // Implementation & Onboarding
  {
    id: "implementation-timeline",
    patterns: [
      /implementation timeline/i,
      /how long.*implementation/i,
      /onboarding.*time/i,
    ],
    keywords: ["implementation", "timeline", "onboarding", "time", "duration"],
    response: `[COMPANY NAME]'s standard implementation approach typically spans [PROVIDE timeframe range, e.g., 4-8 weeks], depending on scope and complexity. Key phases include:

1. Discovery and requirements gathering
2. Configuration and customization
3. Data migration (if applicable)
4. User acceptance testing
5. Training and go-live

Actual timelines may vary based on customer readiness and scope.

[DRAFT]`,
    requirementType: "DESCRIPTIVE",
    domainContext: "PROCESS",
    confidence: 0.5,
  },
  {
    id: "training-provided",
    patterns: [
      /training.*provided/i,
      /user training/i,
      /training program/i,
    ],
    keywords: ["training", "provided", "users", "program", "learning"],
    response: `[COMPANY NAME] provides comprehensive training as part of implementation. Training options include:

- [DESCRIBE administrator training]
- [DESCRIBE end-user training]
- [DESCRIBE training materials and documentation]

Ongoing training resources are available through [CONFIRM: knowledge base / learning portal / scheduled sessions].

[DRAFT]`,
    requirementType: "DESCRIPTIVE",
    confidence: 0.5,
  },

  // Integration
  {
    id: "api-available",
    patterns: [
      /API.*available/i,
      /provide.*API/i,
      /API.*integration/i,
    ],
    keywords: ["API", "integration", "available", "REST", "connect"],
    response: `[COMPANY NAME] provides [CONFIRM API type: REST / GraphQL / SOAP] APIs for integration purposes. API documentation is available [CONFIRM: publicly / upon request / in developer portal]. Rate limits and authentication requirements are defined in the API documentation.

[DRAFT]`,
    requirementType: "DECLARATIVE",
    confidence: 0.5,
  },
];

/**
 * Match a requirement against canonical templates
 * Returns the best matching template or null if no match meets confidence threshold
 */
export function matchTemplate(requirementText: string): CanonicalTemplate | null {
  const normalizedText = requirementText.toLowerCase().trim();

  // First, try exact pattern matching (highest confidence)
  for (const template of CANONICAL_TEMPLATES) {
    for (const pattern of template.patterns) {
      if (pattern.test(requirementText)) {
        return template;
      }
    }
  }

  // Second, try keyword scoring
  const words = normalizedText.split(/\s+/);
  let bestMatch: CanonicalTemplate | null = null;
  let bestScore = 0;

  for (const template of CANONICAL_TEMPLATES) {
    const matchedKeywords = template.keywords.filter((keyword) =>
      words.some((word) => word.includes(keyword.toLowerCase()))
    );
    const score = matchedKeywords.length / template.keywords.length;

    if (score >= template.confidence && score > bestScore) {
      bestMatch = template;
      bestScore = score;
    }
  }

  return bestMatch;
}

/**
 * Check if a template exists for a given requirement
 * Useful for UI hints
 */
export function hasTemplate(requirementText: string): boolean {
  return matchTemplate(requirementText) !== null;
}
