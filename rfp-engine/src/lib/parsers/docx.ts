import mammoth from "mammoth";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { preprocessRFPText } from "./text-preprocessor";

/**
 * Parse DOCX file with improved table structure preservation.
 *
 * LIMITATIONS:
 * - Images: Stripped (embedded images not extracted)
 * - Merged cells: May not preserve complex merge patterns correctly
 * - Text boxes/shapes: Often not extracted by mammoth
 * - Headers/footers: Included but not labeled as such
 * - Comments/track changes: Not extracted
 * - Form fields/content controls: May not extract properly
 * - Nested tables: Flattened to sequential tables
 * - Complex formatting: Bold/italic/underline stripped (text only)
 */
export async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    // Convert to HTML to preserve table structure
    const result = await mammoth.convertToHtml({ buffer });

    if (result.messages.length > 0) {
      // Log any conversion warnings (but don't fail)
      console.warn(
        "DOCX conversion warnings:",
        result.messages.map((m) => m.message)
      );
    }

    // Parse HTML and convert to structured text
    const structuredText = htmlToStructuredText(result.value);

    // Pre-process text to enhance structure detection for LLM
    // Wrap in try-catch to ensure parsing doesn't fail if preprocessing has issues
    let processedText: string;
    try {
      processedText = preprocessRFPText(structuredText, {
        addMarkers: true,
        normalizeBullets: true,
        preserveLists: true,
        separateReqs: true,
        markTables: false, // DOCX parser already handles tables
        verbose: true,
      });
    } catch (preprocessError) {
      console.error("DOCX preprocessing failed, using raw text:", preprocessError);
      processedText = structuredText; // Fallback to unprocessed text
    }

    return processedText;
  } catch (error) {
    console.error("DOCX parsing error:", error);
    throw new Error("Failed to parse Word document");
  }
}

/**
 * Check if a string looks like a section number
 * Matches: "3", "3.", "3:", "3)", "Section 3", "A", "A1", "II", "3.1", "3.1.2"
 */
function looksLikeSectionNumber(text: string): boolean {
  const trimmed = text.trim();

  // Multi-part numbers like "3.1.2"
  if (/^\d+(\.\d+)+[.:\)]*$/.test(trimmed)) return true;

  // Simple numbers with optional punctuation: "3", "3.", "3:", "3)"
  if (/^(Part\s+|Section\s+)?\d+[.:\)]*$/i.test(trimmed)) return true;

  // Letters: "A", "A.", "A1", "A1."
  if (/^[A-Z]\d*[.:\)]*$/i.test(trimmed)) return true;

  // Roman numerals: "II", "II.", "IV"
  if (/^[IVXLC]+[.:\)]*$/i.test(trimmed)) return true;

  return false;
}

/**
 * Check if a string looks like a section title (has letters, not just numbers)
 */
function looksLikeSectionTitle(text: string): boolean {
  const trimmed = text.trim();
  // Must have at least some letters and be more than just a number
  return trimmed.length > 0 && /[a-zA-Z]{2,}/.test(trimmed) && !looksLikeSectionNumber(trimmed);
}

/**
 * Convert HTML to structured text that preserves table relationships.
 * Tables are converted to a clear format where each row shows column relationships.
 *
 * IMPORTANT: Merges consecutive headings where the first is a section number
 * and the second is the section title (common in Word documents).
 */
function htmlToStructuredText(html: string): string {
  const $ = cheerio.load(html);
  const output: string[] = [];

  // Collect all children first so we can look ahead
  const children = $("body").children().toArray();

  let i = 0;
  while (i < children.length) {
    const element = children[i];
    const $el = $(element);
    const tagName = element.tagName?.toLowerCase();

    if (tagName === "table") {
      output.push(processTable($, $el));
      i++;
    } else if (tagName === "ul" || tagName === "ol") {
      output.push(processList($, $el, tagName === "ol"));
      i++;
    } else if (tagName?.match(/^h[1-6]$/)) {
      // Check if this heading is just a section number
      const currentText = $el.text().trim();
      const level = parseInt(tagName[1]);
      const prefix = "#".repeat(level);

      // Look ahead to find next heading, skipping empty elements
      if (looksLikeSectionNumber(currentText)) {
        let nextHeadingIdx = -1;
        let nextText = "";

        // Scan up to 3 elements ahead (skip empty paragraphs)
        for (let j = i + 1; j < Math.min(i + 4, children.length); j++) {
          const nextEl = children[j];
          const nextTag = nextEl.tagName?.toLowerCase();

          // If we hit a non-empty non-heading, stop searching
          if (!nextTag?.match(/^h[1-6]$/)) {
            const txt = $(nextEl).text().trim();
            if (txt) break; // Non-empty paragraph/other element - stop
            continue; // Empty element - skip and continue
          }

          // Found a heading - check if it's a title
          nextText = $(nextEl).text().trim();
          if (nextText && looksLikeSectionTitle(nextText)) {
            nextHeadingIdx = j;
            break;
          }
        }

        if (nextHeadingIdx > -1) {
          // Merge number and title (strip trailing punctuation from number)
          const mergedText = `${currentText.replace(/[.:\)]+$/, '')}: ${nextText}`;
          output.push(`\n${prefix} ${mergedText}\n`);
          i = nextHeadingIdx + 1; // Skip all elements we processed
          continue;
        }
      }

      // No merge needed, output as normal
      output.push(`\n${prefix} ${currentText}\n`);
      i++;
    } else {
      // Regular paragraph or other element
      const text = $el.text().trim();
      if (text) {
        output.push(text);
      }
      i++;
    }
  }

  // Clean up excessive whitespace while preserving structure
  return output
    .join("\n\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/**
 * Process a table into structured text format.
 * Each row is clearly delimited, and cells are separated with " | " for clarity.
 * Headers (if detected) are marked.
 */
function processTable(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<AnyNode>
): string {
  const rows: string[][] = [];
  let hasHeader = false;

  // Check for thead to identify header rows
  const $thead = $table.find("thead");
  if ($thead.length > 0) {
    hasHeader = true;
    $thead.find("tr").each((_, row) => {
      const cells: string[] = [];
      $(row)
        .find("th, td")
        .each((_, cell) => {
          cells.push($(cell).text().trim());
        });
      if (cells.length > 0) {
        rows.push(cells);
      }
    });
  }

  // Process tbody or direct tr elements
  const $tbody = $table.find("tbody");
  const $rows = $tbody.length > 0 ? $tbody.find("tr") : $table.find("> tr");

  // If no thead but first row has th elements, treat as header
  let firstRowIndex = 0;
  if (!hasHeader && $rows.length > 0) {
    const $firstRow = $rows.first();
    if ($firstRow.find("th").length > 0) {
      hasHeader = true;
      const cells: string[] = [];
      $firstRow.find("th, td").each((_, cell) => {
        cells.push($(cell).text().trim());
      });
      if (cells.length > 0) {
        rows.push(cells);
      }
      firstRowIndex = 1;
    }
  }

  // Process remaining rows
  $rows.slice(firstRowIndex).each((_, row) => {
    const cells: string[] = [];
    $(row)
      .find("td, th")
      .each((_, cell) => {
        cells.push($(cell).text().trim());
      });
    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  if (rows.length === 0) {
    return "";
  }

  // Check if this table contains multiple requirement numbers (e.g., 8.2.3 AND 8.2.4)
  // If so, split into separate logical tables for better extraction
  const tableText = rows.map((r) => r.join(" ")).join("\n");
  const reqNumbers = tableText.match(/\b\d+\.\d+\.\d+\b/g);
  const uniqueReqNumbers = [...new Set(reqNumbers || [])];

  if (uniqueReqNumbers.length > 1) {
    // Table contains multiple requirements - split by requirement number
    return splitMultiRequirementTable(rows, uniqueReqNumbers);
  }

  // Format the table as structured text
  const output: string[] = [];
  output.push("[TABLE START]");

  rows.forEach((row, index) => {
    const isHeaderRow = hasHeader && index === 0;
    const prefix = isHeaderRow ? "[HEADER] " : `[ROW ${index + (hasHeader ? 0 : 1)}] `;

    // Join cells with clear separator
    const rowText = row
      .map((cell, cellIndex) => {
        // Include column number for clarity
        return `[Col ${cellIndex + 1}] ${restoreBulletFormatting(cell)}`;
      })
      .join(" | ");

    output.push(prefix + rowText);
  });

  output.push("[TABLE END]");

  return output.join("\n");
}

/**
 * Split a table containing multiple requirements into separate logical tables.
 * E.g., a table with rows for 8.2.3 and 8.2.4 becomes two separate tables.
 */
function splitMultiRequirementTable(
  rows: string[][],
  reqNumbers: string[]
): string {
  const output: string[] = [];

  // Find rows belonging to each requirement
  let currentReq = "";
  let currentRows: string[][] = [];

  for (const row of rows) {
    const rowText = row.join(" ");
    // Check if this row starts a new requirement
    const matchedReq = reqNumbers.find((rn) => rowText.includes(rn));

    if (matchedReq && matchedReq !== currentReq) {
      // Emit previous requirement's table
      if (currentRows.length > 0) {
        output.push(formatSingleTable(currentRows));
      }
      currentReq = matchedReq;
      currentRows = [row];
    } else {
      currentRows.push(row);
    }
  }

  // Emit final requirement's table
  if (currentRows.length > 0) {
    output.push(formatSingleTable(currentRows));
  }

  return output.join("\n\n");
}

/**
 * Format a single requirement table.
 */
function formatSingleTable(rows: string[][]): string {
  const output: string[] = [];
  output.push("[TABLE START]");

  rows.forEach((row, index) => {
    const prefix = `[ROW ${index + 1}] `;
    const rowText = row
      .map((cell, cellIndex) => `[Col ${cellIndex + 1}] ${restoreBulletFormatting(cell)}`)
      .join(" | ");
    output.push(prefix + rowText);
  });

  output.push("[TABLE END]");
  return output.join("\n");
}

/**
 * Restore bullet formatting in requirement text.
 * DOCX tables often have lists without line breaks, e.g.:
 * "Please cover:General EmailResponsive templates..." ->
 * "Please cover:\n• General Email\n• Responsive templates..."
 */
function restoreBulletFormatting(text: string): string {
  let result = text;

  // Step 1: Split on ":" followed by capital letter (common in "Please provide...:")
  // Require at least 2 lowercase letters to indicate a real word, not abbreviation
  result = result.replace(/:([A-Z][a-z]{2,})/g, ":\n• $1");

  // Step 2: Split on lowercase-to-uppercase transitions (concatenated list items)
  // Pattern: lowercase letter followed by uppercase letter and at least 2 more lowercase
  // This avoids splitting on abbreviations like "A/B" or "eCommerce"
  // E.g., "Email MarketingResponsive templates" -> "Email Marketing\n• Responsive templates"
  result = result.replace(
    /([a-z])([A-Z][a-z]{2,})/g,
    "$1\n• $2"
  );

  // Step 2b: Split before common abbreviation patterns that start list items
  // These are abbreviations that commonly start their own list item
  // E.g., "personalisationA/B testing" -> "personalisation\n• A/B testing"
  result = result.replace(
    /([a-z])(A\/B|B2B|B2C|SaaS|PaaS|IaaS|API|SDK|UI\/UX|ROI|KPI|SEO|SEM|CRM|ERP|CMS|CDN|SSL|TLS)/g,
    "$1\n• $2"
  );

  // Step 3: Also split on ")" followed by capital and real word
  result = result.replace(
    /\)([A-Z][a-z]{2,})/g,
    ")\n• $1"
  );

  // Step 4: Fix brand names that got incorrectly split internally
  // These have internal camelCase that got split but shouldn't have
  // Note: The split already happened, so fix the damage
  const brandFixes: Array<[RegExp, string]> = [
    [/Whats\n• App/g, "WhatsApp"],
    [/You\n• Tube/g, "YouTube"],
    [/Linked\n• In/g, "LinkedIn"],
    [/Power\n• Point/g, "PowerPoint"],
    [/Java\n• Script/g, "JavaScript"],
    [/Type\n• Script/g, "TypeScript"],
    [/Git\n• Hub/g, "GitHub"],
    [/Drop\n• Box/g, "Dropbox"],
    [/Face\n• Book/g, "Facebook"],
    [/Pay\n• Pal/g, "PayPal"],
  ];

  for (const [pattern, replacement] of brandFixes) {
    result = result.replace(pattern, replacement);
  }

  // Step 5: Clean up any double bullets or empty lines
  result = result.replace(/\n•\s*\n•/g, "\n•");

  return result;
}

/**
 * Process lists while preserving structure.
 */
function processList(
  $: cheerio.CheerioAPI,
  $list: cheerio.Cheerio<AnyNode>,
  isOrdered: boolean
): string {
  const items: string[] = [];

  $list.children("li").each((index, li) => {
    const $li = $(li);
    const prefix = isOrdered ? `${index + 1}.` : "•";

    // Get direct text content (not nested list text)
    const text = $li
      .contents()
      .filter((_, el) => el.type === "text" || (el.type === "tag" && !["ul", "ol"].includes(el.tagName?.toLowerCase())))
      .text()
      .trim();

    if (text) {
      items.push(`${prefix} ${text}`);
    }

    // Handle nested lists
    $li.children("ul, ol").each((_, nestedList) => {
      const nestedIsOrdered = nestedList.tagName?.toLowerCase() === "ol";
      const nestedText = processList($, $(nestedList), nestedIsOrdered);
      // Indent nested items
      const indented = nestedText
        .split("\n")
        .map((line) => "  " + line)
        .join("\n");
      items.push(indented);
    });
  });

  return items.join("\n");
}
