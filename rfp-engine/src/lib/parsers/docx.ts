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
    const processedText = preprocessRFPText(structuredText, {
      addMarkers: true,
      normalizeBullets: true,
      preserveLists: true,
      separateReqs: true,
      markTables: false, // DOCX parser already handles tables
      verbose: true,
    });

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
        return `[Col ${cellIndex + 1}] ${cell}`;
      })
      .join(" | ");

    output.push(prefix + rowText);
  });

  output.push("[TABLE END]");

  return output.join("\n");
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
