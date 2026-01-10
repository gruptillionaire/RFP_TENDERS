"use client";

import { ComplianceScore, getScoreGrade, getScoreColor, getScoreBgColor } from "@/lib/compliance-scoring";

interface ComplianceScoreCardProps {
  score: ComplianceScore;
}

export function ComplianceScoreCard({ score }: ComplianceScoreCardProps) {
  const grade = getScoreGrade(score.overall);
  const textColor = getScoreColor(score.overall);
  const bgColor = getScoreBgColor(score.overall);

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Compliance Score</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-3xl font-bold ${textColor}`}>{score.overall}%</span>
            <span className={`text-sm font-medium px-2 py-0.5 rounded ${bgColor} ${textColor}`}>
              Grade {grade}
            </span>
          </div>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bgColor}`}>
          <span className={`text-xl font-bold ${textColor}`}>{grade}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              score.overall >= 80
                ? "bg-green-500"
                : score.overall >= 60
                ? "bg-yellow-500"
                : score.overall >= 40
                ? "bg-orange-500"
                : "bg-red-500"
            }`}
            style={{ width: `${score.overall}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded p-2">
          <div className="text-lg font-semibold text-green-600">{score.answered}</div>
          <div className="text-xs text-gray-500">Complete</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-lg font-semibold text-yellow-600">{score.partial}</div>
          <div className="text-xs text-gray-500">Partial</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-lg font-semibold text-red-600">{score.unanswered}</div>
          <div className="text-xs text-gray-500">Open</div>
        </div>
      </div>

      {/* Mandatory progress */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Mandatory Requirements</span>
          <span className={`font-medium ${score.mandatory === 100 ? "text-green-600" : "text-gray-900"}`}>
            {score.mandatory}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              score.mandatory === 100 ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${score.mandatory}%` }}
          />
        </div>
      </div>
    </div>
  );
}
