"use client";

import React, { useState, useRef, useCallback } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RequirementType = "PROCEDURAL" | "DECLARATIVE" | "DESCRIPTIVE" | "EVIDENCE_BASED";
type DomainContext = "FEATURE" | "PROCESS" | "LEGAL";

interface Requirement {
  id: string;
  text: string;
  section: string | null;
  isMandatory: boolean;
  draftAnswer: string | null;
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
  generatingIds: Set<string>;
}

// Helper functions for requirement types
const getTextareaRows = (type: RequirementType): number => {
  switch (type) {
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

export function ComplianceMatrix({
  requirements,
  onStatusChange,
  onDraftChange,
  onGenerateDraft,
  generatingIds,
}: ComplianceMatrixProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unanswered" | "partial" | "answered">("all");
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const handleMatrixClick = useCallback((id: string) => {
    // Clear filter to ensure the requirement is visible
    setFilter("all");
    // Expand the requirement
    setExpandedId(id);
    // Scroll to the requirement after a short delay to allow filter change
    setTimeout(() => {
      const row = rowRefs.current.get(id);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        // Flash effect to highlight
        row.classList.add("bg-blue-50");
        setTimeout(() => row.classList.remove("bg-blue-50"), 1500);
      }
    }, 50);
  }, []);

  const filteredRequirements = requirements.filter((req) => {
    if (filter === "all") return true;
    return req.status.toLowerCase() === filter;
  });

  const stats = {
    total: requirements.length,
    answered: requirements.filter((r) => r.status === "ANSWERED").length,
    partial: requirements.filter((r) => r.status === "PARTIAL").length,
    unanswered: requirements.filter((r) => r.status === "UNANSWERED").length,
  };

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

  return (
    <div className="space-y-4">
      {/* Matrix Overview */}
      <MatrixOverview
        requirements={requirements.map(r => ({
          id: r.id,
          status: r.status,
          isMandatory: r.isMandatory,
        }))}
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

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${stats.total > 0 ? (stats.answered / stats.total) * 100 : 0}%` }}
        />
      </div>

      {/* Requirements table */}
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
          <TableBody>
            {filteredRequirements.map((req, index) => (
              <React.Fragment key={req.id}>
                <TableRow
                  ref={(el) => {
                    if (el) rowRefs.current.set(req.id, el);
                  }}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                >
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <div className="max-w-xl">
                      <p className="line-clamp-2">{req.text}</p>
                      {req.text.length > 120 && (
                        <span className="text-xs text-blue-500 mt-1 inline-block">
                          ... (click to expand)
                        </span>
                      )}
                      {req.section && (
                        <span className="text-xs text-gray-400 mt-1 block">{req.section}</span>
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
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getTypeBadgeColor(req.type)}`}>
                        {formatTypeName(req.type)}
                      </span>
                      {req.domainContext && (
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold border ${getDomainBadgeColor(req.domainContext)}`}
                          title={`Domain: ${req.domainContext}`}
                        >
                          {getDomainIcon(req.domainContext)}
                        </span>
                      )}
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
                        setExpandedId(expandedId === req.id ? null : req.id);
                      }}
                    >
                      {expandedId === req.id ? "Collapse" : "Expand"}
                    </Button>
                  </TableCell>
                </TableRow>
                {expandedId === req.id && (
                  <TableRow key={`${req.id}-expanded`}>
                    <TableCell colSpan={6} className="bg-gray-50 p-4">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Full Requirement</h4>
                          <p className="text-gray-700 bg-white p-3 rounded border">
                            {req.text}
                          </p>
                        </div>
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onGenerateDraft(req.id)}
                              disabled={generatingIds.has(req.id)}
                            >
                              {generatingIds.has(req.id) ? (
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
                          <Textarea
                            placeholder={getPlaceholder(req.type)}
                            value={req.draftAnswer || ""}
                            onChange={(e) => onDraftChange(req.id, e.target.value)}
                            rows={getTextareaRows(req.type)}
                            className="bg-white"
                          />
                          {req.type === "PROCEDURAL" && (
                            <p className="text-xs text-gray-400 mt-1">
                              Tip: Keep procedural responses brief (1-2 sentences).
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
