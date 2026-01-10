"use client";

import { SubmissionReadiness, ReadinessIssue } from "@/lib/compliance-scoring";

interface SubmissionChecklistProps {
  readiness: SubmissionReadiness;
  onIssueClick?: (requirementIds: string[]) => void;
}

function IssueIcon({ type }: { type: "blocker" | "warning" }) {
  if (type === "blocker") {
    return (
      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IssueItem({
  issue,
  type,
  onIssueClick,
}: {
  issue: ReadinessIssue;
  type: "blocker" | "warning";
  onIssueClick?: (requirementIds: string[]) => void;
}) {
  const hasLink = issue.requirementIds && issue.requirementIds.length > 0 && onIssueClick;

  return (
    <div
      className={`flex items-start gap-2 text-sm ${
        hasLink ? "cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" : ""
      }`}
      onClick={() => hasLink && onIssueClick(issue.requirementIds!)}
    >
      <IssueIcon type={type} />
      <span className={type === "blocker" ? "text-red-700" : "text-yellow-700"}>
        {issue.message}
      </span>
      {hasLink && (
        <svg className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );
}

export function SubmissionChecklist({ readiness, onIssueClick }: SubmissionChecklistProps) {
  const hasIssues = readiness.blockers.length > 0 || readiness.warnings.length > 0;

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        {readiness.ready ? (
          <>
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-green-800">Ready to Submit</h3>
              <p className="text-xs text-green-600">All critical requirements met</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Not Ready</h3>
              <p className="text-xs text-red-600">
                {readiness.blockers.length} blocker{readiness.blockers.length !== 1 ? "s" : ""} to resolve
              </p>
            </div>
          </>
        )}
      </div>

      {hasIssues && (
        <div className="space-y-3">
          {readiness.blockers.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <h4 className="text-xs font-medium text-red-800 uppercase tracking-wide mb-2">
                Blockers
              </h4>
              <div className="space-y-2">
                {readiness.blockers.map((issue, i) => (
                  <IssueItem key={i} issue={issue} type="blocker" onIssueClick={onIssueClick} />
                ))}
              </div>
            </div>
          )}

          {readiness.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
              <h4 className="text-xs font-medium text-yellow-800 uppercase tracking-wide mb-2">
                Warnings
              </h4>
              <div className="space-y-2">
                {readiness.warnings.map((issue, i) => (
                  <IssueItem key={i} issue={issue} type="warning" onIssueClick={onIssueClick} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!hasIssues && readiness.ready && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">No issues found. Your submission is ready!</p>
        </div>
      )}
    </div>
  );
}
