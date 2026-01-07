"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MatrixOverview } from "@/components/MatrixOverview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RequirementType = "CONTEXTUAL" | "PROCEDURAL" | "DECLARATIVE" | "DESCRIPTIVE" | "EVIDENCE_BASED";
type DomainContext = "FEATURE" | "PROCESS" | "LEGAL";
type SortOption = "order" | "mandatory" | "status" | "section" | "type";

interface Requirement {
  id: string;
  text: string;
  section: string | null;
  isMandatory: boolean;
  draftAnswer: string | null;
  internalNotes: string | null;
  wordLimit: number | null;
  characterLimit: number | null;
  status: "UNANSWERED" | "PARTIAL" | "ANSWERED";
  type: RequirementType;
  domainContext?: DomainContext;
  requiresReview?: boolean;
  order: number;
}

interface ComplianceMatrixProps {
  requirements: Requirement[];
  onStatusChange: (id: string, status: Requirement["status"]) => void;
  onDraftChange: (id: string, draft: string) => void;
  onGenerateDraft: (id: string) => void;
  onTypeChange: (id: string, type: RequirementType) => void;
  onDomainChange: (id: string, domain: DomainContext) => void;
  onInternalNotesChange: (id: string, notes: string) => void;
  generatingIds: Set<string>;
}

// Helper functions for requirement types
const getTextareaRows = (type: RequirementType): number => {
  switch (type) {
    case "CONTEXTUAL":
      return 0; // No response needed
    case "PROCEDURAL":
      return 2; // Small for simple confirmations
    case "DECLARATIVE":
      return 3; // Medium for compliance statements
    case "EVIDENCE_BASED":
      return 4; // Medium-large for documentation references
    case "DESCRIPTIVE":
      return 6; // Large for detailed explanations
    default:
      return 4;
  }
};

const getPlaceholder = (type: RequirementType): string => {
  switch (type) {
    case "CONTEXTUAL":
      return "No response required - this is background context.";
    case "PROCEDURAL":
      return "Confirm compliance briefly (1-2 sentences)...";
    case "DECLARATIVE":
      return "State your compliance position (2-3 sentences)...";
    case "DESCRIPTIVE":
      return "Provide detailed explanation of your approach...";
    case "EVIDENCE_BASED":
      return "Reference specific documents, certifications, or evidence...";
    default:
      return "Enter your response...";
  }
};

const getTypeBadgeColor = (type: RequirementType): string => {
  switch (type) {
    case "CONTEXTUAL":
      return "bg-gray-100 text-gray-600 border-gray-300";
    case "PROCEDURAL":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "DECLARATIVE":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "DESCRIPTIVE":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "EVIDENCE_BASED":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const formatTypeName = (type: RequirementType): string => {
  switch (type) {
    case "CONTEXTUAL":
      return "Context";
    case "PROCEDURAL":
      return "Procedural";
    case "DECLARATIVE":
      return "Declarative";
    case "DESCRIPTIVE":
      return "Descriptive";
    case "EVIDENCE_BASED":
      return "Evidence";
    default:
      return type;
  }
};

// Helper functions for domain context
const getDomainBadgeColor = (domain: DomainContext): string => {
  switch (domain) {
    case "FEATURE":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "PROCESS":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "LEGAL":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-600 border-gray-200";
  }
};

const getDomainIcon = (domain: DomainContext): string => {
  switch (domain) {
    case "FEATURE":
      return "F";
    case "PROCESS":
      return "P";
    case "LEGAL":
      return "L";
    default:
      return "?";
  }
};

// Status order for sorting
const STATUS_ORDER: Record<string, number> = {
  UNANSWERED: 0,
  PARTIAL: 1,
  ANSWERED: 2,
};

// Memoized RequirementRow component to prevent unnecessary re-renders
interface RequirementRowProps {
  req: Requirement;
  index: number;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onStatusChange: (id: string, status: Requirement["status"]) => void;
  onTypeChange: (id: string, type: RequirementType) => void;
  onDomainChange: (id: string, domain: DomainContext) => void;
  onDraftChange: (id: string, draft: string) => void;
  onInternalNotesChange: (id: string, notes: string) => void;
  onGenerateDraft: (id: string) => void;
  onCopy: (text: string, id: string) => void;
  isGenerating: boolean;
  isCopied: boolean;
}

const RequirementRow = React.memo(function RequirementRow({
  req,
  index,
  isExpanded,
  onToggle,
  onStatusChange,
  onTypeChange,
  onDomainChange,
  onDraftChange,
  onInternalNotesChange,
  onGenerateDraft,
  onCopy,
  isGenerating,
  isCopied,
}: RequirementRowProps) {
  const getStatusColor = (status: Requirement["status"]) => {
    switch (status) {
      case "ANSWERED":
        return "bg-green-100 text-green-800";
      case "PARTIAL":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Stable click handler using the row's req.id
  const handleRowClick = useCallback(() => {
    onToggle(req.id);
  }, [onToggle, req.id]);

  return (
    <React.Fragment>
      <TableRow
        data-req-id={req.id}
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleRowClick}
      >
        <TableCell className="font-medium">{index + 1}</TableCell>
        <TableCell>
          <div className="max-w-xl">
            <p className="line-clamp-2 text-ellipsis overflow-hidden">{req.text}</p>
            {req.text.length > 100 && (
              <span className="text-xs text-blue-500 mt-1 inline-block">
                (click to expand)
              </span>
            )}
            {req.section && (
              <span className="text-xs text-gray-400 mt-1 block truncate">{req.section}</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          {req.isMandatory ? (
            <Badge variant="destructive">Mandatory</Badge>
          ) : (
            <Badge variant="secondary">Optional</Badge>
          )}
        </TableCell>
        <TableCell>
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Select
              value={req.type}
              onValueChange={(v) => onTypeChange(req.id, v as RequirementType)}
            >
              <SelectTrigger className={`h-7 w-[105px] text-xs font-medium border ${getTypeBadgeColor(req.type)}`}>
                <SelectValue>{formatTypeName(req.type)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTEXTUAL">Context</SelectItem>
                <SelectItem value="PROCEDURAL">Procedural</SelectItem>
                <SelectItem value="DECLARATIVE">Declarative</SelectItem>
                <SelectItem value="DESCRIPTIVE">Descriptive</SelectItem>
                <SelectItem value="EVIDENCE_BASED">Evidence</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`h-7 w-9 text-xs font-semibold border rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 ${getDomainBadgeColor(req.domainContext || "FEATURE")}`}
                  title={`Domain: ${req.domainContext || "FEATURE"}`}
                >
                  {getDomainIcon(req.domainContext || "FEATURE")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onDomainChange(req.id, "FEATURE")}>
                  <span className="w-5 h-5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center text-xs font-semibold mr-2">F</span>
                  Feature
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDomainChange(req.id, "PROCESS")}>
                  <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center text-xs font-semibold mr-2">P</span>
                  Process
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDomainChange(req.id, "LEGAL")}>
                  <span className="w-5 h-5 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center justify-center text-xs font-semibold mr-2">L</span>
                  Legal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {req.requiresReview && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-100 text-yellow-700 text-[10px]"
                title="Requires manual review"
              >
                !
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Select
            value={req.status}
            onValueChange={(v) => onStatusChange(req.id, v as Requirement["status"])}
          >
            <SelectTrigger className={`w-full ${getStatusColor(req.status)}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNANSWERED">Unanswered</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="ANSWERED">Answered</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(req.id);
            }}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-gray-50 p-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Full Requirement</h4>
                <p className="text-gray-700 bg-white p-3 rounded border">
                  {req.text}
                </p>
              </div>
              {req.type === "CONTEXTUAL" ? (
                <div className="bg-gray-100 p-4 rounded border border-gray-200 text-center">
                  <p className="text-gray-500 italic">
                    This is background context information. No response is required.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">Draft Response</h4>
                        <span className={`text-xs px-2 py-0.5 rounded ${getTypeBadgeColor(req.type)}`}>
                          {formatTypeName(req.type)}
                        </span>
                        {req.domainContext && (
                          <span className={`text-xs px-2 py-0.5 rounded border ${getDomainBadgeColor(req.domainContext)}`}>
                            {req.domainContext === "FEATURE" ? "Feature" : req.domainContext === "PROCESS" ? "Process" : "Legal"}
                          </span>
                        )}
                        {req.requiresReview && (
                          <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200">
                            Review Required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {req.draftAnswer && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCopy(req.draftAnswer || "", req.id)}
                            title="Copy to clipboard (without [DRAFT] tag)"
                          >
                            {isCopied ? (
                              <>
                                <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onGenerateDraft(req.id)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating...
                            </>
                          ) : req.draftAnswer ? (
                            "Regenerate"
                          ) : (
                            "Generate Draft"
                          )}
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      placeholder={getPlaceholder(req.type)}
                      value={req.draftAnswer || ""}
                      onChange={(e) => onDraftChange(req.id, e.target.value)}
                      rows={getTextareaRows(req.type)}
                      className="bg-white"
                    />
                    {/* Word/Character count */}
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-xs text-gray-400">
                        {req.type === "PROCEDURAL" && "Tip: Keep procedural responses brief (1-2 sentences)."}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {req.wordLimit && (
                          <span className={getLimitStatusColor(countWords(req.draftAnswer || ""), req.wordLimit)}>
                            {countWords(req.draftAnswer || "")} / {req.wordLimit} words
                            {countWords(req.draftAnswer || "") > req.wordLimit && " (over limit)"}
                          </span>
                        )}
                        {req.characterLimit && (
                          <span className={getLimitStatusColor((req.draftAnswer || "").length, req.characterLimit)}>
                            {(req.draftAnswer || "").length} / {req.characterLimit} chars
                            {(req.draftAnswer || "").length > req.characterLimit && " (over limit)"}
                          </span>
                        )}
                        {!req.wordLimit && !req.characterLimit && (
                          <span className="text-gray-400">
                            {countWords(req.draftAnswer || "")} words | {(req.draftAnswer || "").length} chars
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Internal Notes */}
                  <div>
                    <h4 className="font-medium text-gray-600 mb-2 text-sm">Internal Notes</h4>
                    <Textarea
                      placeholder="Add private notes (not included in export)..."
                      value={req.internalNotes || ""}
                      onChange={(e) => onInternalNotesChange(req.id, e.target.value)}
                      rows={2}
                      className="bg-gray-100 border-gray-200 text-sm italic"
                    />
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
});

// Helper to count words
const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(Boolean).length;
};

// Helper to get limit status color
const getLimitStatusColor = (current: number, limit: number): string => {
  const percentage = (current / limit) * 100;
  if (percentage > 100) return "text-red-600";
  if (percentage >= 80) return "text-yellow-600";
  return "text-gray-500";
};

export function ComplianceMatrix({
  requirements,
  onStatusChange,
  onDraftChange,
  onGenerateDraft,
  onTypeChange,
  onDomainChange,
  onInternalNotesChange,
  generatingIds,
}: ComplianceMatrixProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unanswered" | "partial" | "answered">("all");
  const [sortBy, setSortBy] = useState<SortOption>("order");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Get unique sections - MEMOIZED
  const sections = useMemo(() =>
    [...new Set(requirements.map(r => r.section).filter(Boolean))] as string[],
    [requirements]
  );

  // Copy to clipboard handler
  const handleCopy = useCallback(async (text: string, id: string) => {
    // Strip [DRAFT] tag when copying
    const cleanText = text.replace(/\n\n\[DRAFT\]$/, "").trim();
    await navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Calculate section stats - MEMOIZED
  const sectionStats = useMemo(() =>
    sections.map(section => {
      const sectionReqs = requirements.filter(r => r.section === section);
      const answered = sectionReqs.filter(r => r.status === "ANSWERED").length;
      return {
        name: section,
        total: sectionReqs.length,
        answered,
        percentage: sectionReqs.length > 0 ? Math.round((answered / sectionReqs.length) * 100) : 0,
      };
    }),
    [sections, requirements]
  );

  // Stable toggle handler for memoized rows
  const handleToggle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleMatrixClick = useCallback((id: string) => {
    // Clear filters to ensure the requirement is visible
    setFilter("all");
    setActiveSection(null);
    // Expand the requirement
    setExpandedId(id);
    // Scroll to the requirement after a short delay to allow filter change and re-render
    setTimeout(() => {
      const row = tableContainerRef.current?.querySelector(`[data-req-id="${id}"]`) as HTMLElement | null;
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        // Flash effect to highlight
        row.classList.add("bg-blue-50");
        setTimeout(() => row.classList.remove("bg-blue-50"), 1500);
      }
    }, 100);
  }, []);

  // Filter and sort requirements - MEMOIZED
  const sortedRequirements = useMemo(() => {
    // Filter by status and section
    const filtered = requirements.filter((req) => {
      if (filter !== "all" && req.status.toLowerCase() !== filter) return false;
      if (activeSection && req.section !== activeSection) return false;
      return true;
    });

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "mandatory":
          return (b.isMandatory ? 1 : 0) - (a.isMandatory ? 1 : 0) || a.order - b.order;
        case "status":
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.order - b.order;
        case "section":
          return (a.section || "").localeCompare(b.section || "") || a.order - b.order;
        case "type":
          return a.type.localeCompare(b.type) || a.order - b.order;
        default:
          return a.order - b.order;
      }
    });
  }, [requirements, filter, activeSection, sortBy]);

  // Stats - MEMOIZED with single-pass computation for efficiency
  const stats = useMemo(() => {
    let answered = 0;
    let partial = 0;
    let unanswered = 0;
    for (const r of requirements) {
      if (r.status === "ANSWERED") answered++;
      else if (r.status === "PARTIAL") partial++;
      else unanswered++;
    }
    return { total: requirements.length, answered, partial, unanswered };
  }, [requirements]);

  // MatrixOverview requirements - MEMOIZED to avoid creating new objects on each render
  const matrixRequirements = useMemo(() =>
    requirements.map(r => ({
      id: r.id,
      status: r.status,
      isMandatory: r.isMandatory,
    })),
    [requirements]
  );

  // Section counts - MEMOIZED for section tabs
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const req of requirements) {
      if (req.section) {
        counts[req.section] = (counts[req.section] || 0) + 1;
      }
    }
    return counts;
  }, [requirements]);

  // Stable estimateSize function - uses fixed estimates to avoid recalculation loops
  // The virtualizer will measure actual sizes and cache them
  const estimateSize = useCallback(() => 56, []); // Base collapsed height

  // Virtualizer for large lists - only render visible rows
  const rowVirtualizer = useVirtualizer({
    count: sortedRequirements.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize,
    overscan: 5, // Render 5 extra rows above/below viewport for smooth scrolling
    // Enable dynamic measurement for accurate row heights when expanded
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  // Notify virtualizer when expanded state changes so it can remeasure
  useEffect(() => {
    rowVirtualizer.measure();
  }, [expandedId, rowVirtualizer]);

  return (
    <div className="space-y-4">
      {/* Matrix Overview */}
      <MatrixOverview
        requirements={matrixRequirements}
        onRequirementClick={handleMatrixClick}
      />

      {/* Stats bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
        <div className="flex gap-6">
          <div>
            <span className="text-2xl font-bold">{stats.total}</span>
            <span className="text-gray-500 ml-2">Total</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-green-600">{stats.answered}</span>
            <span className="text-gray-500 ml-2">Answered</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-yellow-600">{stats.partial}</span>
            <span className="text-gray-500 ml-2">Partial</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-gray-600">{stats.unanswered}</span>
            <span className="text-gray-500 ml-2">Unanswered</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Sort:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order">Default</SelectItem>
                <SelectItem value="mandatory">Mandatory First</SelectItem>
                <SelectItem value="status">By Status</SelectItem>
                <SelectItem value="section">By Section</SelectItem>
                <SelectItem value="type">By Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filter:</span>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unanswered">Unanswered</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="answered">Answered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      {sections.length > 0 && (
        <div className="flex flex-wrap gap-2 bg-white p-3 rounded-lg border">
          <button
            onClick={() => setActiveSection(null)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              activeSection === null
                ? "bg-blue-100 text-blue-800 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({requirements.length})
          </button>
          {sections.map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                activeSection === section
                  ? "bg-blue-100 text-blue-800 font-medium"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {section} ({sectionCounts[section] || 0})
            </button>
          ))}
        </div>
      )}

      {/* Section progress bars */}
      {sections.length > 0 && sectionStats.length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Progress by Section</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sectionStats.map((section) => (
              <button
                key={section.name}
                onClick={() => setActiveSection(section.name)}
                className={`text-left p-2 rounded border transition-colors ${
                  activeSection === section.name
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium truncate">{section.name}</span>
                  <span className="text-xs text-gray-500">{section.answered}/{section.total}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${section.percentage}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${stats.total > 0 ? (stats.answered / stats.total) * 100 : 0}%` }}
        />
      </div>

      {/* Requirements table with virtualization */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead className="w-28">Req. Type</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
        {/* Virtualized scrollable container */}
        <div
          ref={tableContainerRef}
          className="overflow-auto"
          style={{ maxHeight: "600px" }}
        >
          <Table>
            <TableBody>
              {/* Spacer for items above viewport */}
              <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px` }} />
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const req = sortedRequirements[virtualRow.index];
                return (
                  <RequirementRow
                    key={req.id}
                    req={req}
                    index={virtualRow.index}
                    isExpanded={expandedId === req.id}
                    onToggle={handleToggle}
                    onStatusChange={onStatusChange}
                    onTypeChange={onTypeChange}
                    onDomainChange={onDomainChange}
                    onDraftChange={onDraftChange}
                    onInternalNotesChange={onInternalNotesChange}
                    onGenerateDraft={onGenerateDraft}
                    onCopy={handleCopy}
                    isGenerating={generatingIds.has(req.id)}
                    isCopied={copiedId === req.id}
                  />
                );
              })}
              {/* Spacer for items below viewport */}
              <tr style={{ height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0)}px` }} />
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
