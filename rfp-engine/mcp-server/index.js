#!/usr/bin/env node
/**
 * RFP Extraction MCP Server
 *
 * Provides tools to test PDF extraction against the deployed app.
 *
 * Tools:
 * - extract_pdf: Upload a PDF and get extraction results
 *
 * Configuration required:
 * - RFP_API_URL: Base URL of the deployed app (e.g., https://rfp-matrix.vercel.app)
 * - RFP_TEST_API_KEY: The TEST_API_KEY configured on the server
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Configuration from environment
const API_URL = process.env.RFP_API_URL || "https://rfp-matrix.vercel.app";
const API_KEY = process.env.RFP_TEST_API_KEY || "";

// MCP Protocol implementation
class MCPServer {
  constructor() {
    this.tools = {
      extract_pdf: {
        name: "extract_pdf",
        description:
          "Extract requirements from a PDF file using the RFP extraction system. Returns statistics, type counts, section groups, and all extracted requirements. Use debug='heuristic' to test heuristic extraction only.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Absolute path to the PDF file to extract",
            },
            debug: {
              type: "string",
              enum: ["heuristic"],
              description: "Debug mode: 'heuristic' returns only heuristic extraction results without LLM classification",
            },
          },
          required: ["file_path"],
        },
      },
      get_extraction_summary: {
        name: "get_extraction_summary",
        description:
          "Get a summary of the last extraction results (if cached). Useful for reviewing results without re-extracting.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    };

    this.lastResult = null;
  }

  async handleRequest(request) {
    const { method, params, id } = request;

    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "rfp-extraction",
              version: "1.0.0",
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: Object.values(this.tools),
          },
        };

      case "tools/call":
        return await this.handleToolCall(params, id);

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  }

  async handleToolCall(params, id) {
    const { name, arguments: args } = params;

    try {
      let result;

      switch (name) {
        case "extract_pdf":
          result = await this.extractPdf(args.file_path, args.debug);
          break;

        case "get_extraction_summary":
          result = this.getExtractionSummary();
          break;

        default:
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: `Unknown tool: ${name}`,
            },
          };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: error.message,
        },
      };
    }
  }

  async extractPdf(filePath, debug = null) {
    if (!API_KEY) {
      throw new Error(
        "RFP_TEST_API_KEY environment variable not set. Add it to your MCP config."
      );
    }

    // Resolve path
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    if (!resolvedPath.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF files are supported");
    }

    // Read file
    const fileBuffer = fs.readFileSync(resolvedPath);
    const fileName = path.basename(resolvedPath);

    // Create form data
    const boundary = "----MCPFormBoundary" + Math.random().toString(36).slice(2);
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
          `Content-Type: application/pdf\r\n\r\n`
      ),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    // Make request
    let url = `${API_URL}/api/test/extract`;
    if (debug) {
      url += `?debug=${encodeURIComponent(debug)}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    this.lastResult = result;

    // Format summary for display
    if (result.success) {
      // Handle heuristic debug mode
      if (result.mode === "heuristic_debug") {
        return {
          mode: "heuristic_debug",
          meta: result.meta,
          stats: result.stats,
          majorSections: result.majorSections,
          sampleCandidates: result.sampleCandidates,
          _note: "This is heuristic extraction only (no LLM classification). Check sampleCandidates for section numbers.",
        };
      }

      // Normal extraction response
      return {
        summary: {
          fileName: result.meta.fileName,
          totalRequirements: result.stats.totalRequirements,
          mandatory: result.stats.mandatory,
          optional: result.stats.optional,
          extractionTimeMs: result.meta.extractTimeMs,
          deadline: result.stats.deadline,
        },
        typeCounts: result.typeCounts,
        sectionGroups: result.sectionGroups,
        sampleRequirements: result.requirements.slice(0, 5).map((r) => ({
          section: r.section,
          sectionGroup: r.sectionGroup,
          type: r.type,
          isMandatory: r.isMandatory,
          textPreview: r.text.substring(0, 150) + (r.text.length > 150 ? "..." : ""),
        })),
        // Full requirements available in lastResult
        _note: `Full results cached. Use get_extraction_summary for details or check lastResult for all ${result.requirements.length} requirements.`,
      };
    } else {
      throw new Error(result.error || "Extraction failed");
    }
  }

  getExtractionSummary() {
    if (!this.lastResult) {
      return { error: "No extraction results cached. Run extract_pdf first." };
    }

    const r = this.lastResult;
    return {
      meta: r.meta,
      stats: r.stats,
      typeCounts: r.typeCounts,
      sectionGroups: r.sectionGroups,
      requirementCount: r.requirements.length,
      requirements: r.requirements.map((req) => ({
        section: req.section,
        sectionGroup: req.sectionGroup,
        type: req.type,
        isMandatory: req.isMandatory,
        text: req.text,
        wordLimit: req.wordLimit,
        characterLimit: req.characterLimit,
        isAttestation: req.isAttestation,
      })),
    };
  }
}

// Main: Run as stdio server
async function main() {
  const server = new MCPServer();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    try {
      const request = JSON.parse(line);
      const response = await server.handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      console.log(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: `Parse error: ${error.message}`,
          },
        })
      );
    }
  });

  // Log to stderr for debugging (doesn't interfere with protocol)
  console.error("[RFP MCP Server] Started");
  console.error(`[RFP MCP Server] API URL: ${API_URL}`);
  console.error(`[RFP MCP Server] API Key: ${API_KEY ? "configured" : "NOT SET"}`);
}

main();
