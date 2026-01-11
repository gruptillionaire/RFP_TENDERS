"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type RequirementStatus = "UNANSWERED" | "PARTIAL" | "ANSWERED";
type DomainContext = "FEATURE" | "PROCESS" | "LEGAL";
type RequirementType = "CONTEXTUAL" | "PROCEDURAL" | "DECLARATIVE" | "DESCRIPTIVE" | "EVIDENCE_BASED" | "QUANTITATIVE" | "REFERENCE_BASED" | "STAFFING";
type ComplianceStatus = "PENDING" | "COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE";

export interface FilterState {
  statuses: RequirementStatus[];
  mandatory: boolean | null;  // null = all, true = mandatory only, false = optional only
  domains: DomainContext[];
  types: RequirementType[];
  needsReview: boolean | null;
  overLimit: boolean | null;
  hasDraft: boolean | null;
  searchText: string;
  isAttestation: boolean | null;  // null = all, true = attestation only, false = written only
  complianceStatuses: ComplianceStatus[];  // filter by compliance status
}

export const defaultFilters: FilterState = {
  statuses: [],
  mandatory: null,
  domains: [],
  types: [],
  needsReview: null,
  overLimit: null,
  hasDraft: null,
  searchText: "",
  isAttestation: null,
  complianceStatuses: [],
};

interface RequirementFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  requirementCounts?: {
    total: number;
    filtered: number;
    byStatus: Record<RequirementStatus, number>;
    byDomain: Record<DomainContext, number>;
    byType: Record<RequirementType, number>;
    byComplianceStatus: Record<ComplianceStatus, number>;
    mandatory: number;
    needsReview: number;
    overLimit: number;
    hasDraft: number;
    attestation: number;
    writtenResponse: number;
  };
}

function FilterChip({
  label,
  active,
  count,
  onClick,
  color = "gray",
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
  color?: "gray" | "green" | "yellow" | "red" | "blue" | "purple" | "orange" | "cyan" | "amber";
}) {
  const colorClasses = {
    gray: active ? "bg-gray-200 border-gray-400 text-gray-800" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100",
    green: active ? "bg-green-100 border-green-400 text-green-800" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-green-50",
    yellow: active ? "bg-yellow-100 border-yellow-400 text-yellow-800" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-yellow-50",
    red: active ? "bg-red-100 border-red-400 text-red-800" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-red-50",
    blue: active ? "bg-blue-100 border-blue-400 text-blue-800" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50",
    purple: active ? "bg-purple-100 border-purple-400 text-purple-800" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-purple-50",
    orange: active ? "bg-orange-100 border-orange-400 text-orange-800" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-orange-50",
    cyan: active ? "bg-cyan-100 border-cyan-400 text-cyan-800" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-cyan-50",
    amber: active ? "bg-amber-100 border-amber-400 text-amber-800" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-amber-50",
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full transition-colors ${colorClasses[color]}`}
    >
      {label}
      {count !== undefined && (
        <span className={`${active ? "opacity-70" : "opacity-50"}`}>({count})</span>
      )}
    </button>
  );
}

function ToggleChip({
  label,
  value,
  onChange,
  color = "gray",
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  color?: "gray" | "green" | "red";
}) {
  const states = [null, true, false] as const;
  const labels = { null: label, true: `${label}: Yes`, false: `${label}: No` };

  const handleClick = () => {
    const currentIndex = states.indexOf(value);
    const nextIndex = (currentIndex + 1) % states.length;
    onChange(states[nextIndex]);
  };

  const colorClasses = {
    gray: value === null
      ? "bg-gray-50 border-gray-200 text-gray-600"
      : value
      ? "bg-gray-200 border-gray-400 text-gray-800"
      : "bg-gray-100 border-gray-300 text-gray-500",
    green: value === null
      ? "bg-gray-50 border-gray-200 text-gray-600"
      : value
      ? "bg-green-100 border-green-400 text-green-800"
      : "bg-gray-100 border-gray-300 text-gray-500",
    red: value === null
      ? "bg-gray-50 border-gray-200 text-gray-600"
      : value
      ? "bg-red-100 border-red-400 text-red-800"
      : "bg-gray-100 border-gray-300 text-gray-500",
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full transition-colors hover:bg-gray-100 ${colorClasses[color]}`}
    >
      {labels[String(value) as keyof typeof labels]}
      {value !== null && (
        <span className="opacity-50 text-[10px]">(click to cycle)</span>
      )}
    </button>
  );
}

export function RequirementFilters({
  filters,
  onChange,
  requirementCounts,
}: RequirementFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.statuses.length > 0) count++;
    if (filters.mandatory !== null) count++;
    if (filters.domains.length > 0) count++;
    if (filters.types.length > 0) count++;
    if (filters.needsReview !== null) count++;
    if (filters.overLimit !== null) count++;
    if (filters.hasDraft !== null) count++;
    if (filters.searchText) count++;
    if (filters.isAttestation !== null) count++;
    if (filters.complianceStatuses.length > 0) count++;
    return count;
  }, [filters]);

  const toggleStatus = useCallback((status: RequirementStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onChange({ ...filters, statuses: newStatuses });
  }, [filters, onChange]);

  const toggleDomain = useCallback((domain: DomainContext) => {
    const newDomains = filters.domains.includes(domain)
      ? filters.domains.filter(d => d !== domain)
      : [...filters.domains, domain];
    onChange({ ...filters, domains: newDomains });
  }, [filters, onChange]);

  const toggleType = useCallback((type: RequirementType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onChange({ ...filters, types: newTypes });
  }, [filters, onChange]);

  const toggleComplianceStatus = useCallback((status: ComplianceStatus) => {
    const newStatuses = filters.complianceStatuses.includes(status)
      ? filters.complianceStatuses.filter(s => s !== status)
      : [...filters.complianceStatuses, status];
    onChange({ ...filters, complianceStatuses: newStatuses });
  }, [filters, onChange]);

  const clearFilters = useCallback(() => {
    onChange(defaultFilters);
  }, [onChange]);

  return (
    <div className="bg-white rounded-lg border">
      {/* Collapsed header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </button>

          {/* Quick search */}
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              type="text"
              placeholder="Search requirements..."
              value={filters.searchText}
              onChange={(e) => onChange({ ...filters, searchText: e.target.value })}
              className="pl-8 h-8 w-64 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {requirementCounts && (
            <span className="text-sm text-gray-500">
              {requirementCounts.filtered} of {requirementCounts.total} requirements
            </span>
          )}
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Expanded filter panel */}
      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {/* Status filters */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Status</h4>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="Unanswered"
                active={filters.statuses.includes("UNANSWERED")}
                count={requirementCounts?.byStatus.UNANSWERED}
                onClick={() => toggleStatus("UNANSWERED")}
                color="gray"
              />
              <FilterChip
                label="Partial"
                active={filters.statuses.includes("PARTIAL")}
                count={requirementCounts?.byStatus.PARTIAL}
                onClick={() => toggleStatus("PARTIAL")}
                color="yellow"
              />
              <FilterChip
                label="Answered"
                active={filters.statuses.includes("ANSWERED")}
                count={requirementCounts?.byStatus.ANSWERED}
                onClick={() => toggleStatus("ANSWERED")}
                color="green"
              />
            </div>
          </div>

          {/* Domain filters */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Domain</h4>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="Feature"
                active={filters.domains.includes("FEATURE")}
                count={requirementCounts?.byDomain.FEATURE}
                onClick={() => toggleDomain("FEATURE")}
                color="cyan"
              />
              <FilterChip
                label="Process"
                active={filters.domains.includes("PROCESS")}
                count={requirementCounts?.byDomain.PROCESS}
                onClick={() => toggleDomain("PROCESS")}
                color="amber"
              />
              <FilterChip
                label="Legal"
                active={filters.domains.includes("LEGAL")}
                count={requirementCounts?.byDomain.LEGAL}
                onClick={() => toggleDomain("LEGAL")}
                color="red"
              />
            </div>
          </div>

          {/* Type filters */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Type</h4>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="Context"
                active={filters.types.includes("CONTEXTUAL")}
                count={requirementCounts?.byType.CONTEXTUAL}
                onClick={() => toggleType("CONTEXTUAL")}
                color="gray"
              />
              <FilterChip
                label="Procedural"
                active={filters.types.includes("PROCEDURAL")}
                count={requirementCounts?.byType.PROCEDURAL}
                onClick={() => toggleType("PROCEDURAL")}
                color="blue"
              />
              <FilterChip
                label="Declarative"
                active={filters.types.includes("DECLARATIVE")}
                count={requirementCounts?.byType.DECLARATIVE}
                onClick={() => toggleType("DECLARATIVE")}
                color="purple"
              />
              <FilterChip
                label="Descriptive"
                active={filters.types.includes("DESCRIPTIVE")}
                count={requirementCounts?.byType.DESCRIPTIVE}
                onClick={() => toggleType("DESCRIPTIVE")}
                color="orange"
              />
              <FilterChip
                label="Evidence"
                active={filters.types.includes("EVIDENCE_BASED")}
                count={requirementCounts?.byType.EVIDENCE_BASED}
                onClick={() => toggleType("EVIDENCE_BASED")}
                color="green"
              />
              <FilterChip
                label="Quantitative"
                active={filters.types.includes("QUANTITATIVE")}
                count={requirementCounts?.byType.QUANTITATIVE}
                onClick={() => toggleType("QUANTITATIVE")}
                color="yellow"
              />
              <FilterChip
                label="Reference"
                active={filters.types.includes("REFERENCE_BASED")}
                count={requirementCounts?.byType.REFERENCE_BASED}
                onClick={() => toggleType("REFERENCE_BASED")}
                color="cyan"
              />
              <FilterChip
                label="Staffing"
                active={filters.types.includes("STAFFING")}
                count={requirementCounts?.byType.STAFFING}
                onClick={() => toggleType("STAFFING")}
                color="amber"
              />
            </div>
          </div>

          {/* Response Type filters */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Response Type</h4>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="Attestation"
                active={filters.isAttestation === true}
                count={requirementCounts?.attestation}
                onClick={() => onChange({
                  ...filters,
                  isAttestation: filters.isAttestation === true ? null : true
                })}
                color="blue"
              />
              <FilterChip
                label="Written Response"
                active={filters.isAttestation === false}
                count={requirementCounts?.writtenResponse}
                onClick={() => onChange({
                  ...filters,
                  isAttestation: filters.isAttestation === false ? null : false
                })}
                color="purple"
              />
            </div>
          </div>

          {/* Compliance Status filters (for attestation items) */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Compliance Status</h4>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="Pending"
                active={filters.complianceStatuses.includes("PENDING")}
                count={requirementCounts?.byComplianceStatus.PENDING}
                onClick={() => toggleComplianceStatus("PENDING")}
                color="gray"
              />
              <FilterChip
                label="Compliant"
                active={filters.complianceStatuses.includes("COMPLIANT")}
                count={requirementCounts?.byComplianceStatus.COMPLIANT}
                onClick={() => toggleComplianceStatus("COMPLIANT")}
                color="green"
              />
              <FilterChip
                label="Non-Compliant"
                active={filters.complianceStatuses.includes("NON_COMPLIANT")}
                count={requirementCounts?.byComplianceStatus.NON_COMPLIANT}
                onClick={() => toggleComplianceStatus("NON_COMPLIANT")}
                color="red"
              />
              <FilterChip
                label="N/A"
                active={filters.complianceStatuses.includes("NOT_APPLICABLE")}
                count={requirementCounts?.byComplianceStatus.NOT_APPLICABLE}
                onClick={() => toggleComplianceStatus("NOT_APPLICABLE")}
                color="gray"
              />
            </div>
          </div>

          {/* Toggle filters */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Quick Filters</h4>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="Mandatory"
                value={filters.mandatory}
                onChange={(value) => onChange({ ...filters, mandatory: value })}
                color="red"
              />
              <ToggleChip
                label="Needs Review"
                value={filters.needsReview}
                onChange={(value) => onChange({ ...filters, needsReview: value })}
                color="gray"
              />
              <ToggleChip
                label="Over Limit"
                value={filters.overLimit}
                onChange={(value) => onChange({ ...filters, overLimit: value })}
                color="red"
              />
              <ToggleChip
                label="Has Draft"
                value={filters.hasDraft}
                onChange={(value) => onChange({ ...filters, hasDraft: value })}
                color="green"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Apply filters to requirements
 */
export function applyFilters<T extends {
  id: string;
  text: string;
  status: RequirementStatus;
  isMandatory: boolean;
  domainContext?: DomainContext;
  type: RequirementType;
  requiresReview?: boolean;
  draftAnswer?: string | null;
  wordLimit?: number | null;
  characterLimit?: number | null;
  isAttestation?: boolean;
  complianceStatus?: ComplianceStatus;
}>(
  requirements: T[],
  filters: FilterState
): T[] {
  return requirements.filter(req => {
    // Status filter
    if (filters.statuses.length > 0 && !filters.statuses.includes(req.status)) {
      return false;
    }

    // Mandatory filter
    if (filters.mandatory !== null && req.isMandatory !== filters.mandatory) {
      return false;
    }

    // Domain filter
    if (filters.domains.length > 0) {
      const domain = req.domainContext || "FEATURE";
      if (!filters.domains.includes(domain)) {
        return false;
      }
    }

    // Type filter
    if (filters.types.length > 0 && !filters.types.includes(req.type)) {
      return false;
    }

    // Needs review filter
    if (filters.needsReview !== null) {
      const needsReview = req.requiresReview || false;
      if (needsReview !== filters.needsReview) {
        return false;
      }
    }

    // Over limit filter
    if (filters.overLimit !== null) {
      const isOverLimit = checkOverLimit(req);
      if (isOverLimit !== filters.overLimit) {
        return false;
      }
    }

    // Has draft filter
    if (filters.hasDraft !== null) {
      const hasDraft = Boolean(req.draftAnswer);
      if (hasDraft !== filters.hasDraft) {
        return false;
      }
    }

    // Attestation filter
    if (filters.isAttestation !== null) {
      const isAttestation = req.isAttestation || false;
      if (isAttestation !== filters.isAttestation) {
        return false;
      }
    }

    // Compliance status filter
    if (filters.complianceStatuses.length > 0) {
      const complianceStatus = req.complianceStatus || "PENDING";
      if (!filters.complianceStatuses.includes(complianceStatus)) {
        return false;
      }
    }

    // Search text filter
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      const textMatch = req.text.toLowerCase().includes(searchLower);
      const draftMatch = req.draftAnswer?.toLowerCase().includes(searchLower) || false;
      if (!textMatch && !draftMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calculate filter counts from requirements
 */
export function calculateFilterCounts<T extends {
  status: RequirementStatus;
  isMandatory: boolean;
  domainContext?: DomainContext;
  type: RequirementType;
  requiresReview?: boolean;
  draftAnswer?: string | null;
  wordLimit?: number | null;
  characterLimit?: number | null;
  isAttestation?: boolean;
  complianceStatus?: ComplianceStatus;
}>(
  requirements: T[],
  filtered: T[]
): {
  total: number;
  filtered: number;
  byStatus: Record<RequirementStatus, number>;
  byDomain: Record<DomainContext, number>;
  byType: Record<RequirementType, number>;
  byComplianceStatus: Record<ComplianceStatus, number>;
  mandatory: number;
  needsReview: number;
  overLimit: number;
  hasDraft: number;
  attestation: number;
  writtenResponse: number;
} {
  const counts = {
    total: requirements.length,
    filtered: filtered.length,
    byStatus: { UNANSWERED: 0, PARTIAL: 0, ANSWERED: 0 } as Record<RequirementStatus, number>,
    byDomain: { FEATURE: 0, PROCESS: 0, LEGAL: 0 } as Record<DomainContext, number>,
    byType: { CONTEXTUAL: 0, PROCEDURAL: 0, DECLARATIVE: 0, DESCRIPTIVE: 0, EVIDENCE_BASED: 0, QUANTITATIVE: 0, REFERENCE_BASED: 0, STAFFING: 0 } as Record<RequirementType, number>,
    byComplianceStatus: { PENDING: 0, COMPLIANT: 0, NON_COMPLIANT: 0, NOT_APPLICABLE: 0 } as Record<ComplianceStatus, number>,
    mandatory: 0,
    needsReview: 0,
    overLimit: 0,
    hasDraft: 0,
    attestation: 0,
    writtenResponse: 0,
  };

  for (const req of requirements) {
    counts.byStatus[req.status]++;
    counts.byDomain[req.domainContext || "FEATURE"]++;
    counts.byType[req.type]++;
    counts.byComplianceStatus[req.complianceStatus || "PENDING"]++;
    if (req.isMandatory) counts.mandatory++;
    if (req.requiresReview) counts.needsReview++;
    if (checkOverLimit(req)) counts.overLimit++;
    if (req.draftAnswer) counts.hasDraft++;
    if (req.isAttestation) counts.attestation++;
    else counts.writtenResponse++;
  }

  return counts;
}

function checkOverLimit(req: {
  draftAnswer?: string | null;
  wordLimit?: number | null;
  characterLimit?: number | null;
}): boolean {
  if (!req.draftAnswer) return false;

  const wordCount = req.draftAnswer.split(/\s+/).filter(Boolean).length;
  const charCount = req.draftAnswer.length;

  return (
    (req.wordLimit !== null && req.wordLimit !== undefined && wordCount > req.wordLimit) ||
    (req.characterLimit !== null && req.characterLimit !== undefined && charCount > req.characterLimit)
  );
}
