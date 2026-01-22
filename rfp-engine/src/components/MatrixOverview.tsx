"use client";

import React, { useMemo, useCallback, MouseEvent } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, InfoTooltip } from "@/components/ui/tooltip";

interface Requirement {
  id: string;
  status: "UNANSWERED" | "PARTIAL" | "ANSWERED";
  isMandatory: boolean;
}

interface MatrixOverviewProps {
  requirements: Requirement[];
  onRequirementClick: (id: string) => void;
}

// Helper functions moved outside component to avoid recreation
const getStatusColor = (status: Requirement["status"], isMandatory: boolean): string => {
  switch (status) {
    case "ANSWERED":
      return "bg-primary hover:bg-primary/80";
    case "PARTIAL":
      return "bg-warning hover:bg-warning/80";
    default:
      return isMandatory
        ? "bg-destructive/30 hover:bg-destructive/40"
        : "bg-muted hover:bg-muted/80";
  }
};

const getStatusTooltip = (index: number, status: Requirement["status"], isMandatory: boolean): string => {
  const label = isMandatory ? "Mandatory" : "Optional";
  const statusLabel = status === "ANSWERED" ? "Answered" : status === "PARTIAL" ? "Partial" : "Unanswered";
  return `Requirement ${index + 1} (${label}) - ${statusLabel}`;
};

// Memoized cell component for the grid - uses data attribute to avoid unstable onClick
interface MatrixCellProps {
  req: Requirement;
  index: number;
}

const MatrixCell = React.memo(function MatrixCell({ req, index }: MatrixCellProps) {
  return (
    <button
      data-req-id={req.id}
      className={`w-6 h-6 rounded text-[10px] font-medium text-white flex items-center justify-center transition-all cursor-pointer ${getStatusColor(req.status, req.isMandatory)} ${req.isMandatory ? "ring-1 ring-destructive ring-offset-1" : ""}`}
      title={getStatusTooltip(index, req.status, req.isMandatory)}
    >
      {index + 1}
    </button>
  );
});

export const MatrixOverview = React.memo(function MatrixOverview({ requirements, onRequirementClick }: MatrixOverviewProps) {
  // Single-pass stats calculation for efficiency with large lists
  const stats = useMemo(() => {
    let answered = 0;
    let partial = 0;
    let unanswered = 0;
    let mandatory = 0;
    let mandatoryAnswered = 0;

    for (const r of requirements) {
      if (r.isMandatory) {
        mandatory++;
        if (r.status === "ANSWERED") mandatoryAnswered++;
      }
      if (r.status === "ANSWERED") answered++;
      else if (r.status === "PARTIAL") partial++;
      else unanswered++;
    }

    return { total: requirements.length, answered, partial, unanswered, mandatory, mandatoryAnswered };
  }, [requirements]);

  // Single event handler using event delegation - no per-cell callbacks needed
  const handleGridClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const button = target.closest("button[data-req-id]") as HTMLButtonElement | null;
    if (button) {
      const reqId = button.dataset.reqId;
      if (reqId) {
        onRequirementClick(reqId);
      }
    }
  }, [onRequirementClick]);

  // Memoize progress calculations
  const { overallProgress, mandatoryProgress } = useMemo(() => ({
    overallProgress: stats.total > 0 ? Math.round((stats.answered / stats.total) * 100) : 0,
    mandatoryProgress: stats.mandatory > 0 ? Math.round((stats.mandatoryAnswered / stats.mandatory) * 100) : 100,
  }), [stats]);

  return (
    <div className="bg-white rounded-lg border p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-900">Compliance Matrix Overview</h3>
          <p className="text-sm text-gray-500">Click on a cell to jump to that requirement</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1.5 cursor-help">
                  <span className="w-3 h-3 rounded bg-primary"></span>
                  Answered ({stats.answered})
                </span>
              </TooltipTrigger>
              <TooltipContent>Requirements with complete draft responses.</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1.5 cursor-help">
                  <span className="w-3 h-3 rounded bg-warning"></span>
                  Partial ({stats.partial})
                </span>
              </TooltipTrigger>
              <TooltipContent>Requirements with incomplete drafts that need more work.</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1.5 cursor-help">
                  <span className="w-3 h-3 rounded bg-muted"></span>
                  Unanswered ({stats.unanswered})
                </span>
              </TooltipTrigger>
              <TooltipContent>Optional requirements with no draft yet.</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1.5 cursor-help">
                  <span className="w-3 h-3 rounded bg-destructive/30"></span>
                  Mandatory Unanswered
                </span>
              </TooltipTrigger>
              <TooltipContent>Mandatory requirements without a response. Address these first.</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground flex items-center gap-1">
              Overall Progress
              <InfoTooltip content="Percentage of all requirements marked as Answered." />
            </span>
            <span className="font-medium">{overallProgress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground flex items-center gap-1">
              Mandatory Requirements
              <InfoTooltip content="Must be completed. Missing mandatory requirements may disqualify your submission." />
            </span>
            <span className={`font-medium ${mandatoryProgress === 100 ? "text-success-foreground" : "text-warning-foreground"}`}>
              {stats.mandatoryAnswered}/{stats.mandatory} ({mandatoryProgress}%)
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${mandatoryProgress === 100 ? "bg-primary" : "bg-warning"}`}
              style={{ width: `${mandatoryProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Visual grid - uses event delegation via handleGridClick for performance */}
      <div className="flex flex-wrap gap-1.5" onClick={handleGridClick}>
        {requirements.map((req, index) => (
          <MatrixCell
            key={req.id}
            req={req}
            index={index}
          />
        ))}
      </div>
    </div>
  );
});
