"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PastResponse {
  id: string;
  title: string;
  content: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
}

interface InsertFromLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (content: string, responseId: string) => void;
}

export function InsertFromLibraryModal({
  isOpen,
  onClose,
  onInsert,
}: InsertFromLibraryModalProps) {
  const [responses, setResponses] = useState<PastResponse[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<PastResponse | null>(null);
  const [inserting, setInserting] = useState(false);
  const [inserted, setInserted] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch library data
  const fetchLibrary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
      params.set("sortBy", "usageCount"); // Most used first
      params.set("sortOrder", "desc");
      params.set("limit", "50");

      const res = await fetch(`/api/library?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch library");
      }

      const data = await res.json();
      setResponses(data.responses);
      setAvailableTags(data.availableTags || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedTags]);

  useEffect(() => {
    if (isOpen) {
      fetchLibrary();
    }
  }, [isOpen, fetchLibrary]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setDebouncedSearch("");
      setSelectedTags([]);
      setSelectedResponse(null);
      setInserted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleInsert = async () => {
    if (!selectedResponse) return;

    setInserting(true);
    try {
      // Track usage (fire-and-forget for performance)
      fetch(`/api/library/${selectedResponse.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "use" }),
      }).catch(err => console.error("Failed to track usage:", err));

      onInsert(selectedResponse.content, selectedResponse.id);

      // Show success feedback
      setInserted(true);
      setInserting(false);

      // Close after brief delay to show success
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      console.error("Insert error:", err);
      // Still insert even if something fails
      onInsert(selectedResponse.content, selectedResponse.id);
      onClose();
    }
  };

  // Truncate content for preview
  const truncateContent = (content: string, maxLength = 200) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Insert from Library</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and filters */}
        <div className="p-4 border-b flex-shrink-0 space-y-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Input
              placeholder="Search responses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {availableTags.slice(0, 15).map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tag}
                </button>
              ))}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded-full"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Response list */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && responses.length === 0 && (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-10 w-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-500">
                {debouncedSearch || selectedTags.length > 0
                  ? "No matching responses found"
                  : "Your library is empty"}
              </p>
            </div>
          )}

          {!loading && !error && responses.length > 0 && (
            <div className="space-y-2">
              {responses.map((response) => (
                <button
                  key={response.id}
                  onClick={() => setSelectedResponse(response)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedResponse?.id === response.id
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{response.title}</h4>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {truncateContent(response.content)}
                      </p>
                      {response.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {response.tags.slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      Used {response.usageCount}x
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview panel (shows when response is selected) */}
        {selectedResponse && (
          <div className="border-t p-4 bg-gray-50 flex-shrink-0 max-h-48 overflow-auto">
            <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Preview
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {selectedResponse.content}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!selectedResponse || inserting || inserted}
            className={inserted ? "bg-green-600 hover:bg-green-600" : ""}
          >
            {inserted ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Loaded!
              </span>
            ) : inserting ? (
              "Inserting..."
            ) : (
              "Insert Response"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
