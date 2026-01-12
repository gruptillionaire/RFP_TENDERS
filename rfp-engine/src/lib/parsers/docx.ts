import mammoth from "mammoth";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

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

    return structuredText;
  } catch (error) {
    console.error("DOCX parsing error:", error);
    throw new Error("Failed to parse Word document");
  }
}

/**
 * Convert HTML to structured text that preserves table relationships.
 * Tables are converted to a clear format where each row shows column relationships.
 */
function htmlToStructuredText(html: string): string {
  const $ = cheerio.load(html);
  const output: string[] = [];

  // Process all top-level elements in order
  $("body")
    .children()
    .each((_, element) => {
      const $el = $(element);
      const tagName = element.tagName?.toLowerCase();

      if (tagName === "table") {
        output.push(processTable($, $el));
      } else if (tagName === "ul" || tagName === "ol") {
        output.push(processList($, $el, tagName === "ol"));
      } else if (tagName?.match(/^h[1-6]$/)) {
        // Preserve heading structure
        const level = parseInt(tagName[1]);
        const prefix = "#".repeat(level);
        output.push(`\n${prefix} ${$el.text().trim()}\n`);
      } else {
        // Regular paragraph or other element
        const text = $el.text().trim();
        if (text) {
          output.push(text);
        }
      }
    });

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
