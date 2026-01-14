import { extractText } from "unpdf";
import { preprocessRFPText } from "./text-preprocessor";

/**
 * Parse PDF document and extract text
 * Uses unpdf which is designed for serverless environments (no browser APIs required)
 *
 * Enhanced to:
 * - Extract text page-by-page with page markers for structure preservation
 * - Pre-process text to detect section hierarchies
 * - Separate concatenated requirements
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(buffer);

    // Extract text from PDF - use mergePages: false to get page-by-page extraction
    // This helps preserve document structure better than a flat merge
    const { text, totalPages } = await extractText(uint8Array, { mergePages: false });

    // Handle both string and array responses from unpdf
    let rawText: string;
    if (Array.isArray(text)) {
      // Join pages with clear page markers to preserve structure
      rawText = text
        .map((pageText, index) => {
          const pageNum = index + 1;
          // Add page marker for context, but only if page has content
          if (pageText.trim()) {
            return `\n[PAGE ${pageNum}]\n${pageText.trim()}`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n');
    } else {
      rawText = text;
    }

    // Validate we got actual text
    if (!rawText || rawText.trim().length === 0) {
      console.error("PDF parsing returned empty text:", {
        totalPages,
        bufferSize: buffer.length,
      });
      throw new Error("PDF appears to be empty or contains only images/scans. Please use a text-based PDF.");
    }

    // Pre-process text to enhance structure detection for LLM
    const processedText = preprocessRFPText(rawText, {
      addMarkers: true,
      normalizeBullets: true,
      preserveLists: true,
      separateReqs: true,
      markTables: true,
      verbose: true, // Log preprocessing stats
    });

    console.log("PDF parsed successfully:", {
      totalPages,
      rawTextLength: rawText.length,
      processedTextLength: processedText.length,
      bufferSize: buffer.length,
    });

    return processedText;
  } catch (error) {
    // Log detailed error info for debugging
    console.error("PDF parsing error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      bufferSize: buffer.length,
    });

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("encrypted") || error.message.includes("password")) {
        throw new Error("This PDF is password-protected. Please remove the password and try again.");
      }
      if (error.message.includes("Invalid") || error.message.includes("not a PDF") || error.message.includes("corrupt")) {
        throw new Error("Invalid PDF file. Please ensure the file is not corrupted.");
      }
      // Re-throw our custom errors
      if (error.message.includes("empty or contains only images")) {
        throw error;
      }
    }

    throw new Error("Failed to parse PDF document. Please try a different file format (e.g., Word document).");
  }
}
