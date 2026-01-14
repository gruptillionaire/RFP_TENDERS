import { extractText } from "unpdf";

/**
 * Parse PDF document and extract text
 * Uses unpdf which is designed for serverless environments (no browser APIs required)
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(buffer);

    // Extract text from PDF
    const { text, totalPages } = await extractText(uint8Array, { mergePages: true });

    // Validate we got actual text
    if (!text || text.trim().length === 0) {
      console.error("PDF parsing returned empty text:", {
        totalPages,
        bufferSize: buffer.length,
      });
      throw new Error("PDF appears to be empty or contains only images/scans. Please use a text-based PDF.");
    }

    console.log("PDF parsed successfully:", {
      totalPages,
      textLength: text.length,
      bufferSize: buffer.length,
    });

    return text;
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
