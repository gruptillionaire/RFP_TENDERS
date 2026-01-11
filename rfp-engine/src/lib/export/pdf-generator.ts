/**
 * PDF Document Generator
 *
 * Generates PDF documents from project requirements with support
 * for different export templates using pdf-lib.
 */

import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import path from "path";
import fs from "fs";
import type { ExportTemplate, ExportOptions, RequirementForExport } from "./docx-generator";
import { generateAttestationStatement } from "@/lib/attestation";

// Re-export types for consistency
export type { ExportTemplate, ExportOptions, RequirementForExport };

/**
 * Get the response text for a requirement (handles attestations)
 */
function getResponseText(
  req: RequirementForExport,
  companyName: string | null
): string {
  // For attestation items, generate statement based on compliance status
  if (req.isAttestation) {
    const status = req.complianceStatus || "PENDING";
    return generateAttestationStatement(req.text, companyName, status);
  }
  // For regular items, use the draft answer
  return req.draftAnswer || "";
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const PDF_CONFIG = {
  PAGE_WIDTH: 595.28,   // A4 width in points
  PAGE_HEIGHT: 841.89,  // A4 height in points
  MARGIN_TOP: 72,       // 1 inch
  MARGIN_BOTTOM: 72,
  MARGIN_LEFT: 54,      // 0.75 inch
  MARGIN_RIGHT: 54,
  HEADER_HEIGHT: 30,
  FOOTER_HEIGHT: 25,
  LINE_HEIGHT: 14,
  FONT_SIZE_TITLE: 18,
  FONT_SIZE_HEADING: 14,
  FONT_SIZE_BODY: 10,
  FONT_SIZE_SMALL: 8,
} as const;

const COLORS = {
  PRIMARY: rgb(0.145, 0.388, 0.922),     // #2563EB (blue)
  TEXT_DARK: rgb(0, 0, 0),
  TEXT_GRAY: rgb(0.4, 0.4, 0.4),
  TEXT_LIGHT: rgb(0.6, 0.6, 0.6),
  DRAFT_RED: rgb(0.863, 0.149, 0.149),   // #DC2626
  STATUS_GREEN: rgb(0.086, 0.396, 0.204),
  STATUS_AMBER: rgb(0.573, 0.251, 0.055),
  STATUS_GRAY: rgb(0.42, 0.451, 0.502),
  BORDER: rgb(0.9, 0.91, 0.92),
  TABLE_HEADER_BG: rgb(0.145, 0.388, 0.922),
  WHITE: rgb(1, 1, 1),
} as const;

// =============================================================================
// FONT MANAGEMENT
// =============================================================================

interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
}

async function loadFonts(pdfDoc: PDFDocument): Promise<FontSet> {
  pdfDoc.registerFontkit(fontkit);

  try {
    const fontDir = path.join(process.cwd(), "src/lib/export/fonts");
    const regularFontBytes = fs.readFileSync(path.join(fontDir, "Inter-Regular.ttf"));
    const boldFontBytes = fs.readFileSync(path.join(fontDir, "Inter-Bold.ttf"));

    return {
      regular: await pdfDoc.embedFont(regularFontBytes),
      bold: await pdfDoc.embedFont(boldFontBytes),
    };
  } catch {
    console.warn("Custom fonts not found, using standard fonts");
    return {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    };
  }
}

// =============================================================================
// TEXT UTILITIES
// =============================================================================

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  if (!text) return [""];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      // Handle very long words that exceed maxWidth
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        // Break long word
        let remaining = word;
        while (remaining) {
          let fit = "";
          for (let i = 1; i <= remaining.length; i++) {
            const substr = remaining.substring(0, i);
            if (font.widthOfTextAtSize(substr, fontSize) <= maxWidth) {
              fit = substr;
            } else {
              break;
            }
          }
          if (fit) {
            lines.push(fit);
            remaining = remaining.substring(fit.length);
          } else {
            lines.push(remaining.charAt(0));
            remaining = remaining.substring(1);
          }
        }
        currentLine = "";
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
}

function getStatusColor(status: string): RGB {
  switch (status) {
    case "ANSWERED": return COLORS.STATUS_GREEN;
    case "PARTIAL": return COLORS.STATUS_AMBER;
    default: return COLORS.STATUS_GRAY;
  }
}

function formatStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// =============================================================================
// PAGE MANAGER
// =============================================================================

class PDFPageManager {
  private pdfDoc: PDFDocument;
  private fonts: FontSet;
  private options: ExportOptions;
  private currentPage: PDFPage | null = null;
  private currentY: number = 0;
  private pageCount: number = 0;
  private contentTop: number;
  private contentBottom: number;

  constructor(pdfDoc: PDFDocument, fonts: FontSet, options: ExportOptions) {
    this.pdfDoc = pdfDoc;
    this.fonts = fonts;
    this.options = options;
    this.contentTop = PDF_CONFIG.PAGE_HEIGHT - PDF_CONFIG.MARGIN_TOP - PDF_CONFIG.HEADER_HEIGHT;
    this.contentBottom = PDF_CONFIG.MARGIN_BOTTOM + PDF_CONFIG.FOOTER_HEIGHT;
  }

  async newPage(): Promise<PDFPage> {
    this.pageCount++;
    this.currentPage = this.pdfDoc.addPage([PDF_CONFIG.PAGE_WIDTH, PDF_CONFIG.PAGE_HEIGHT]);
    this.currentY = this.contentTop;
    return this.currentPage;
  }

  getCurrentPage(): PDFPage {
    if (!this.currentPage) throw new Error("No active page");
    return this.currentPage;
  }

  getY(): number {
    return this.currentY;
  }

  setY(y: number): void {
    this.currentY = y;
  }

  moveDown(amount: number): void {
    this.currentY -= amount;
  }

  needsNewPage(requiredHeight: number): boolean {
    return this.currentY - requiredHeight < this.contentBottom;
  }

  getContentWidth(): number {
    return PDF_CONFIG.PAGE_WIDTH - PDF_CONFIG.MARGIN_LEFT - PDF_CONFIG.MARGIN_RIGHT;
  }

  getLeftMargin(): number {
    return PDF_CONFIG.MARGIN_LEFT;
  }

  getFonts(): FontSet {
    return this.fonts;
  }

  applyHeadersAndFooters(): void {
    const pages = this.pdfDoc.getPages();
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const pageNum = i + 1;

      if (this.options.includeDraft) {
        this.drawDraftWatermark(page);
      }
      this.drawHeader(page);
      this.drawFooter(page, pageNum, totalPages);
    }
  }

  private drawHeader(page: PDFPage): void {
    const y = PDF_CONFIG.PAGE_HEIGHT - PDF_CONFIG.MARGIN_TOP / 2 - 5;

    if (this.options.companyName) {
      page.drawText(this.options.companyName, {
        x: PDF_CONFIG.MARGIN_LEFT,
        y,
        size: PDF_CONFIG.FONT_SIZE_SMALL,
        font: this.fonts.bold,
        color: COLORS.TEXT_GRAY,
      });
    }

    // Draw line below header
    page.drawLine({
      start: { x: PDF_CONFIG.MARGIN_LEFT, y: y - 8 },
      end: { x: PDF_CONFIG.PAGE_WIDTH - PDF_CONFIG.MARGIN_RIGHT, y: y - 8 },
      thickness: 0.5,
      color: COLORS.BORDER,
    });
  }

  private drawFooter(page: PDFPage, pageNum: number, totalPages: number): void {
    const y = PDF_CONFIG.MARGIN_BOTTOM / 2;
    const pageText = `Page ${pageNum} of ${totalPages}`;
    const textWidth = this.fonts.regular.widthOfTextAtSize(pageText, PDF_CONFIG.FONT_SIZE_SMALL);

    // Draw line above footer
    page.drawLine({
      start: { x: PDF_CONFIG.MARGIN_LEFT, y: PDF_CONFIG.MARGIN_BOTTOM - 5 },
      end: { x: PDF_CONFIG.PAGE_WIDTH - PDF_CONFIG.MARGIN_RIGHT, y: PDF_CONFIG.MARGIN_BOTTOM - 5 },
      thickness: 0.5,
      color: COLORS.BORDER,
    });

    // Page number (centered)
    page.drawText(pageText, {
      x: (PDF_CONFIG.PAGE_WIDTH - textWidth) / 2,
      y,
      size: PDF_CONFIG.FONT_SIZE_SMALL,
      font: this.fonts.regular,
      color: COLORS.TEXT_GRAY,
    });
  }

  private drawDraftWatermark(page: PDFPage): void {
    const watermarkText = "DRAFT - FOR INTERNAL REVIEW ONLY";
    const textWidth = this.fonts.bold.widthOfTextAtSize(watermarkText, PDF_CONFIG.FONT_SIZE_BODY);

    page.drawText(watermarkText, {
      x: (PDF_CONFIG.PAGE_WIDTH - textWidth) / 2,
      y: PDF_CONFIG.PAGE_HEIGHT - PDF_CONFIG.MARGIN_TOP / 2 + 8,
      size: PDF_CONFIG.FONT_SIZE_BODY,
      font: this.fonts.bold,
      color: COLORS.DRAFT_RED,
    });
  }
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

export async function generatePdf(
  requirements: RequirementForExport[],
  options: ExportOptions
): Promise<Buffer> {
  switch (options.template) {
    case "compliance-matrix":
      return generateComplianceMatrixPdf(requirements, options);
    case "qa-format":
      return generateQAFormatPdf(requirements, options);
    default:
      throw new Error(`Unknown template: ${options.template}`);
  }
}

// =============================================================================
// COMPLIANCE MATRIX TEMPLATE
// =============================================================================

interface TableColumn {
  width: number;
  header: string;
}

async function generateComplianceMatrixPdf(
  requirements: RequirementForExport[],
  options: ExportOptions
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);
  const pageManager = new PDFPageManager(pdfDoc, fonts, options);

  const sortedRequirements = [...requirements].sort((a, b) => a.order - b.order);

  // Create first page
  await pageManager.newPage();

  // Draw title section
  drawTitleSection(pageManager, options, requirements, "Compliance Matrix");

  // Table configuration - adjusted widths for A4
  const tableColumns: TableColumn[] = [
    { width: 25, header: "#" },
    { width: 70, header: "Section" },
    { width: 160, header: "Requirement" },
    { width: 170, header: "Response" },
    { width: 60, header: "Status" },
  ];

  const headerHeight = 22;
  const cellPadding = 4;

  // Draw table header
  drawTableHeader(pageManager, tableColumns, headerHeight);

  // Draw each requirement row
  for (let i = 0; i < sortedRequirements.length; i++) {
    const req = sortedRequirements[i];
    const rowHeight = calculateRowHeight(req, tableColumns, fonts, cellPadding, options.companyName);

    // Check if we need a new page
    if (pageManager.needsNewPage(rowHeight + 10)) {
      await pageManager.newPage();
      drawTableHeader(pageManager, tableColumns, headerHeight);
    }

    drawTableRow(pageManager, req, i + 1, tableColumns, rowHeight, cellPadding, options.companyName);
  }

  // Apply headers and footers to all pages
  pageManager.applyHeadersAndFooters();

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function drawTitleSection(
  pageManager: PDFPageManager,
  options: ExportOptions,
  requirements: RequirementForExport[],
  subtitle: string
): void {
  const page = pageManager.getCurrentPage();
  const fonts = pageManager.getFonts();
  const x = pageManager.getLeftMargin();

  // Title
  page.drawText(options.projectName, {
    x,
    y: pageManager.getY(),
    size: PDF_CONFIG.FONT_SIZE_TITLE,
    font: fonts.bold,
    color: COLORS.TEXT_DARK,
  });
  pageManager.moveDown(24);

  // Subtitle
  page.drawText(subtitle, {
    x,
    y: pageManager.getY(),
    size: PDF_CONFIG.FONT_SIZE_HEADING,
    font: fonts.regular,
    color: COLORS.TEXT_GRAY,
  });
  pageManager.moveDown(20);

  // Company name if set
  if (options.companyName) {
    page.drawText(`Prepared by: ${options.companyName}`, {
      x,
      y: pageManager.getY(),
      size: PDF_CONFIG.FONT_SIZE_BODY,
      font: fonts.regular,
      color: COLORS.TEXT_DARK,
    });
    pageManager.moveDown(16);
  }

  // Generated date
  page.drawText(`Generated: ${formatDate(new Date())}`, {
    x,
    y: pageManager.getY(),
    size: PDF_CONFIG.FONT_SIZE_BODY,
    font: fonts.regular,
    color: COLORS.TEXT_GRAY,
  });
  pageManager.moveDown(16);

  // Deadline if set
  if (options.deadline) {
    page.drawText(`Submission Deadline: ${formatDate(options.deadline)}`, {
      x,
      y: pageManager.getY(),
      size: PDF_CONFIG.FONT_SIZE_BODY,
      font: fonts.bold,
      color: COLORS.DRAFT_RED,
    });
    pageManager.moveDown(16);
  }

  // Summary stats
  const answered = requirements.filter(r => r.status === "ANSWERED").length;
  const partial = requirements.filter(r => r.status === "PARTIAL").length;
  const unanswered = requirements.filter(r => r.status === "UNANSWERED").length;

  const statsText = `Total: ${requirements.length}  |  Answered: ${answered}  |  Partial: ${partial}  |  Unanswered: ${unanswered}`;
  page.drawText(statsText, {
    x,
    y: pageManager.getY(),
    size: PDF_CONFIG.FONT_SIZE_SMALL,
    font: fonts.regular,
    color: COLORS.TEXT_GRAY,
  });
  pageManager.moveDown(30);
}

function drawTableHeader(
  pageManager: PDFPageManager,
  columns: TableColumn[],
  headerHeight: number
): void {
  const page = pageManager.getCurrentPage();
  const fonts = pageManager.getFonts();
  let x = pageManager.getLeftMargin();
  const y = pageManager.getY();
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

  // Draw header background
  page.drawRectangle({
    x,
    y: y - headerHeight,
    width: totalWidth,
    height: headerHeight,
    color: COLORS.TABLE_HEADER_BG,
  });

  // Draw header text
  for (const col of columns) {
    page.drawText(col.header, {
      x: x + 4,
      y: y - headerHeight / 2 - 3,
      size: PDF_CONFIG.FONT_SIZE_SMALL,
      font: fonts.bold,
      color: COLORS.WHITE,
    });
    x += col.width;
  }

  pageManager.moveDown(headerHeight);
}

function calculateRowHeight(
  req: RequirementForExport,
  columns: TableColumn[],
  fonts: FontSet,
  padding: number,
  companyName: string | null
): number {
  const reqLines = wrapText(
    req.text + (req.isMandatory ? " *" : ""),
    fonts.regular,
    PDF_CONFIG.FONT_SIZE_SMALL,
    columns[2].width - padding * 2
  );

  const answerLines = wrapText(
    getResponseText(req, companyName),
    fonts.regular,
    PDF_CONFIG.FONT_SIZE_SMALL,
    columns[3].width - padding * 2
  );

  const maxLines = Math.max(reqLines.length, answerLines.length, 1);
  return Math.max(maxLines * PDF_CONFIG.LINE_HEIGHT + padding * 2, 24);
}

function drawTableRow(
  pageManager: PDFPageManager,
  req: RequirementForExport,
  index: number,
  columns: TableColumn[],
  rowHeight: number,
  padding: number,
  companyName: string | null
): void {
  const page = pageManager.getCurrentPage();
  const fonts = pageManager.getFonts();
  const startY = pageManager.getY();
  let x = pageManager.getLeftMargin();
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

  // Draw row border
  page.drawRectangle({
    x,
    y: startY - rowHeight,
    width: totalWidth,
    height: rowHeight,
    borderColor: COLORS.BORDER,
    borderWidth: 0.5,
  });

  // Cell contents
  const cells = [
    String(index),
    req.section || "-",
    req.text + (req.isMandatory ? " *" : ""),
    getResponseText(req, companyName),
    formatStatus(req.status),
  ];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const cellText = cells[i];
    const lines = wrapText(cellText, fonts.regular, PDF_CONFIG.FONT_SIZE_SMALL, col.width - padding * 2);

    let textY = startY - padding - PDF_CONFIG.FONT_SIZE_SMALL;
    for (const line of lines) {
      page.drawText(line, {
        x: x + padding,
        y: textY,
        size: PDF_CONFIG.FONT_SIZE_SMALL,
        font: fonts.regular,
        color: i === 4 ? getStatusColor(req.status) : COLORS.TEXT_DARK,
      });
      textY -= PDF_CONFIG.LINE_HEIGHT;
    }

    // Draw vertical cell divider
    if (i < columns.length - 1) {
      page.drawLine({
        start: { x: x + col.width, y: startY },
        end: { x: x + col.width, y: startY - rowHeight },
        thickness: 0.5,
        color: COLORS.BORDER,
      });
    }

    x += col.width;
  }

  pageManager.moveDown(rowHeight);
}

// =============================================================================
// Q&A FORMAT TEMPLATE
// =============================================================================

async function generateQAFormatPdf(
  requirements: RequirementForExport[],
  options: ExportOptions
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);
  const pageManager = new PDFPageManager(pdfDoc, fonts, options);

  const sortedRequirements = [...requirements].sort((a, b) => a.order - b.order);

  // Group by section
  const sections = new Map<string, RequirementForExport[]>();
  for (const req of sortedRequirements) {
    const section = req.section || "General";
    if (!sections.has(section)) {
      sections.set(section, []);
    }
    sections.get(section)!.push(req);
  }

  // Create first page and draw title section
  await pageManager.newPage();
  drawTitleSection(pageManager, options, requirements, "Response Document");

  let questionNumber = 1;
  for (const [sectionName, sectionReqs] of sections) {
    // Draw section header
    const sectionHeight = 35;
    if (pageManager.needsNewPage(sectionHeight)) {
      await pageManager.newPage();
    }
    drawSectionHeader(pageManager, sectionName);

    // Draw Q&A pairs
    for (const req of sectionReqs) {
      const qaHeight = calculateQAHeight(req, pageManager.getContentWidth(), fonts, options.companyName);

      if (pageManager.needsNewPage(qaHeight)) {
        await pageManager.newPage();
      }

      drawQAPair(pageManager, req, questionNumber, options.companyName);
      questionNumber++;
    }
  }

  // Apply headers and footers to all pages
  pageManager.applyHeadersAndFooters();

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function drawSectionHeader(pageManager: PDFPageManager, sectionName: string): void {
  const page = pageManager.getCurrentPage();
  const fonts = pageManager.getFonts();
  const x = pageManager.getLeftMargin();

  pageManager.moveDown(15);

  page.drawText(sectionName, {
    x,
    y: pageManager.getY(),
    size: PDF_CONFIG.FONT_SIZE_HEADING,
    font: fonts.bold,
    color: COLORS.TEXT_DARK,
  });

  // Underline
  const textWidth = fonts.bold.widthOfTextAtSize(sectionName, PDF_CONFIG.FONT_SIZE_HEADING);
  page.drawLine({
    start: { x, y: pageManager.getY() - 4 },
    end: { x: x + textWidth, y: pageManager.getY() - 4 },
    thickness: 1.5,
    color: COLORS.PRIMARY,
  });

  pageManager.moveDown(22);
}

function calculateQAHeight(
  req: RequirementForExport,
  contentWidth: number,
  fonts: FontSet,
  companyName: string | null
): number {
  const questionLines = wrapText(
    req.text + (req.isMandatory ? " (Mandatory)" : ""),
    fonts.regular,
    PDF_CONFIG.FONT_SIZE_BODY,
    contentWidth - 30
  );

  const responseText = getResponseText(req, companyName);
  const answerLines = wrapText(
    responseText || "[No response provided]",
    fonts.regular,
    PDF_CONFIG.FONT_SIZE_BODY,
    contentWidth - 30
  );

  return (questionLines.length + answerLines.length) * PDF_CONFIG.LINE_HEIGHT + 30;
}

function drawQAPair(
  pageManager: PDFPageManager,
  req: RequirementForExport,
  questionNumber: number,
  companyName: string | null
): void {
  const page = pageManager.getCurrentPage();
  const fonts = pageManager.getFonts();
  const x = pageManager.getLeftMargin();
  const contentWidth = pageManager.getContentWidth();

  // Question
  const questionPrefix = `Q${questionNumber}: `;
  const mandatoryTag = req.isMandatory ? " (Mandatory)" : "";

  page.drawText(questionPrefix, {
    x,
    y: pageManager.getY(),
    size: PDF_CONFIG.FONT_SIZE_BODY,
    font: fonts.bold,
    color: COLORS.TEXT_DARK,
  });

  const prefixWidth = fonts.bold.widthOfTextAtSize(questionPrefix, PDF_CONFIG.FONT_SIZE_BODY);
  const questionLines = wrapText(
    req.text + mandatoryTag,
    fonts.regular,
    PDF_CONFIG.FONT_SIZE_BODY,
    contentWidth - prefixWidth
  );

  let y = pageManager.getY();
  for (let i = 0; i < questionLines.length; i++) {
    page.drawText(questionLines[i], {
      x: i === 0 ? x + prefixWidth : x,
      y,
      size: PDF_CONFIG.FONT_SIZE_BODY,
      font: fonts.regular,
      color: COLORS.TEXT_DARK,
    });
    y -= PDF_CONFIG.LINE_HEIGHT;
  }

  pageManager.setY(y);
  pageManager.moveDown(6);

  // Answer
  const answerPrefix = `A${questionNumber}: `;
  const responseText = getResponseText(req, companyName);
  const answerText = responseText || "[No response provided]";
  const isPlaceholder = !responseText;

  page.drawText(answerPrefix, {
    x,
    y: pageManager.getY(),
    size: PDF_CONFIG.FONT_SIZE_BODY,
    font: fonts.bold,
    color: COLORS.PRIMARY,
  });

  const answerPrefixWidth = fonts.bold.widthOfTextAtSize(answerPrefix, PDF_CONFIG.FONT_SIZE_BODY);
  const answerLines = wrapText(
    answerText,
    fonts.regular,
    PDF_CONFIG.FONT_SIZE_BODY,
    contentWidth - answerPrefixWidth
  );

  y = pageManager.getY();
  for (let i = 0; i < answerLines.length; i++) {
    page.drawText(answerLines[i], {
      x: i === 0 ? x + answerPrefixWidth : x,
      y,
      size: PDF_CONFIG.FONT_SIZE_BODY,
      font: fonts.regular,
      color: isPlaceholder ? COLORS.TEXT_LIGHT : COLORS.TEXT_DARK,
    });
    y -= PDF_CONFIG.LINE_HEIGHT;
  }

  pageManager.setY(y);
  pageManager.moveDown(16);
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export function getPdfMimeType(): string {
  return "application/pdf";
}
