"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SaveToLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  content: string;
  suggestedTitle?: string;
  suggestedTags?: string[];
}

export function SaveToLibraryDialog({
  isOpen,
  onClose,
  onSaved,
  content,
  suggestedTitle = "",
  suggestedTags = [],
}: SaveToLibraryDialogProps) {
  const [title, setTitle] = useState(suggestedTitle);
  const [tagsInput, setTagsInput] = useState(suggestedTags.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with new content
  useEffect(() => {
    if (isOpen) {
      setTitle(suggestedTitle);
      setTagsInput(suggestedTags.join(", "));
      setError(null);
    }
  }, [isOpen, suggestedTitle, suggestedTags]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          tags,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save response");
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Truncate content for preview
  const previewContent =
    content.length > 500 ? content.slice(0, 500) + "..." : content;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Save to Library</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={saving}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Title input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Security Compliance Response"
              maxLength={255}
              disabled={saving}
            />
            <p className="mt-1 text-xs text-gray-500">
              Give this response a memorable name
            </p>
          </div>

          {/* Tags input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (optional)
            </label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="security, gdpr, compliance"
              disabled={saving}
            />
            <p className="mt-1 text-xs text-gray-500">
              Comma-separated tags to help organize and find this response later
            </p>
          </div>

          {/* Content preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content Preview
            </label>
            <div className="p-3 bg-gray-50 rounded-md border max-h-48 overflow-auto">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {previewContent}
              </p>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {content.length.toLocaleString()} characters
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </span>
            ) : (
              "Save to Library"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
