"use client";

import { useCallback } from "react";

interface Requirement {
  id: string;
  status: "UNANSWERED" | "PARTIAL" | "ANSWERED";
  isMandatory: boolean;
}

interface MatrixOverviewProps {
  requirements: Requirement[];
  onRequirementClick: (id: string) => void;
}

export function MatrixOverview({ requirements, onRequirementClick }: MatrixOverviewProps) {
  const getStatusColor = useCallback((status: Requirement["status"], isMandatory: boolean) => {
    switch (status) {
      case "ANSWERED":
        return "bg-green-500 hover:bg-green-600";
      case "PARTIAL":
        return "bg-yellow-400 hover:bg-yellow-500";
      default:
        return isMandatory
          ? "bg-red-200 hover:bg-red-300"
          : "bg-gray-200 hover:bg-gray-300";
    }
  }, []);

  const getStatusTooltip = useCallback((index: number, status: Requirement["status"], isMandatory: boolean) => {
    const label = isMandatory ? "Mandatory" : "Optional";
    const statusLabel = status === "ANSWERED" ? "Answered" : status === "PARTIAL" ? "Partial" : "Unanswered";
    return `Requirement ${index + 1} (${label}) - ${statusLabel}`;
  }, []);

  // Calculate stats
  const stats = {
    total: requirements.length,
    answered: requirements.filter(r => r.status === "ANSWERED").length,
    partial: requirements.filter(r => r.status === "PARTIAL").length,
    unanswered: requirements.filter(r => r.status === "UNANSWERED").length,
    mandatory: requirements.filter(r => r.isMandatory).length,
    mandatoryAnswered: requirements.filter(r => r.isMandatory && r.status === "ANSWERED").length,
  };

  const overallProgress = stats.total > 0 ? Math.round((stats.answered / stats.total) * 100) : 0;
  const mandatoryProgress = stats.mandatory > 0 ? Math.round((stats.mandatoryAnswered / stats.mandatory) * 100) : 100;

  return (
    <div className="bg-white rounded-lg border p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-900">Compliance Matrix Overview</h3>
          <p className="text-sm text-gray-500">Click on a cell to jump to that requirement</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-green-500"></span>
              Answered ({stats.answered})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-yellow-400"></span>
              Partial ({stats.partial})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gray-200"></span>
              Unanswered ({stats.unanswered})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-200"></span>
              Mandatory Unanswered
            </span>
          </div>
        </div>
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Overall Progress</span>
            <span className="font-medium">{overallProgress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Mandatory Requirements</span>
            <span className={`font-medium ${mandatoryProgress === 100 ? "text-green-600" : "text-orange-600"}`}>
              {stats.mandatoryAnswered}/{stats.mandatory} ({mandatoryProgress}%)
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${mandatoryProgress === 100 ? "bg-green-500" : "bg-orange-500"}`}
              style={{ width: `${mandatoryProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Visual grid */}
      <div className="flex flex-wrap gap-1.5">
        {requirements.map((req, index) => (
          <button
            key={req.id}
            onClick={() => onRequirementClick(req.id)}
            className={`w-6 h-6 rounded text-[10px] font-medium text-white flex items-center justify-center transition-all cursor-pointer ${getStatusColor(req.status, req.isMandatory)} ${req.isMandatory ? "ring-1 ring-red-400 ring-offset-1" : ""}`}
            title={getStatusTooltip(index, req.status, req.isMandatory)}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
