/**
 * Test Extraction Script
 *
 * Usage:
 *   npx ts-node scripts/test-extraction.ts ./path/to/test.pdf
 *
 * Or with npx tsx (faster):
 *   npx tsx scripts/test-extraction.ts ./path/to/test.pdf
 *
 * Output:
 *   - scripts/extraction-result.json (full results)
 *   - scripts/extraction-summary.json (summary for quick review)
 *   - Console output with stats
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

// Load environment variables from .env file
config({ path: path.join(__dirname, "..", ".env") });

// Import after env is loaded
import { parsePDF } from "../src/lib/parsers/pdf";
import { extractRequirements } from "../src/lib/openai";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: npx tsx scripts/test-extraction.ts <pdf-path>");
    console.error("Example: npx tsx scripts/test-extraction.ts ./test-docs/sample.pdf");
    process.exit(1);
  }

  const pdfPath = args[0];

  // Resolve path
  const resolvedPath = path.isAbsolute(pdfPath)
    ? pdfPath
    : path.join(process.cwd(), pdfPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("TEST EXTRACTION");
  console.log("=".repeat(60));
  console.log(`PDF: ${resolvedPath}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  try {
    // Step 1: Read PDF
    console.log("\n[1/3] Reading PDF...");
    const pdfBuffer = fs.readFileSync(resolvedPath);
    console.log(`     PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

    // Step 2: Parse PDF to text
    console.log("\n[2/3] Parsing PDF to text...");
    const startParse = Date.now();
    const text = await parsePDF(pdfBuffer);
    console.log(`     Text length: ${text.length} chars`);
    console.log(`     Parse time: ${Date.now() - startParse}ms`);

    // Step 3: Extract requirements
    console.log("\n[3/3] Extracting requirements...");
    const startExtract = Date.now();
    const result = await extractRequirements(text);
    const extractTime = Date.now() - startExtract;
    console.log(`     Extraction time: ${extractTime}ms (${(extractTime / 1000).toFixed(1)}s)`);
    console.log(`     Requirements found: ${result.requirements.length}`);

    // Generate summary statistics
    const typeCounts: Record<string, number> = {};
    const sectionGroups: Record<string, number> = {};
    let mandatoryCount = 0;
    let optionalCount = 0;

    for (const req of result.requirements) {
      // Type counts
      typeCounts[req.type] = (typeCounts[req.type] || 0) + 1;

      // Section group counts
      const group = req.sectionGroup || "No Section Group";
      sectionGroups[group] = (sectionGroups[group] || 0) + 1;

      // Mandatory counts
      if (req.isMandatory) {
        mandatoryCount++;
      } else {
        optionalCount++;
      }
    }

    // Sort types by count
    const sortedTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1]);

    // Sort section groups
    const sortedGroups = Object.entries(sectionGroups)
      .sort((a, b) => a[0].localeCompare(b[0]));

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("EXTRACTION RESULTS");
    console.log("=".repeat(60));

    console.log("\n📊 STATISTICS:");
    console.log(`   Total requirements: ${result.requirements.length}`);
    console.log(`   Mandatory: ${mandatoryCount} (${((mandatoryCount / result.requirements.length) * 100).toFixed(1)}%)`);
    console.log(`   Optional: ${optionalCount} (${((optionalCount / result.requirements.length) * 100).toFixed(1)}%)`);
    console.log(`   Extraction time: ${(extractTime / 1000).toFixed(1)}s`);
    if (result.deadline) {
      console.log(`   Deadline detected: ${result.deadline}`);
    }

    console.log("\n📋 TYPES:");
    for (const [type, count] of sortedTypes) {
      const pct = ((count / result.requirements.length) * 100).toFixed(1);
      console.log(`   ${type}: ${count} (${pct}%)`);
    }

    console.log("\n📁 SECTION GROUPS:");
    for (const [group, count] of sortedGroups) {
      console.log(`   ${group}: ${count} requirements`);
    }

    // Sample requirements (first 3)
    console.log("\n📝 SAMPLE REQUIREMENTS (first 3):");
    for (let i = 0; i < Math.min(3, result.requirements.length); i++) {
      const req = result.requirements[i];
      console.log(`\n   [${i + 1}] Section: ${req.section}`);
      console.log(`       Type: ${req.type} | Mandatory: ${req.isMandatory}`);
      console.log(`       Text: ${req.text.substring(0, 100)}${req.text.length > 100 ? "..." : ""}`);
    }

    // Save full results
    const outputDir = path.join(__dirname);
    const resultPath = path.join(outputDir, "extraction-result.json");
    const summaryPath = path.join(outputDir, "extraction-summary.json");

    // Full results
    fs.writeFileSync(resultPath, JSON.stringify({
      meta: {
        pdfPath: resolvedPath,
        pdfSize: pdfBuffer.length,
        textLength: text.length,
        extractionTime: extractTime,
        timestamp: new Date().toISOString(),
      },
      result,
    }, null, 2));

    // Summary
    fs.writeFileSync(summaryPath, JSON.stringify({
      meta: {
        pdfPath: resolvedPath,
        timestamp: new Date().toISOString(),
      },
      stats: {
        totalRequirements: result.requirements.length,
        mandatory: mandatoryCount,
        optional: optionalCount,
        extractionTimeMs: extractTime,
        deadline: result.deadline,
      },
      typeCounts: Object.fromEntries(sortedTypes),
      sectionGroups: Object.fromEntries(sortedGroups),
      // Include first 10 requirements for quick review
      sampleRequirements: result.requirements.slice(0, 10).map(r => ({
        section: r.section,
        sectionGroup: r.sectionGroup,
        type: r.type,
        isMandatory: r.isMandatory,
        text: r.text.substring(0, 200) + (r.text.length > 200 ? "..." : ""),
      })),
    }, null, 2));

    console.log("\n" + "=".repeat(60));
    console.log("OUTPUT FILES:");
    console.log("=".repeat(60));
    console.log(`   Full results: ${resultPath}`);
    console.log(`   Summary: ${summaryPath}`);
    console.log("\n✅ Done!");

  } catch (error) {
    console.error("\n❌ Extraction failed:");
    console.error(error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
