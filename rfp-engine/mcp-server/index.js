#!/usr/bin/env node
/**
 * RFP Extraction MCP Server
 *
 * Provides tools to test PDF extraction.
 *
 * Tools:
 * - extract_pdf: Upload a PDF and get extraction results
 *
 * Configuration required:
 * - RFP_API_URL: Vercel app URL (for debug modes only)
 * - RFP_WORKER_URL: Fly.io worker URL (for LLM extraction)
 * - RFP_TEST_API_KEY: Test API key for Vercel
 * - RFP_WORKER_KEY: Worker key for Fly.io
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Load .env file from same directory as this script
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  }
}

// Configuration
const API_URL = process.env.RFP_API_URL || "https://rfp-matrix.vercel.app";
const WORKER_URL = process.env.RFP_WORKER_URL || "https://extraction-worker.fly.dev";
const API_KEY = process.env.RFP_TEST_API_KEY || "";
const WORKER_KEY = process.env.RFP_WORKER_KEY || "";

// MCP Protocol implementation
class MCPServer {
  constructor() {
    this.tools = {
      extract_pdf: {
        name: "extract_pdf",
        description:
          "Extract requirements from a PDF file. Debug modes (heuristic, classified) run fast via Vercel. Normal extraction calls Fly.io directly.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Absolute path to the PDF file to extract",
            },
            debug: {
              type: "string",
              enum: ["heuristic", "classified", "refined"],
              description: "Debug mode: 'heuristic' or 'classified' for fast local extraction (no LLM).",
            },
          },
          required: ["file_path"],
        },
      },
      get_extraction_summary: {
        name: "get_extraction_summary",
        description: "Get full details of the last extraction results.",
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
            capabilities: { tools: {} },
            serverInfo: { name: "rfp-extraction", version: "2.0.0" },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: { tools: Object.values(this.tools) },
        };

      case "tools/call":
        return await this.handleToolCall(params, id);

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
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
            error: { code: -32602, message: `Unknown tool: ${name}` },
          };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          }],
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: error.message },
      };
    }
  }

  async extractPdf(filePath, debug = null) {
    // Resolve and validate file
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    if (!resolvedPath.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF files are supported");
    }

    const fileName = path.basename(resolvedPath);

    // Debug modes go through Vercel (fast, no LLM)
    if (debug) {
      return await this.extractViaVercel(resolvedPath, fileName, debug);
    }

    // Normal extraction goes directly to Fly.io
    return await this.extractViaFlyio(resolvedPath, fileName);
  }

  async extractViaVercel(filePath, fileName, debug) {
    if (!API_KEY) {
      throw new Error("RFP_TEST_API_KEY not set");
    }

    const fileBuffer = fs.readFileSync(filePath);
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

    const url = `${API_URL}/api/test/extract?debug=${encodeURIComponent(debug)}`;
    console.error(`[MCP] Debug mode: ${debug} via Vercel`);

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
      throw new Error(`Vercel error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    this.lastResult = result;
    return result;
  }

  async extractViaFlyio(filePath, fileName) {
    if (!WORKER_KEY) {
      throw new Error("RFP_WORKER_KEY not set. Add it to your MCP config.");
    }

    // First, parse PDF via Vercel (quick operation)
    const documentText = await this.parsePdfViaVercel(filePath, fileName);

    console.error(`[MCP] Calling Fly.io worker directly...`);
    console.error(`[MCP] Document: ${documentText.length} chars`);

    const response = await fetch(`${WORKER_URL}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Key": WORKER_KEY,
      },
      body: JSON.stringify({
        documentText,
        model: "gpt-4o-mini",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fly.io error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.error(`[MCP] Extracted ${result.requirements?.length || 0} requirements`);

    this.lastResult = result;

    return {
      summary: {
        fileName,
        totalRequirements: result.requirements?.length || 0,
        mandatory: result.requirements?.filter(r => r.isMandatory).length || 0,
        optional: result.requirements?.filter(r => !r.isMandatory).length || 0,
        deadline: result.deadline,
      },
      typeCounts: this.countTypes(result.requirements || []),
      sectionGroups: this.countSectionGroups(result.requirements || []),
      sampleRequirements: (result.requirements || []).slice(0, 5).map(r => ({
        section: r.section,
        type: r.type,
        textPreview: r.text?.substring(0, 150) + (r.text?.length > 150 ? "..." : ""),
      })),
      _note: `Use get_extraction_summary for all ${result.requirements?.length || 0} requirements.`,
    };
  }

  async parsePdfViaVercel(filePath, fileName) {
    if (!API_KEY) {
      throw new Error("RFP_TEST_API_KEY not set");
    }

    const fileBuffer = fs.readFileSync(filePath);
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

    const url = `${API_URL}/api/test/parse`;
    console.error(`[MCP] Parsing PDF via Vercel...`);

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
      throw new Error(`PDF parse error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.error(`[MCP] Parsed ${result.textLength} chars from ${result.fileName}`);
    return result.text;
  }

  countTypes(requirements) {
    const counts = {};
    for (const req of requirements) {
      counts[req.type] = (counts[req.type] || 0) + 1;
    }
    return counts;
  }

  countSectionGroups(requirements) {
    const counts = {};
    for (const req of requirements) {
      const group = req.sectionGroup || "No Section Group";
      counts[group] = (counts[group] || 0) + 1;
    }
    return counts;
  }

  getExtractionSummary() {
    if (!this.lastResult) {
      return { error: "No extraction results cached. Run extract_pdf first." };
    }

    const r = this.lastResult;

    if (r.requirements) {
      return {
        requirementCount: r.requirements.length,
        requirements: r.requirements.map(req => ({
          section: req.section,
          sectionGroup: req.sectionGroup,
          type: req.type,
          isMandatory: req.isMandatory,
          text: req.text,
          isAttestation: req.isAttestation,
        })),
      };
    }

    return r;
  }
}

// Main
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
      console.log(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32700, message: `Parse error: ${error.message}` },
      }));
    }
  });

  console.error("[RFP MCP Server] Started v2.0.0");
  console.error(`[RFP MCP Server] Vercel: ${API_URL}`);
  console.error(`[RFP MCP Server] Fly.io: ${WORKER_URL}`);
}

main();
