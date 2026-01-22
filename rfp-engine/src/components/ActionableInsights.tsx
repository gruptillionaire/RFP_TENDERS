"use client";

import React from "react";
import type {
  ActionableInsight,
  FocusItem,
  CriterionScore,
} from "@/lib/compliance-scoring";

interface ActionableInsightsProps {
  focusItems: FocusItem[];
  insights: ActionableInsight[];
  criterionScores?: CriterionScore[];
  potentialImprovement: number;
  onRequirementClick?: (id: string) => void;
}

export function ActionableInsights({
  focusItems,
  insights,
  criterionScores,
  potentialImprovement,
  onRequirementClick,
}: ActionableInsightsProps) {
  const hasContent =
    focusItems.length > 0 ||
    insights.length > 0 ||
    (criterionScores && criterionScores.length > 0);

  if (!hasContent) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Evaluation Breakdown */}
      {criterionScores && criterionScores.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <svg
              className="w-4 h-4 text-[#14b8a6]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Evaluation Breakdown
          </h4>
          <div className="space-y-4">
            {criterionScores.map((criterion) => (
              <div key={criterion.criterionId}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">
                    {criterion.name}{" "}
                    <span className="text-slate-400">({criterion.weight}%)</span>
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      criterion.score >= 80
                        ? "text-[#16a34a]"
                        : criterion.score >= 50
                        ? "text-[#d97706]"
                        : "text-red-600"
                    }`}
                  >
                    {criterion.score}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      criterion.score >= 80
                        ? "bg-[#20c933]"
                        : criterion.score >= 50
                        ? "bg-[#fcb400]"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${criterion.score}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1 font-medium">
                  {criterion.answeredCount}/{criterion.requirementCount} requirements
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focus Items */}
      {focusItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <svg
              className="w-4 h-4 text-[#f59e0b]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Focus Items
            {potentialImprovement > 0 && (
              <span className="text-xs font-medium text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-full">
                +{potentialImprovement}% potential
              </span>
            )}
          </h4>
          <div className="space-y-2">
            {focusItems.map((item, index) => (
              <button
                key={item.requirementId}
                onClick={() => onRequirementClick?.(item.requirementId)}
                className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-[#14b8a6] hover:bg-[#f0fdfa] transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#f0fdfa] text-[#0d9488] text-xs flex items-center justify-center font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.isMandatory && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">
                          M
                        </span>
                      )}
                      {item.section && (
                        <span className="text-xs text-slate-400 font-medium">{item.section}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2 mt-1">
                      {item.text || "No description"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-[#16a34a] font-bold">
                        +{item.impactScore}%
                      </span>
                      <span className="text-xs text-slate-400">{item.reason}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Risks & Warnings */}
      {insights.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <svg
              className="w-4 h-4 text-[#f59e0b]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Risks & Warnings
          </h4>
          <div className="space-y-2">
            {insights.map((insight, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  insight.priority === "high"
                    ? "bg-red-50 border-red-200"
                    : insight.priority === "medium"
                    ? "bg-[#fffbeb] border-[#fde68a]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  {insight.priority === "high" ? (
                    <svg
                      className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : insight.priority === "medium" ? (
                    <svg
                      className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  <div className="flex-1">
                    <p
                      className={`text-sm ${
                        insight.priority === "high"
                          ? "text-red-700"
                          : insight.priority === "medium"
                          ? "text-yellow-700"
                          : "text-gray-600"
                      }`}
                    >
                      {insight.message}
                    </p>
                    {insight.requirementIds && insight.requirementIds.length > 0 && onRequirementClick && (
                      <button
                        onClick={() => onRequirementClick(insight.requirementIds![0])}
                        className="text-xs text-blue-600 hover:underline mt-1 cursor-pointer"
                      >
                        View {insight.count === 1 ? "item" : `${insight.count} items`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
