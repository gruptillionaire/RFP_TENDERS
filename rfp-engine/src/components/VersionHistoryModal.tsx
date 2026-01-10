"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface Version {
  id: string;
  draftAnswer: string;
  status: "UNANSWERED" | "PARTIAL" | "ANSWERED";
  changeSource: string | null;
  createdAt: string;
  editedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirementId: string;
  currentDraft: string | null;
  onRestore: (draftAnswer: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function getChangeSourceLabel(source: string | null): string {
  switch (source) {
    case "ai_generated":
      return "AI Generated";
    case "library_insert":
      return "Library Insert";
    case "restored":
      return "Restored";
    case "manual":
    default:
      return "Manual Edit";
  }
}

function getChangeSourceColor(source: string | null): string {
  switch (source) {
    case "ai_generated":
      return "bg-purple-100 text-purple-700";
    case "library_insert":
      return "bg-blue-100 text-blue-700";
    case "restored":
      return "bg-amber-100 text-amber-700";
    case "manual":
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function VersionHistoryModal({
  isOpen,
  onClose,
  requirementId,
  currentDraft,
  onRestore,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const LIMIT = 10;

  const fetchVersions = useCallback(async () => {
    if (!requirementId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/requirements/${requirementId}/versions?limit=${LIMIT}&offset=${offset}`
      );

      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions);
        setTotalCount(data.totalCount);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to load version history");
      }
    } catch {
      setError("Failed to load version history");
    } finally {
      setLoading(false);
    }
  }, [requirementId, offset]);

  useEffect(() => {
    if (isOpen && requirementId) {
      fetchVersions();
    }
  }, [isOpen, requirementId, fetchVersions]);

  const handleRestore = async (version: Version) => {
    setRestoringId(version.id);

    try {
      const res = await fetch(`/api/requirements/${requirementId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: version.id }),
      });

      if (res.ok) {
        onRestore(version.draftAnswer);
        onClose();
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to restore version");
      }
    } catch {
      setError("Failed to restore version");
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  const hasMore = offset + versions.length < totalCount;
  const hasPrevious = offset > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
            <p className="text-sm text-gray-500">
              {totalCount} version{totalCount !== 1 ? "s" : ""} saved
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && versions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">No version history yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Versions are created when you edit the draft
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Current version indicator */}
              {currentDraft && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Current Version</span>
                  </div>
                  <p className="text-sm text-blue-600 mt-1 line-clamp-2">
                    {currentDraft.slice(0, 150)}
                    {currentDraft.length > 150 && "..."}
                  </p>
                </div>
              )}

              {/* Version list */}
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="border rounded-lg overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setExpandedId(expandedId === version.id ? null : version.id)}
                    className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getChangeSourceColor(version.changeSource)}`}>
                          {getChangeSourceLabel(version.changeSource)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatRelativeTime(version.createdAt)}
                        </span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          expandedId === version.id ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {version.draftAnswer.slice(0, 150)}
                      {version.draftAnswer.length > 150 && "..."}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      by {version.editedBy.name || version.editedBy.email}
                    </p>
                  </button>

                  {expandedId === version.id && (
                    <div className="border-t bg-gray-50 p-3">
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Full Content
                        </h4>
                        <div className="bg-white border rounded p-3 text-sm text-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {version.draftAnswer}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {new Date(version.createdAt).toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleRestore(version)}
                          disabled={restoringId === version.id}
                        >
                          {restoringId === version.id ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-3 w-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Restoring...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Restore This Version
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with pagination */}
        {(hasMore || hasPrevious) && (
          <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={!hasPrevious || loading}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              {offset + 1}-{Math.min(offset + versions.length, totalCount)} of {totalCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + LIMIT)}
              disabled={!hasMore || loading}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
