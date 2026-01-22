"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LibrarySkeletonGrid } from "@/components/ui/skeleton-card";
import Link from "next/link";

interface PastResponse {
  id: string;
  title: string;
  content: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface LibraryData {
  responses: PastResponse[];
  totalCount: number;
  availableTags: string[];
}

const PAGE_SIZE = 20;

export function LibraryClient() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "usageCount" | "title">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Edit modal state
  const [editingResponse, setEditingResponse] = useState<PastResponse | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch library data (initial load or filter change)
  const fetchLibrary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("limit", PAGE_SIZE.toString());
      params.set("offset", "0");

      const res = await fetch(`/api/library?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch library");
      }

      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedTags, sortBy, sortOrder]);

  // Load more responses (pagination)
  const loadMore = useCallback(async () => {
    if (!data || loadingMore) return;

    try {
      setLoadingMore(true);

      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("limit", PAGE_SIZE.toString());
      params.set("offset", data.responses.length.toString());
      params.set("includeTags", "false"); // Skip tags on subsequent loads

      const res = await fetch(`/api/library?${params}`);
      if (!res.ok) {
        throw new Error("Failed to load more");
      }

      const result = await res.json();
      setData((prev) => {
        if (!prev) return result;
        return {
          ...prev,
          responses: [...prev.responses, ...result.responses],
          totalCount: result.totalCount,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoadingMore(false);
    }
  }, [data, debouncedSearch, selectedTags, sortBy, sortOrder, loadingMore]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Check if there are more items to load
  const hasMore = data ? data.responses.length < data.totalCount : false;

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Open edit modal
  const openEdit = (response: PastResponse) => {
    setEditingResponse(response);
    setEditTitle(response.title);
    setEditContent(response.content);
    setEditTags(response.tags.join(", "));
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingResponse) return;

    setSaving(true);
    try {
      const newTags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`/api/library/${editingResponse.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          tags: newTags,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update");
      }

      const updated = await res.json();

      // Update local state optimistically (no full refetch)
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          responses: prev.responses.map((r) =>
            r.id === updated.id ? updated : r
          ),
        };
      });

      setEditingResponse(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  // Delete response
  const handleDelete = async () => {
    if (!deletingId) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/library/${deletingId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete");
      }

      // Update local state optimistically (no full refetch)
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          responses: prev.responses.filter((r) => r.id !== deletingId),
          totalCount: prev.totalCount - 1,
        };
      });

      setDeletingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Truncate content for preview
  const truncateContent = (content: string, maxLength = 150) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  };

  // Memoize sorted responses
  const sortedResponses = useMemo(() => {
    return data?.responses || [];
  }, [data?.responses]);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-slate-400 hover:text-[#0d9488] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#14b8a6] to-[#0d9488] flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Response Library</h1>
                  <p className="text-sm text-slate-500">
                    {data?.totalCount || 0} saved response{data?.totalCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search input */}
            <div className="flex-1">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
                  className="pl-10 border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
                />
              </div>
            </div>

            {/* Sort controls */}
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:border-[#14b8a6] focus:ring-[#14b8a6] focus:outline-none"
              >
                <option value="createdAt">Date Created</option>
                <option value="updatedAt">Last Updated</option>
                <option value="usageCount">Most Used</option>
                <option value="title">Title</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                className="px-3 border-slate-200 hover:bg-slate-50"
              >
                {sortOrder === "asc" ? (
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </Button>
            </div>
          </div>

          {/* Tag filters */}
          {data?.availableTags && data.availableTags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedTags.includes(tag)
                      ? "bg-[#14b8a6] text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tag}
                </button>
              ))}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Loading state with skeleton cards */}
        {loading && <LibrarySkeletonGrid count={6} />}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchLibrary} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sortedResponses.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#f0fdfa] to-[#ccfbf1] flex items-center justify-center mb-4">
              <svg
                className="h-8 w-8 text-[#0d9488]"
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
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              {debouncedSearch || selectedTags.length > 0
                ? "No matching responses"
                : "Your library is empty"}
            </h3>
            <p className="mt-2 text-slate-500 max-w-sm mx-auto">
              {debouncedSearch || selectedTags.length > 0
                ? "Try adjusting your search or filters"
                : "Save responses from your projects to build your reusable library"}
            </p>
          </div>
        )}

        {/* Response cards */}
        {!loading && !error && sortedResponses.length > 0 && (
          <>
            <div className="grid gap-4">
              {sortedResponses.map((response) => (
                <div
                  key={response.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">{response.title}</h3>
                      <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">
                        {truncateContent(response.content)}
                      </p>

                      {/* Tags */}
                      {response.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {response.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2.5 py-1 bg-[#f0fdfa] text-[#0d9488] rounded-lg text-xs font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Meta info */}
                      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(response.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Used {response.usageCount} time{response.usageCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(response)}
                        className="border-slate-200 text-slate-600 hover:text-[#0d9488] hover:border-[#14b8a6] hover:bg-[#f0fdfa]"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingId(response.id)}
                        className="border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More / Pagination info */}
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-sm text-slate-500">
                Showing {sortedResponses.length} of {data?.totalCount || 0} responses
              </p>
              {hasMore && (
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="min-w-[140px] border-slate-200 hover:bg-slate-50"
                >
                  {loadingMore ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#0d9488]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </main>

      {/* Edit Modal */}
      {editingResponse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Edit Response</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Response title"
                  className="border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Content</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6]"
                  placeholder="Response content"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tags (comma-separated)
                </label>
                <Input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="security, compliance, pricing"
                  className="border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
              <Button variant="outline" onClick={() => setEditingResponse(null)} disabled={saving} className="border-slate-200">
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving} className="bg-[#14b8a6] hover:bg-[#0d9488] text-white">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Delete Response?</h2>
              <p className="mt-2 text-slate-600">
                This action cannot be undone. The response will be permanently removed from your library.
              </p>
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
              <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleting} className="border-slate-200">
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
