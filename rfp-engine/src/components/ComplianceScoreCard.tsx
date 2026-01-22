"use client";

import { ComplianceScore, getScoreGrade, getScoreColor, getScoreBgColor } from "@/lib/compliance-scoring";
import { ActionableInsights } from "@/components/ActionableInsights";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, InfoTooltip } from "@/components/ui/tooltip";

interface ComplianceScoreCardProps {
  score: ComplianceScore;
  onEditWeights?: () => void;
  hasCustomWeights?: boolean;
  onRequirementClick?: (id: string) => void;
}

export function ComplianceScoreCard({
  score,
  onEditWeights,
  hasCustomWeights = false,
  onRequirementClick,
}: ComplianceScoreCardProps) {
  const grade = getScoreGrade(score.overall);
  const textColor = getScoreColor(score.overall);
  const bgColor = getScoreBgColor(score.overall);

  return (
    <div className="space-y-4">
      {/* Main Score Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Compliance Score</h3>
              <InfoTooltip content="Weighted score based on requirement completion. Mandatory items carry more weight than optional ones." />
              {hasCustomWeights && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] px-1.5 py-0.5 bg-[#f0fdfa] text-[#0d9488] rounded-full font-medium cursor-help">
                      Custom Weights
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>You have customized the evaluation weights for this project.</TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-bold ${textColor}`}>{score.overall}%</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded cursor-help ${bgColor} ${textColor}`}>
                    Grade {grade}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  A: 90-100% | B: 80-89% | C: 70-79% | D: 60-69% | F: Below 60%
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEditWeights && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditWeights}
                className="text-gray-500 hover:text-gray-700"
                title="Edit evaluation weights"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Button>
            )}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bgColor}`}>
              <span className={`text-xl font-bold ${textColor}`}>{grade}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                score.overall >= 80
                  ? "bg-[#20c933]"
                  : score.overall >= 60
                  ? "bg-[#fcb400]"
                  : score.overall >= 40
                  ? "bg-orange-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${score.overall}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-[#f0fdf4] rounded-lg p-3 cursor-help border border-[#bbf7d0]">
                <div className="text-xl font-bold text-[#16a34a]">{score.answered}</div>
                <div className="text-xs font-medium text-[#15803d]">Complete</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Requirements with full draft responses ready for export.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-[#fffbeb] rounded-lg p-3 cursor-help border border-[#fde68a]">
                <div className="text-xl font-bold text-[#d97706]">{score.partial}</div>
                <div className="text-xs font-medium text-[#b45309]">Partial</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Requirements with incomplete drafts that need more work.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-slate-50 rounded-lg p-3 cursor-help border border-slate-200">
                <div className="text-xl font-bold text-slate-600">{score.unanswered}</div>
                <div className="text-xs font-medium text-slate-500">Open</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Requirements with no draft response yet.</TooltipContent>
          </Tooltip>
        </div>

        {/* Mandatory progress */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-600 font-medium flex items-center gap-1">
              Mandatory Requirements
              <InfoTooltip content="Requirements marked as mandatory by the RFP. Missing these may disqualify your submission." />
            </span>
            <span className={`font-bold ${score.mandatory === 100 ? "text-[#16a34a]" : "text-slate-800"}`}>
              {score.mandatory}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                score.mandatory === 100 ? "bg-[#20c933]" : "bg-[#14b8a6]"
              }`}
              style={{ width: `${score.mandatory}%` }}
            />
          </div>
        </div>
      </div>

      {/* Actionable Insights */}
      {(score.focusItems || score.insights || score.criterionScores) && (
        <ActionableInsights
          focusItems={score.focusItems || []}
          insights={score.insights || []}
          criterionScores={score.criterionScores}
          potentialImprovement={score.potentialImprovement || 0}
          onRequirementClick={onRequirementClick}
        />
      )}
    </div>
  );
}
