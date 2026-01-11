"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { type PlaceholderScanResult, getPlaceholderLabel } from "@/lib/export/placeholders";

interface ExistingExport {
  id: string;
  format: string;
  template: string;
  isDraft: boolean;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onRequirementClick?: (id: string) => void;
}

type ExportFormat = "docx" | "pdf";
type ExportTemplate = "compliance-matrix" | "qa-format";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTemplateLabel(template: string): string {
  return template === "compliance-matrix" ? "Compliance Matrix" : "Q&A Format";
}

export function ExportDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onRequirementClick,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("docx");
  const [template, setTemplate] = useState<ExportTemplate>("compliance-matrix");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [scanResult, setScanResult] = useState<PlaceholderScanResult | null>(null);
  const [existingExports, setExistingExports] = useState<ExistingExport[]>([]);
  const [showBlockers, setShowBlockers] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Check for blockers and list exports when dialog opens
  const checkForBlockers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export`);
      if (res.ok) {
        const data = await res.json();
        setScanResult(data.placeholders);
        setExistingExports(data.existingExports || []);
        if (data.hasBlockers) {
          setShowBlockers(true);
        }
      }
    } catch (error) {
      console.error("Failed to check export status:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      checkForBlockers();
      setShowBlockers(false);
    }
  }, [open, checkForBlockers]);

  async function handleExport(forceDraft = false) {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, template, forceDraft }),
      });

      if (res.ok) {
        // Download the file
        const blob = await res.blob();
        const contentDisposition = res.headers.get("Content-Disposition");
        const filename = contentDisposition?.split("filename=")[1]?.replace(/"/g, "") || `export.${format}`;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        // Refresh exports list
        checkForBlockers();
      } else {
        const data = await res.json();
        if (res.status === 422) {
          setScanResult(data.placeholders);
          setShowBlockers(true);
        } else {
          alert(data.error || "Failed to export");
        }
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownload(exportId: string, fileName: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/export/${exportId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        alert("Failed to download export");
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download. Please try again.");
    }
  }

  async function handleDelete(exportId: string) {
    if (!confirm("Delete this export? This cannot be undone.")) return;

    setDeletingId(exportId);
    try {
      const res = await fetch(`/api/projects/${projectId}/export/${exportId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setExistingExports((prev) => prev.filter((e) => e.id !== exportId));
      } else {
        alert("Failed to delete export");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleRequirementClick(id: string) {
    onOpenChange(false);
    onRequirementClick?.(id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Project</DialogTitle>
          <DialogDescription>
            Export &quot;{projectName}&quot; to Word or PDF format.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : showBlockers && scanResult?.hasBlockers ? (
          <div className="space-y-4">
            {/* Blocker Warning UI */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="font-medium text-amber-800">Unfinished Content Detected</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    {scanResult.totalCount} placeholder(s) found that need attention.
                  </p>
                </div>
              </div>
            </div>

            {/* Placeholder Summary by Type */}
            <div className="space-y-2">
              {Object.entries(scanResult.byType).map(([type, matches]) =>
                matches.length > 0 ? (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{getPlaceholderLabel(type as keyof typeof scanResult.byType)}</span>
                    <Badge variant="secondary">{matches.length}</Badge>
                  </div>
                ) : null
              )}
            </div>

            {/* Clickable Requirements List */}
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
              {scanResult.requirements.map((req) => (
                <button
                  key={req.id}
                  onClick={() => handleRequirementClick(req.id)}
                  className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">#{req.index + 1}</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {req.placeholders.slice(0, 3).map((p, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {p.match.length > 20 ? p.match.slice(0, 20) + "..." : p.match}
                        </Badge>
                      ))}
                      {req.placeholders.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{req.placeholders.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{req.text}</p>
                </button>
              ))}
            </div>

            <Button variant="ghost" onClick={() => setShowBlockers(false)} className="w-full">
              Continue to Export Options
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Export History */}
            {existingExports.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Previous Exports</h3>
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {existingExports.map((exp) => (
                    <div key={exp.id} className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{getTemplateLabel(exp.template)}</span>
                          <Badge variant="outline" className="text-xs uppercase">
                            {exp.format}
                          </Badge>
                          {exp.isDraft && (
                            <Badge variant="secondary" className="text-xs">
                              Draft
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatDate(exp.createdAt)} &middot; {formatFileSize(exp.fileSize)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(exp.id, exp.fileName)}
                          className="h-8 px-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(exp.id)}
                          disabled={deletingId === exp.id}
                          className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingId === exp.id ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Export Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Create New Export</h3>

              {/* Format Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Format</label>
                <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="docx">Microsoft Word (.docx)</SelectItem>
                    <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Template</label>
                <Select value={template} onValueChange={(v) => setTemplate(v as ExportTemplate)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compliance-matrix">Compliance Matrix (Table)</SelectItem>
                    <SelectItem value="qa-format">Question & Answer</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {template === "compliance-matrix"
                    ? "Table format with requirement, response, and status columns."
                    : "Q&A format grouped by section."}
                </p>
              </div>

              {/* Warning if blockers exist */}
              {scanResult?.hasBlockers && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-700">
                    <strong>{scanResult.totalCount} placeholder(s)</strong> detected.{" "}
                    <button
                      onClick={() => setShowBlockers(true)}
                      className="text-amber-800 underline hover:no-underline"
                    >
                      View details
                    </button>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!showBlockers && !isLoading && (
            <>
              {scanResult?.hasBlockers ? (
                <Button onClick={() => handleExport(true)} disabled={isExporting}>
                  {isExporting ? "Exporting..." : "Export as Draft (Watermarked)"}
                </Button>
              ) : (
                <Button onClick={() => handleExport(false)} disabled={isExporting}>
                  {isExporting ? "Exporting..." : "Export"}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
