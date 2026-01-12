"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MatrixOverview } from "@/components/MatrixOverview";
import { VersionHistoryModal } from "@/components/VersionHistoryModal";
import {
  RequirementFilters,
  FilterState,
  defaultFilters,
  applyFilters,
  calculateFilterCounts,
} from "@/components/RequirementFilters";
import { AddRequirementDialog } from "@/components/AddRequirementDialog";
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
import { getMajorCategory, buildCategoryTitleMap } from "@/lib/compliance-scoring";

type RequirementType = "CONTEXTUAL" | "PROCEDURAL" | "DECLARATIVE" | "DESCRIPTIVE" | "EVIDENCE_BASED" | "QUANTITATIVE" | "REFERENCE_BASED" | "STAFFING";
type DomainContext = "FEATURE" | "PROCESS" | "LEGAL";
type ComplianceStatus = "PENDING" | "COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE";
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
  isAttestation?: boolean;
  complianceStatus?: ComplianceStatus;
}

interface ComplianceMatrixProps {
  requirements: Requirement[];
  onStatusChange: (id: string, status: Requirement["status"]) => void;
  onDraftChange: (id: string, draft: string) => void;
  onGenerateDraft: (id: string) => void;
  onTypeChange: (id: string, type: RequirementType) => void;
  onDomainChange: (id: string, domain: DomainContext) => void;
  onInternalNotesChange: (id: string, notes: string) => void;
  onComplianceChange?: (id: string, status: ComplianceStatus) => void;
  onAttestationToggle?: (id: string, isAttestation: boolean) => void;
  generatingIds: Set<string>;
  onSaveToLibrary?: (id: string, content: string, requirement: Requirement) => void;
  onInsertFromLibrary?: (id: string) => void;
  onAddRequirement?: (requirement: Requirement) => void;
  projectId?: string;
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
    case "QUANTITATIVE":
      return 5; // Medium-large for pricing/metrics tables
    case "REFERENCE_BASED":
      return 6; // Large for multiple references
    case "STAFFING":
      return 5; // Medium-large for team details
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
    case "QUANTITATIVE":
      return "Provide pricing, metrics, or numerical data in structured format...";
    case "REFERENCE_BASED":
      return "List references with client name, project, dates, and contact info...";
    case "STAFFING":
      return "Identify team members with roles, qualifications, and experience...";
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
    case "QUANTITATIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "REFERENCE_BASED":
      return "bg-cyan-100 text-cyan-800 border-cyan-200";
    case "STAFFING":
      return "bg-amber-100 text-amber-800 border-amber-200";
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
    case "QUANTITATIVE":
      return "Quantitative";
    case "REFERENCE_BASED":
      return "Reference";
    case "STAFFING":
      return "Staffing";
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
  onSaveToLibrary?: (id: string, content: string, requirement: Requirement) => void;
  onInsertFromLibrary?: (id: string) => void;
  onShowHistory: (id: string) => void;
  onComplianceChange?: (id: string, status: ComplianceStatus) => void;
  onAttestationToggle?: (id: string, isAttestation: boolean) => void;
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
  onSaveToLibrary,
  onInsertFromLibrary,
  onShowHistory,
  onComplianceChange,
  onAttestationToggle,
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
        id={`requirement-${req.id}`}
        data-req-id={req.id}
        className={`cursor-pointer hover:bg-gray-50 transition-colors ${
          req.isAttestation && req.complianceStatus === "NON_COMPLIANT" && req.isMandatory
            ? "bg-red-50"
            : ""
        }`}
        onClick={handleRowClick}
      >
        <TableCell className="font-medium">{index + 1}</TableCell>
        <TableCell>
          <div className="max-w-xl">
            <p className="line-clamp-2 text-ellipsis overflow-hidden break-words">{req.text}</p>
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
                <SelectItem value="QUANTITATIVE">Quantitative</SelectItem>
                <SelectItem value="REFERENCE_BASED">Reference</SelectItem>
                <SelectItem value="STAFFING">Staffing</SelectItem>
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
            {req.type === "CONTEXTUAL" && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600"
                title="For internal reference only - not included in exports"
              >
                Internal
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
                <p className="text-gray-700 bg-white p-3 rounded border break-words whitespace-pre-wrap">
                  {req.text}
                </p>
              </div>
              {req.type === "CONTEXTUAL" ? (
                <div className="bg-gray-100 p-4 rounded border border-gray-300">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Internal Use Only</p>
                      <p className="text-sm text-gray-500 mt-1">
                        This is background context from the RFP. No response is required and it will not be included in document exports.
                      </p>
                    </div>
                  </div>
                </div>
              ) : req.isAttestation ? (
                /* Attestation UI - Radio buttons for compliance status */
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">
                          Attestation Item
                        </span>
                        {req.isMandatory && (
                          <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                            Mandatory
                          </span>
                        )}
                      </div>
                      {onAttestationToggle && (
                        <button
                          onClick={() => onAttestationToggle(req.id, false)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Switch to Written Response
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-4">
                      Select your compliance status for this requirement:
                    </p>

                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`compliance-${req.id}`}
                          checked={req.complianceStatus === "COMPLIANT"}
                          onChange={() => onComplianceChange?.(req.id, "COMPLIANT")}
                          className="w-4 h-4 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-green-700 font-medium">Compliant</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`compliance-${req.id}`}
                          checked={req.complianceStatus === "NON_COMPLIANT"}
                          onChange={() => onComplianceChange?.(req.id, "NON_COMPLIANT")}
                          className="w-4 h-4 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-red-700 font-medium">Non-Compliant</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`compliance-${req.id}`}
                          checked={req.complianceStatus === "NOT_APPLICABLE"}
                          onChange={() => onComplianceChange?.(req.id, "NOT_APPLICABLE")}
                          className="w-4 h-4 text-gray-600 focus:ring-gray-500"
                        />
                        <span className="text-gray-600 font-medium">N/A</span>
                      </label>
                    </div>

                    {req.complianceStatus === "COMPLIANT" && (
                      <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Attestation statement will be auto-generated in export.
                      </p>
                    )}

                    {req.complianceStatus === "NON_COMPLIANT" && req.isMandatory && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-red-800">Warning: Mandatory Requirement</p>
                            <p className="text-xs text-red-700 mt-1">
                              Non-compliance with this mandatory requirement may disqualify your proposal.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Internal Notes - also available for attestations */}
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
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">Draft Response</h4>
                        {/* Toggle to attestation mode */}
                        {onAttestationToggle && (
                          <button
                            onClick={() => onAttestationToggle(req.id, true)}
                            className="text-xs text-gray-500 hover:text-blue-600 underline ml-2"
                            title="Switch to attestation mode (checkbox compliance)"
                          >
                            [Attestation]
                          </button>
                        )}
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
                        {/* Library button - always visible to insert from library */}
                        {onInsertFromLibrary && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onInsertFromLibrary(req.id)}
                            title="Insert from library"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Library
                          </Button>
                        )}
                        {req.draftAnswer && (
                          <>
                            {/* Version history button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onShowHistory(req.id)}
                              title="View version history"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              History
                            </Button>
                            {/* Save to library button - only when draft exists */}
                            {onSaveToLibrary && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onSaveToLibrary(req.id, req.draftAnswer || "", req)}
                                title="Save to library"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                                Save to Library
                              </Button>
                            )}
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
                          </>
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
  onComplianceChange,
  onAttestationToggle,
  generatingIds,
  onSaveToLibrary,
  onInsertFromLibrary,
  onAddRequirement,
  projectId,
}: ComplianceMatrixProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sortBy, setSortBy] = useState<SortOption>("order");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Add requirement dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Version history state
  const [historyReqId, setHistoryReqId] = useState<string | null>(null);
  const historyReq = historyReqId ? requirements.find(r => r.id === historyReqId) : null;

  // Get unique major categories - MEMOIZED
  const sections = useMemo(() => {
    const categories = requirements
      .map(r => getMajorCategory(r.section))
      .filter(cat => cat !== "Uncategorized");
    return [...new Set(categories)].sort((a, b) => {
      // Sort numerically if both are numbers, otherwise alphabetically
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.localeCompare(b);
    });
  }, [requirements]);

  // Build category title map for display - MEMOIZED
  const categoryTitleMap = useMemo(() => {
    return buildCategoryTitleMap(requirements.map(r => r.section));
  }, [requirements]);

  // Copy to clipboard handler
  const handleCopy = useCallback(async (text: string, id: string) => {
    // Strip [DRAFT] tag when copying
    const cleanText = text.replace(/\n\n\[DRAFT\]$/, "").trim();
    await navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Calculate section stats by major category - MEMOIZED
  const sectionStats = useMemo(() =>
    sections.map(category => {
      // Filter requirements that belong to this major category
      const categoryReqs = requirements.filter(r => getMajorCategory(r.section) === category);
      const answered = categoryReqs.filter(r => r.status === "ANSWERED").length;
      return {
        name: category,
        total: categoryReqs.length,
        answered,
        percentage: categoryReqs.length > 0 ? Math.round((answered / categoryReqs.length) * 100) : 0,
      };
    }),
    [sections, requirements]
  );

  // Stable toggle handler for memoized rows
  const handleToggle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  // Handler to show version history
  const handleShowHistory = useCallback((id: string) => {
    setHistoryReqId(id);
  }, []);

  // Handler for version restore
  const handleVersionRestore = useCallback((draftAnswer: string) => {
    if (historyReqId) {
      onDraftChange(historyReqId, draftAnswer);
    }
  }, [historyReqId, onDraftChange]);

  const handleMatrixClick = useCallback((id: string) => {
    // Clear filters to ensure the requirement is visible
    setFilters(defaultFilters);
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

  // Apply advanced filters - MEMOIZED
  const filteredRequirements = useMemo(() => {
    // First apply section filter by major category if active
    const sectionFiltered = activeSection
      ? requirements.filter(req => getMajorCategory(req.section) === activeSection)
      : requirements;

    // Then apply all other filters
    return applyFilters(sectionFiltered, filters);
  }, [requirements, filters, activeSection]);

  // Calculate filter counts for UI - MEMOIZED
  const filterCounts = useMemo(() => {
    return calculateFilterCounts(requirements, filteredRequirements);
  }, [requirements, filteredRequirements]);

  // Sort filtered requirements - MEMOIZED
  const sortedRequirements = useMemo(() => {
    return [...filteredRequirements].sort((a, b) => {
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
  }, [filteredRequirements, sortBy]);

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

  // Section counts by major category - MEMOIZED for section tabs
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const req of requirements) {
      const category = getMajorCategory(req.section);
      if (category !== "Uncategorized") {
        counts[category] = (counts[category] || 0) + 1;
      }
    }
    return counts;
  }, [requirements]);


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
        <div className="flex items-center gap-3">
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
          {onAddRequirement && projectId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Requirement
            </Button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      <RequirementFilters
        filters={filters}
        onChange={setFilters}
        requirementCounts={filterCounts}
      />

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
              {categoryTitleMap.get(section) || section} ({sectionCounts[section] || 0})
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
                  <span className="text-sm font-medium truncate">{categoryTitleMap.get(section.name) || section.name}</span>
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

      {/* Requirements table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Scrollable container */}
        <div
          ref={tableContainerRef}
          className="overflow-auto"
          style={{ maxHeight: "600px" }}
        >
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
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
              {sortedRequirements.map((req, index) => (
                <RequirementRow
                  key={req.id}
                  req={req}
                  index={index}
                  isExpanded={expandedId === req.id}
                  onToggle={handleToggle}
                  onStatusChange={onStatusChange}
                  onTypeChange={onTypeChange}
                  onDomainChange={onDomainChange}
                  onDraftChange={onDraftChange}
                  onInternalNotesChange={onInternalNotesChange}
                  onGenerateDraft={onGenerateDraft}
                  onCopy={handleCopy}
                  onSaveToLibrary={onSaveToLibrary}
                  onInsertFromLibrary={onInsertFromLibrary}
                  onShowHistory={handleShowHistory}
                  onComplianceChange={onComplianceChange}
                  onAttestationToggle={onAttestationToggle}
                  isGenerating={generatingIds.has(req.id)}
                  isCopied={copiedId === req.id}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={historyReqId !== null}
        onClose={() => setHistoryReqId(null)}
        requirementId={historyReqId || ""}
        currentDraft={historyReq?.draftAnswer || null}
        onRestore={handleVersionRestore}
      />

      {/* Add Requirement Dialog */}
      {onAddRequirement && projectId && (
        <AddRequirementDialog
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onAdded={(req) => {
            onAddRequirement(req);
            setShowAddDialog(false);
          }}
          projectId={projectId}
        />
      )}
    </div>
  );
}
