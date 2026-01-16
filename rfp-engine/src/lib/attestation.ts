/**
 * Attestation Classification and Statement Generation
 *
 * Determines whether a requirement is suitable for binary attestation (Compliant/Non-Compliant)
 * vs requiring a written response, and generates appropriate compliance statements for export.
 */

// Signals that suggest WRITTEN response needed (NOT attestation)
const WRITTEN_RESPONSE_SIGNALS = [
  /\b(describe|explain|detail|demonstrate|outline|discuss|elaborate)\b/i,
  /\b(provide approach|specify how|show how|detail how)\b/i,
  /\b(or equivalent|if applicable|as appropriate|may propose)\b/i,
  /\b(alternative|exception|deviation|variance)\b/i,
  /\b(methodology|approach|strategy|plan for)\b/i,
  /\b(how will|how do|how would|what is your)\b/i,
];

// Signals that suggest ATTESTATION eligible
const ATTESTATION_SIGNALS = [
  // Regulatory/compliance command forms
  /\b(must hold|must maintain|must be certified|must be licensed|must be registered)\b/i,
  /\b(must have|shall possess|is required to be|shall maintain|shall hold)\b/i,
  /\b(must submit by|shall deliver|responses due|due by|deadline)\b/i,
  /\b(must comply with|shall comply with|in accordance with|pursuant to)\b/i,
  /\b(must use format|shall include \d+ copies|shall provide \d+)\b/i,
  /\b(must be|shall be|is required to be)\s+(bonded|insured|incorporated)\b/i,
  /\b(contractor shall|offeror shall|vendor shall|respondent shall)\s+(maintain|hold|provide|submit)\b/i,
  /\b(certify|attest|warrant|represent)\s+(that|compliance)\b/i,
  /\b(accept|agree to|acknowledge)\s+(all|the)?\s*(terms|conditions|requirements)\b/i,

  // Compliance-specific yes/no questions
  /\bis\s+(the|your|it)\s+.{0,80}\s+compliant\b/i,  // "Is your solution X compliant?"
  /\bare\s+(you|your)\s+.{0,40}\s+(certified|compliant|registered|licensed)\b/i,  // "Are you X certified?"
  /\b(does|do)\s+(the|your|it)\s+.{0,60}\s+(comply|meet|conform)\s+(with|to)\b/i,  // "Does it comply with X?"
  /\bfully\s+\w*\s*(compliant|compatible|certified)\b/i,  // "fully X compliant"
  /\b(compliant|compatible)\s+with\s+.{0,30}\s+(standard|specification|requirement)/i,

  // GENERAL yes/no capability questions (binary answers = attestation eligible)
  // "Does the/your solution/system/WCMS provide/support/have/offer/allow..."
  /^does\s+(the|your)\s+\w+\s+(provide|support|have|offer|allow|enable|include)\b/i,
  // "Can the/your/a [noun]..." - any "Can" question about capability
  /^can\s+(the|your|a|an)\s+\w+/i,
  // "Can [plural noun] be..." - "Can designs be imported?"
  /^can\s+\w+s?\s+be\s+/i,
  // "Can [noun] [verb]..." - general capability (but not "Can you describe...")
  /^can\s+(?!you\s+(describe|explain|provide|detail))\w+\s+\w+/i,
  // "Is the/your solution/system able/capable..."
  /^is\s+(the|your)\s+\w+\s+(able|capable)\b/i,
  // "Does the solution/system [verb]..." (general capability)
  /^does\s+(the|your)\s+(solution|system|product|platform|software|tool|wcms|cms)\b/i,
  // "Do you have/offer/provide/support..."
  /^do\s+you\s+(have|offer|provide|support|work)\b/i,
  // "Are there..." existence questions
  /^are\s+there\b/i,
  // "Is there..." existence questions
  /^is\s+there\b/i,
  // "Are your [noun]..." qualification questions
  /^are\s+your\s+\w+/i,
];

// Regulatory citation patterns (strong signal for attestation)
const REGULATORY_PATTERNS = [
  /\b(FAR|DFAR|CFR|USC|U\.S\.C\.|Section \d+)\b/i,
  /\b([A-Z]{2,4}\s+\d+[\.\-]\d+)/,  // e.g., "OSHA 1910.134"
  /\b(Public Law|P\.L\.|Executive Order|E\.O\.)\s*\d+/i,
  /\b(ADA|HIPAA|FERPA|SOX|PCI|GDPR)\b/,
];

// Statement generation templates
const ATTESTATION_TEMPLATES = [
  {
    pattern: /\b(insurance|liability|coverage|bonded)\b/i,
    template: "[COMPANY] maintains the required insurance coverage as specified and will provide certificate of insurance upon request.",
  },
  {
    pattern: /\b(license|licensed|certification|certified|registered)\b/i,
    template: "[COMPANY] holds all required licenses and certifications as specified.",
  },
  {
    pattern: /\b(terms|conditions)\b/i,
    template: "[COMPANY] accepts all terms and conditions as stated without exception.",
  },
  {
    pattern: /\b(conflict of interest|conflict)\b/i,
    template: "[COMPANY] certifies that no conflict of interest exists with respect to this solicitation.",
  },
  {
    pattern: /\b(background check|security clearance|clearance)\b/i,
    template: "[COMPANY] confirms that all personnel will meet the specified security requirements.",
  },
  {
    pattern: /\b(comply|compliance|accordance)\b/i,
    template: "[COMPANY] confirms compliance with this requirement.",
  },
  {
    pattern: /\b(submit|deliver|due|deadline)\b/i,
    template: "[COMPANY] confirms this response is submitted in accordance with the stated requirements.",
  },
  {
    pattern: /\b(acknowledge|accept|agree)\b/i,
    template: "[COMPANY] acknowledges and agrees to this requirement.",
  },
];

export interface AttestationClassification {
  isAttestation: boolean;
  confidence: number;
  signals: {
    hasWrittenSignals: boolean;
    hasAttestationSignals: boolean;
    hasRegulatoryReference: boolean;
  };
  reasoning: string;
}

export type ComplianceStatus = "PENDING" | "COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE";

/**
 * Classify whether a requirement text is suitable for binary attestation
 */
export function classifyAttestation(text: string): AttestationClassification {
  const normalizedText = text.toLowerCase();

  // Check for written response signals (these override attestation)
  const hasWrittenSignals = WRITTEN_RESPONSE_SIGNALS.some((pattern) =>
    pattern.test(text)
  );

  // Check for attestation signals
  const hasAttestationSignals = ATTESTATION_SIGNALS.some((pattern) =>
    pattern.test(text)
  );

  // Check for regulatory references (strong attestation indicator)
  const hasRegulatoryReference = REGULATORY_PATTERNS.some((pattern) =>
    pattern.test(text)
  );

  // Decision logic:
  // 1. If written response signals are present, NOT attestation (regardless of other signals)
  // 2. If attestation signals OR regulatory references, IS attestation
  // 3. Default to NOT attestation (safer assumption)

  let isAttestation = false;
  let confidence = 0.5;
  let reasoning = "";

  if (hasWrittenSignals) {
    isAttestation = false;
    confidence = 0.9;
    reasoning = "Contains language requesting explanation or description";
  } else if (hasAttestationSignals && hasRegulatoryReference) {
    isAttestation = true;
    confidence = 0.95;
    reasoning = "Standard regulatory compliance with attestation language";
  } else if (hasAttestationSignals) {
    isAttestation = true;
    confidence = 0.8;
    reasoning = "Contains standard compliance/attestation language";
  } else if (hasRegulatoryReference) {
    isAttestation = true;
    confidence = 0.7;
    reasoning = "References standard regulation or statute";
  } else {
    isAttestation = false;
    confidence = 0.6;
    reasoning = "No clear attestation indicators; defaulting to written response";
  }

  return {
    isAttestation,
    confidence,
    signals: {
      hasWrittenSignals,
      hasAttestationSignals,
      hasRegulatoryReference,
    },
    reasoning,
  };
}

/**
 * Generate an attestation statement for export based on compliance status
 */
export function generateAttestationStatement(
  requirementText: string,
  companyName: string | null | undefined,
  status: ComplianceStatus
): string {
  const company = companyName || "[Company Name]";

  switch (status) {
    case "COMPLIANT": {
      // Find best matching template
      for (const template of ATTESTATION_TEMPLATES) {
        if (template.pattern.test(requirementText)) {
          return template.template.replace("[COMPANY]", company);
        }
      }
      // Fallback generic statement
      return `${company} confirms compliance with this requirement.`;
    }

    case "NON_COMPLIANT": {
      return `${company} notes non-compliance with this requirement.`;
    }

    case "NOT_APPLICABLE": {
      return `Not applicable to ${company}'s proposal.`;
    }

    case "PENDING":
    default: {
      return ""; // No statement for pending items
    }
  }
}

/**
 * Batch classify requirements for attestation eligibility
 * Used during initial extraction
 */
export function classifyRequirements(
  requirements: Array<{ id: string; text: string }>
): Map<string, AttestationClassification> {
  const results = new Map<string, AttestationClassification>();

  for (const req of requirements) {
    results.set(req.id, classifyAttestation(req.text));
  }

  return results;
}

/**
 * Get the appropriate response status based on compliance status
 */
export function complianceToResponseStatus(
  complianceStatus: ComplianceStatus
): "UNANSWERED" | "ANSWERED" {
  switch (complianceStatus) {
    case "COMPLIANT":
    case "NON_COMPLIANT":
    case "NOT_APPLICABLE":
      return "ANSWERED"; // Decision has been made
    case "PENDING":
    default:
      return "UNANSWERED";
  }
}
