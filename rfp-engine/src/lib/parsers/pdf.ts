// pdf-parse doesn't have proper ESM exports
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");

    // Configure pdf-parse with timeout and page limits
    const options = {
      max: 0, // Parse all pages (0 = no limit)
    };

    const data = await pdfParse(buffer, options);

    // Validate we got actual text
    if (!data.text || data.text.trim().length === 0) {
      console.error("PDF parsing returned empty text:", {
        numPages: data.numpages,
        bufferSize: buffer.length,
        info: data.info,
      });
      throw new Error("PDF appears to be empty or contains only images/scans. Please use a text-based PDF.");
    }

    console.log("PDF parsed successfully:", {
      numPages: data.numpages,
      textLength: data.text.length,
      bufferSize: buffer.length,
    });

    return data.text;
  } catch (error) {
    // Log detailed error info for debugging
    console.error("PDF parsing error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      bufferSize: buffer.length,
      bufferStart: buffer.slice(0, 20).toString("hex"), // First 20 bytes (magic bytes)
    });

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("encrypted") || error.message.includes("password")) {
        throw new Error("This PDF is password-protected. Please remove the password and try again.");
      }
      if (error.message.includes("Invalid PDF") || error.message.includes("not a PDF")) {
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
