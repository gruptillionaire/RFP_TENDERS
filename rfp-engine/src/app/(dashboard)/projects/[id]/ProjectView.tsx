"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComplianceMatrix } from "@/components/ComplianceMatrix";

type RequirementType = "CONTEXTUAL" | "PROCEDURAL" | "DECLARATIVE" | "DESCRIPTIVE" | "EVIDENCE_BASED";

interface Requirement {
  id: string;
  text: string;
  section: string | null;
  isMandatory: boolean;
  draftAnswer: string | null;
  internalNotes: string | null;
  wordLimit: number | null;
  characterLimit: number | null;
  status: "UNANSWERED" | "PARTIAL" | "ANSWERED";
  type: RequirementType;
  domainContext?: "FEATURE" | "PROCESS" | "LEGAL";
  requiresReview?: boolean;
  order: number;
}

interface Project {
  id: string;
  name: string;
  companyName: string | null;
  fileName: string;
  deadline: Date | null;
  deadlineText: string | null;
  status: "PROCESSING" | "READY" | "COMPLETED" | "FAILED";
  requirements: Requirement[];
  createdAt: Date;
}

interface ProjectViewProps {
  project: Project;
}

export function ProjectView({ project: initialProject }: ProjectViewProps) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [requirements, setRequirements] = useState(initialProject.requirements);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  // Separate timeout refs to prevent draft saves from canceling notes saves and vice versa
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notesSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
      if (notesSaveTimeoutRef.current) clearTimeout(notesSaveTimeoutRef.current);
    };
  }, []);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(initialProject.name);
  const [isRenamingSaving, setIsRenamingSaving] = useState(false);
  const [companyName, setCompanyName] = useState(initialProject.companyName || "");
  const [isCompanyNameSaving, setIsCompanyNameSaving] = useState(false);
  const [showCompanyNameSaved, setShowCompanyNameSaved] = useState(false);

  // Poll for updates if processing
  useEffect(() => {
    if (project.status === "PROCESSING") {
      const interval = setInterval(async () => {
        const res = await fetch(`/api/projects/${project.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status !== "PROCESSING") {
            setProject(data);
            setRequirements(data.requirements || []);
            clearInterval(interval);
          }
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [project.id, project.status]);

  const handleStatusChange = useCallback(async (id: string, status: Requirement["status"]) => {
    // Optimistic update
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );

    // Save to server
    await fetch("/api/requirements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }, []);

  const handleDraftChange = useCallback((id: string, draftAnswer: string) => {
    // Optimistic update
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, draftAnswer } : r))
    );

    // Debounced save using dedicated ref (prevents notes edits from canceling draft saves)
    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(async () => {
      await fetch("/api/requirements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, draftAnswer }),
      });
    }, 1000);
  }, []);

  const handleGenerateDraft = useCallback(async (id: string) => {
    setGeneratingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "generate-draft" }),
      });

      if (res.ok) {
        const updated = await res.json();
        setRequirements((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
        );
      }
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleTypeChange = useCallback(async (id: string, type: RequirementType) => {
    // Optimistic update
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, type } : r))
    );

    // Save to server
    await fetch("/api/requirements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type }),
    });
  }, []);

  const handleDomainChange = useCallback(async (id: string, domainContext: "FEATURE" | "PROCESS" | "LEGAL") => {
    // Optimistic update - also set requiresReview for LEGAL
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, domainContext, requiresReview: domainContext === "LEGAL" } : r))
    );

    // Save to server
    await fetch("/api/requirements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, domainContext }),
    });
  }, []);

  const handleInternalNotesChange = useCallback((id: string, internalNotes: string) => {
    // Optimistic update
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, internalNotes } : r))
    );

    // Debounced save using dedicated ref (prevents draft edits from canceling notes saves)
    if (notesSaveTimeoutRef.current) clearTimeout(notesSaveTimeoutRef.current);
    notesSaveTimeoutRef.current = setTimeout(async () => {
      await fetch("/api/requirements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, internalNotes }),
      });
    }, 1000);
  }, []);

  const handleDeleteProject = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/dashboard");
      }
    } finally {
      setIsDeleting(false);
    }
  }, [project.id, router]);

  const handleRenameProject = useCallback(async () => {
    if (!editedName.trim() || editedName.trim() === project.name) {
      setIsEditingName(false);
      setEditedName(project.name);
      return;
    }

    setIsRenamingSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editedName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setProject((prev) => ({ ...prev, name: data.name }));
      }
    } finally {
      setIsRenamingSaving(false);
      setIsEditingName(false);
    }
  }, [editedName, project.id, project.name]);

  const handleCompanyNameSave = useCallback(async (updateExisting = false) => {
    const trimmedName = companyName.trim();

    // If not updating existing and name hasn't changed, skip
    if (!updateExisting && trimmedName === (project.companyName || "")) {
      return;
    }

    // If updating existing but no company name, skip
    if (updateExisting && !trimmedName) {
      return;
    }

    setIsCompanyNameSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: trimmedName || null,
          updateExistingDrafts: updateExisting,
          forceUpdate: updateExisting // Replace old company name too
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProject((prev) => ({ ...prev, companyName: data.companyName }));
        setShowCompanyNameSaved(true);
        setTimeout(() => setShowCompanyNameSaved(false), 2000);

        // If we updated existing drafts, refresh requirements
        if (updateExisting && trimmedName) {
          const projectRes = await fetch(`/api/projects/${project.id}`);
          if (projectRes.ok) {
            const projectData = await projectRes.json();
            setRequirements(projectData.requirements || []);
          }
        }
      }
    } finally {
      setIsCompanyNameSaving(false);
    }
  }, [companyName, project.id, project.companyName]);

  const getStatusBadgeVariant = (status: Project["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "default";
      case "READY":
        return "secondary";
      case "FAILED":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/" className="font-bold text-xl">
                RFP Engine
              </Link>
              <span className="text-gray-300">/</span>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameProject();
                      if (e.key === "Escape") {
                        setIsEditingName(false);
                        setEditedName(project.name);
                      }
                    }}
                    className="px-2 py-1 border rounded text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    disabled={isRenamingSaving}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRenameProject}
                    disabled={isRenamingSaving}
                  >
                    {isRenamingSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditingName(false);
                      setEditedName(project.name);
                    }}
                    disabled={isRenamingSaving}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-gray-600 hover:text-gray-900 hover:underline cursor-pointer"
                  title="Click to rename"
                >
                  {project.name}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {project.deadline && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="text-sm">
                    <span className="text-amber-800 font-medium">
                      Deadline: {new Date(project.deadline).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {project.deadlineText && (
                      <span className="text-amber-600 ml-1 text-xs">({project.deadlineText})</span>
                    )}
                    {new Date(project.deadline) < new Date() && (
                      <span className="ml-2 text-red-600 font-medium text-xs">(OVERDUE)</span>
                    )}
                    {new Date(project.deadline) >= new Date() && (
                      <span className="ml-2 text-amber-600 text-xs">
                        ({Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left)
                      </span>
                    )}
                  </div>
                </div>
              )}
              <Badge variant={getStatusBadgeVariant(project.status)}>
                {project.status === "PROCESSING" && (
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {project.status.toLowerCase()}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Company Name Input */}
      {project.status === "READY" && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <label htmlFor="companyName" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Your Company Name:
              </label>
              <div className="flex-1 max-w-md">
                <input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onBlur={() => handleCompanyNameSave(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Enter your company name to auto-fill drafts"
                  className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isCompanyNameSaving}
                />
              </div>
              {isCompanyNameSaving && (
                <span className="text-xs text-gray-500">Saving...</span>
              )}
              {showCompanyNameSaved && (
                <span className="text-xs text-green-600">Saved!</span>
              )}
              {companyName.trim() && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCompanyNameSave(true)}
                  disabled={isCompanyNameSaving}
                  title="Replace [COMPANY NAME] placeholders in all existing drafts"
                >
                  Update Existing Drafts
                </Button>
              )}
              <p className="text-xs text-gray-400">
                Replaces [COMPANY NAME] in generated drafts
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {project.status === "PROCESSING" ? (
          <div className="flex flex-col items-center justify-center py-20">
            <svg className="animate-spin h-12 w-12 text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h2 className="text-xl font-semibold mb-2">Analyzing Document</h2>
            <p className="text-gray-500">
              We&apos;re extracting requirements from your RFP. This usually takes 1-2 minutes.
            </p>
          </div>
        ) : project.status === "FAILED" ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Extraction Failed</h2>
            <p className="text-gray-500 mb-2">
              We couldn&apos;t extract requirements from this document.
            </p>
            <p className="text-sm text-green-600 mb-4">
              This extraction was not counted against your monthly quota.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push("/projects/new")}>
                Try Another Document
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProject}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Project"}
              </Button>
            </div>
          </div>
        ) : requirements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">No Requirements Found</h2>
            <p className="text-gray-500 mb-4">
              We couldn&apos;t extract any requirements from this document.
            </p>
            <Button variant="outline" onClick={() => router.push("/projects/new")}>
              Try Another Document
            </Button>
          </div>
        ) : (
          <ComplianceMatrix
            requirements={requirements}
            onStatusChange={handleStatusChange}
            onDraftChange={handleDraftChange}
            onGenerateDraft={handleGenerateDraft}
            onTypeChange={handleTypeChange}
            onDomainChange={handleDomainChange}
            onInternalNotesChange={handleInternalNotesChange}
            generatingIds={generatingIds}
          />
        )}
      </main>
    </div>
  );
}
