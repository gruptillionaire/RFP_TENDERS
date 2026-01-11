/**
 * Sanitizes text before sending to LLM to prevent prompt injection attacks
 */
export function sanitizeForLLM(text: string): string {
  let sanitized = text;

  // 1. Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 2. Escape potential instruction markers that could inject new prompts
  const dangerousPatterns = [
    /```system/gi,
    /```assistant/gi,
    /```user/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<<SYS>>/gi,
    /<\/SYS>>/gi,
    /Human:/gi,
    /Assistant:/gi,
    /System:/gi,
    /SYSTEM:/gi,
    /USER:/gi,
    /ASSISTANT:/gi,
  ];

  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, (match) => `[ESCAPED: ${match}]`);
  }

  // 3. Limit consecutive special characters (potential exploit attempts)
  sanitized = sanitized.replace(/[#*_~`]{5,}/g, "[REDACTED]");

  // 4. Escape markdown-like code blocks that might contain instructions
  sanitized = sanitized.replace(/```[\s\S]*?```/g, (match) => {
    return `[DOCUMENT CODE BLOCK START]\n${match.slice(3, -3)}\n[DOCUMENT CODE BLOCK END]`;
  });

  // 5. Limit document to reasonable size to prevent context overflow attacks
  const MAX_CHARS = 200000;
  if (sanitized.length > MAX_CHARS) {
    sanitized = sanitized.substring(0, MAX_CHARS) + "\n[DOCUMENT TRUNCATED]";
  }

  return sanitized;
}

/**
 * Validates that a requirement type is a valid enum value
 */
export function isValidRequirementType(type: string): boolean {
  const validTypes = ["CONTEXTUAL", "PROCEDURAL", "DECLARATIVE", "DESCRIPTIVE", "EVIDENCE_BASED"];
  return validTypes.includes(type);
}

/**
 * Sanitizes user-provided requirement type to prevent enum injection
 */
export function sanitizeRequirementType(type: string): string {
  const validTypes = ["CONTEXTUAL", "PROCEDURAL", "DECLARATIVE", "DESCRIPTIVE", "EVIDENCE_BASED"];
  const upperType = type?.toUpperCase?.() || "";
  return validTypes.includes(upperType) ? upperType : "DECLARATIVE";
}
