"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RequirementType = "CONTEXTUAL" | "PROCEDURAL" | "DECLARATIVE" | "DESCRIPTIVE" | "EVIDENCE_BASED" | "QUANTITATIVE" | "REFERENCE_BASED" | "STAFFING";
type DomainContext = "FEATURE" | "PROCESS" | "LEGAL";

interface AddRequirementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (requirement: {
    id: string;
    text: string;
    section: string | null;
    isMandatory: boolean;
    type: RequirementType;
    domainContext: DomainContext;
    status: "UNANSWERED";
    draftAnswer: null;
    internalNotes: null;
    wordLimit: null;
    characterLimit: null;
    requiresReview: boolean;
    order: number;
  }) => void;
  projectId: string;
}

const REQUIREMENT_TYPES: { value: RequirementType; label: string; description: string }[] = [
  { value: "DESCRIPTIVE", label: "Descriptive", description: "Detailed explanations" },
  { value: "DECLARATIVE", label: "Declarative", description: "Yes/no with justification" },
  { value: "PROCEDURAL", label: "Procedural", description: "Administrative tasks" },
  { value: "EVIDENCE_BASED", label: "Evidence", description: "Attachments/documents" },
  { value: "QUANTITATIVE", label: "Quantitative", description: "Pricing/metrics" },
  { value: "REFERENCE_BASED", label: "Reference", description: "Past performance" },
  { value: "STAFFING", label: "Staffing", description: "Team/personnel" },
  { value: "CONTEXTUAL", label: "Contextual", description: "Background info only" },
];

const DOMAIN_CONTEXTS: { value: DomainContext; label: string }[] = [
  { value: "FEATURE", label: "Feature" },
  { value: "PROCESS", label: "Process" },
  { value: "LEGAL", label: "Legal" },
];

export function AddRequirementDialog({
  isOpen,
  onClose,
  onAdded,
  projectId,
}: AddRequirementDialogProps) {
  const [text, setText] = useState("");
  const [section, setSection] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);
  const [type, setType] = useState<RequirementType>("DESCRIPTIVE");
  const [domainContext, setDomainContext] = useState<DomainContext>("FEATURE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  // Reset form on fresh open
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      setText("");
      setSection("");
      setIsMandatory(false);
      setType("DESCRIPTIVE");
      setDomainContext("FEATURE");
      setError(null);
      hasInitialized.current = true;
    } else if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError("Requirement text is required");
      return;
    }

    if (text.length > 5000) {
      setError("Requirement text must not exceed 5000 characters");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-manual",
          projectId,
          text: text.trim(),
          section: section.trim() || null,
          isMandatory,
          type,
          domainContext,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add requirement");
      }

      const created = await res.json();

      // Map to expected format
      onAdded({
        id: created.id,
        text: created.text,
        section: created.section,
        isMandatory: created.isMandatory,
        type: created.type,
        domainContext: created.domainContext,
        status: "UNANSWERED",
        draftAnswer: null,
        internalNotes: null,
        wordLimit: null,
        characterLimit: null,
        requiresReview: false,
        order: created.order,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add requirement");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add Requirement</h2>
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

          {/* Requirement text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requirement Text <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter the requirement or question from the RFP..."
              rows={4}
              maxLength={5000}
              disabled={saving}
              className="resize-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              {text.length.toLocaleString()} / 5,000 characters
            </p>
          </div>

          {/* Section reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Section Reference
            </label>
            <Input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g., A25, B2.4, Section 3.1"
              maxLength={100}
              disabled={saving}
            />
            <p className="mt-1 text-xs text-gray-500">
              The section number or identifier from the RFP document
            </p>
          </div>

          {/* Type and Domain row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Requirement type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requirement Type
              </label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as RequirementType)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUIREMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <span>{t.label}</span>
                        <span className="text-xs text-gray-400">- {t.description}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Domain context */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domain
              </label>
              <Select
                value={domainContext}
                onValueChange={(value) => setDomainContext(value as DomainContext)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOMAIN_CONTEXTS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mandatory checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mandatory"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="mandatory" className="text-sm text-gray-700">
              Mark as mandatory requirement
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !text.trim()}
          >
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
                Adding...
              </span>
            ) : (
              "Add Requirement"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
