/**
 * POST /api/test/parse
 *
 * Parse a PDF or DOCX and return the raw text. Used by MCP to get document text
 * before sending to Fly.io for extraction.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { parsePDF } from "@/lib/parsers/pdf";
import { parseDOCX } from "@/lib/parsers/docx";
import { sanitizeForLLM } from "@/lib/security";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const authHeader = request.headers.get("Authorization");
    const testApiKey = process.env.TEST_API_KEY;

    if (!testApiKey) {
      return NextResponse.json({ error: "Test endpoint not configured" }, { status: 503 });
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const providedKey = authHeader.replace("Bearer ", "");
    const keyBuffer = Buffer.from(providedKey);
    const expectedBuffer = Buffer.from(testApiKey);
    if (keyBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(keyBuffer, expectedBuffer)) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Get file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isPDF = fileName.endsWith(".pdf");
    const isDOCX = fileName.endsWith(".docx");

    if (!isPDF && !isDOCX) {
      return NextResponse.json({ error: "Only PDF and DOCX files supported" }, { status: 400 });
    }

    // Parse file based on type
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = isPDF ? await parsePDF(buffer) : await parseDOCX(buffer);
    const sanitizedText = sanitizeForLLM(text);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      textLength: sanitizedText.length,
      text: sanitizedText,
    });
  } catch (error) {
    console.error("[test/parse] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Parse failed" },
      { status: 500 }
    );
  }
}
