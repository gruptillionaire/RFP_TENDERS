/**
 * DOCX Document Generator
 *
 * Generates Word documents from project requirements with support
 * for different export templates.
 */

import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  Header,
  PageNumber,
  NumberFormat,
} from "docx";
import { generateAttestationStatement, ComplianceStatus } from "@/lib/attestation";

export type ExportTemplate = "compliance-matrix" | "qa-format";

export interface ExportOptions {
  template: ExportTemplate;
  includeDraft: boolean; // If true, add watermark
  projectName: string;
  companyName: string | null;
  deadline: Date | null;
}

export interface RequirementForExport {
  id: string;
  text: string;
  section: string | null;
  isMandatory: boolean;
  draftAnswer: string | null;
  status: "UNANSWERED" | "PARTIAL" | "ANSWERED";
  type: string;
  order: number;
  isAttestation?: boolean;
  complianceStatus?: ComplianceStatus;
  // NOTE: internalNotes is deliberately excluded - NEVER export
}

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

/**
 * Generate a Word document from requirements
 */
export async function generateDocx(
  requirements: RequirementForExport[],
  options: ExportOptions
): Promise<Buffer> {
  switch (options.template) {
    case "compliance-matrix":
      return generateComplianceMatrixDocx(requirements, options);
    case "qa-format":
      return generateQAFormatDocx(requirements, options);
    default:
      throw new Error(`Unknown template: ${options.template}`);
  }
}

/**
 * Generate Compliance Matrix format document
 * Table with columns: #, Section, Requirement, Response
 */
async function generateComplianceMatrixDocx(
  requirements: RequirementForExport[],
  options: ExportOptions
): Promise<Buffer> {
  const sortedRequirements = [...requirements].sort((a, b) => a.order - b.order);

  // Create table rows
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell("#", 600),
      createHeaderCell("Section", 1200),
      createHeaderCell("Requirement", 4000),
      createHeaderCell("Response", 5200),
    ],
  });

  const dataRows = sortedRequirements.map((req, index) =>
    new TableRow({
      children: [
        createDataCell(String(index + 1), 600),
        createDataCell(req.section || "-", 1200),
        createDataCell(req.text, 4000, req.isMandatory),
        createDataCell(getResponseText(req, options.companyName), 5200),
      ],
    })
  );

  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [
      {
        headers: options.includeDraft ? { default: createDraftHeader() } : undefined,
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: options.projectName,
                bold: true,
                size: 32,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
          }),

          // Subtitle with metadata
          new Paragraph({
            children: [
              new TextRun({
                text: `Compliance Matrix`,
                size: 24,
                color: "666666",
              }),
            ],
            spacing: { after: 100 },
          }),

          // Company name if set
          ...(options.companyName
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Prepared by: ${options.companyName}`,
                      size: 22,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
              ]
            : []),

          // Export date
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated: ${new Date().toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`,
                size: 22,
                color: "666666",
              }),
            ],
            spacing: { after: 400 },
          }),

          // Deadline if set
          ...(options.deadline
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Submission Deadline: ${options.deadline.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}`,
                      size: 22,
                      bold: true,
                      color: "CC0000",
                    }),
                  ],
                  spacing: { after: 400 },
                }),
              ]
            : []),

          // Summary stats
          new Paragraph({
            children: [
              new TextRun({
                text: `Total Requirements: ${requirements.length} | `,
                size: 20,
              }),
              new TextRun({
                text: `Answered: ${requirements.filter((r) => r.status === "ANSWERED").length} | `,
                size: 20,
                color: "22C55E",
              }),
              new TextRun({
                text: `Partial: ${requirements.filter((r) => r.status === "PARTIAL").length} | `,
                size: 20,
                color: "F59E0B",
              }),
              new TextRun({
                text: `Unanswered: ${requirements.filter((r) => r.status === "UNANSWERED").length}`,
                size: 20,
                color: "6B7280",
              }),
            ],
            spacing: { after: 400 },
          }),

          // Table
          table,
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Generate Q&A format document
 * Question/Answer pairs grouped by section
 */
async function generateQAFormatDocx(
  requirements: RequirementForExport[],
  options: ExportOptions
): Promise<Buffer> {
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

  // Build document content
  const children: Paragraph[] = [
    // Title
    new Paragraph({
      children: [
        new TextRun({
          text: options.projectName,
          bold: true,
          size: 32,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),

    // Subtitle
    new Paragraph({
      children: [
        new TextRun({
          text: `Response Document`,
          size: 24,
          color: "666666",
        }),
      ],
      spacing: { after: 100 },
    }),

    // Company name if set
    ...(options.companyName
      ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `Prepared by: ${options.companyName}`,
                size: 22,
              }),
            ],
            spacing: { after: 100 },
          }),
        ]
      : []),

    // Export date
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}`,
          size: 22,
          color: "666666",
        }),
      ],
      spacing: { after: 400 },
    }),
  ];

  // Add each section
  let questionNumber = 1;
  for (const [sectionName, sectionReqs] of sections) {
    // Section header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: sectionName,
            bold: true,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    // Questions and answers
    for (const req of sectionReqs) {
      // Question
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Q${questionNumber}: `,
              bold: true,
              size: 22,
            }),
            new TextRun({
              text: req.text,
              size: 22,
            }),
            ...(req.isMandatory
              ? [
                  new TextRun({
                    text: " (Mandatory)",
                    size: 20,
                    color: "DC2626",
                    bold: true,
                  }),
                ]
              : []),
          ],
          spacing: { before: 200, after: 100 },
        })
      );

      // Answer
      const responseText = getResponseText(req, options.companyName);
      const hasResponse = responseText.length > 0;
      const answerText = hasResponse ? responseText : "[No response provided]";
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `A${questionNumber}: `,
              bold: true,
              size: 22,
              color: "2563EB",
            }),
            new TextRun({
              text: answerText,
              size: 22,
              italics: !hasResponse,
              color: hasResponse ? "000000" : "9CA3AF",
            }),
          ],
          spacing: { after: 200 },
        })
      );

      questionNumber++;
    }
  }

  const doc = new Document({
    sections: [
      {
        headers: options.includeDraft ? { default: createDraftHeader() } : undefined,
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// Helper functions

function createHeaderCell(text: string, width: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            size: 20,
            color: "FFFFFF",
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "2563EB" },
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
  });
}

function createDataCell(
  text: string,
  width: number,
  isMandatory = false
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            size: 18,
          }),
          ...(isMandatory
            ? [
                new TextRun({
                  text: " *",
                  size: 18,
                  color: "DC2626",
                  bold: true,
                }),
              ]
            : []),
        ],
      }),
    ],
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
    },
  });
}

function createDraftHeader(): Header {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: "DRAFT - FOR INTERNAL REVIEW ONLY",
            bold: true,
            size: 20,
            color: "DC2626",
          }),
          new TextRun({
            text: "   |   Page ",
            size: 18,
            color: "9CA3AF",
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 18,
            color: "9CA3AF",
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

/**
 * Get the MIME type for DOCX files
 */
export function getDocxMimeType(): string {
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

/**
 * Generate a safe filename for the export
 */
export function generateExportFilename(
  projectName: string,
  template: ExportTemplate,
  format: "docx" | "pdf"
): string {
  const safeName = projectName
    .replace(/[^a-z0-9]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const date = new Date().toISOString().split("T")[0];
  const templateLabel = template === "compliance-matrix" ? "matrix" : "qa";

  return `${safeName}-${templateLabel}-${date}.${format}`;
}
