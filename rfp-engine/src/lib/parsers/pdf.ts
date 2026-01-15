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

    // Extract text from PDF - use mergePages: true for reliability
    const { text, totalPages } = await extractText(uint8Array, { mergePages: true });

    // Validate we got actual text
    if (!text || text.trim().length === 0) {
      console.error("PDF parsing returned empty text:", {
        totalPages,
        bufferSize: buffer.length,
      });
      throw new Error("PDF appears to be empty or contains only images/scans. Please use a text-based PDF.");
    }

    console.log("PDF raw text extracted:", {
      totalPages,
      textLength: text.length,
      bufferSize: buffer.length,
    });

    // Pre-process text to enhance structure detection for LLM
    // Wrap in try-catch to ensure parsing doesn't fail if preprocessing has issues
    let processedText: string;
    try {
      processedText = preprocessRFPText(text, {
        addMarkers: true,
        normalizeBullets: true,
        preserveLists: true,
        separateReqs: true,
        markTables: true,
        verbose: true,
      });
    } catch (preprocessError) {
      console.error("Preprocessing failed, using raw text:", preprocessError);
      processedText = text; // Fallback to raw text if preprocessing fails
    }

    console.log("PDF parsed successfully:", {
      totalPages,
      rawTextLength: text.length,
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
