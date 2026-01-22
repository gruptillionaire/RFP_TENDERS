"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComplianceMatrix } from "@/components/ComplianceMatrix";
import { ExportDialog } from "@/components/ExportDialog";
import { SaveToLibraryDialog } from "@/components/SaveToLibraryDialog";
import { InsertFromLibraryModal } from "@/components/InsertFromLibraryModal";
import { ComplianceScoreCard } from "@/components/ComplianceScoreCard";
import { SubmissionChecklist } from "@/components/SubmissionChecklist";
import { EvaluationWeightsEditor } from "@/components/EvaluationWeightsEditor";
import {
  calculateComplianceScoreEnhanced,
  getMajorCategory,
  buildCategoryTitleMap,
  type RequirementForScoring,
  type EvaluationCriterion,
} from "@/lib/compliance-scoring";

type RequirementType = "CONTEXTUAL" | "PROCEDURAL" | "DECLARATIVE" | "DESCRIPTIVE" | "EVIDENCE_BASED" | "QUANTITATIVE" | "REFERENCE_BASED" | "STAFFING";
type ComplianceStatus = "PENDING" | "COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE";

interface Requirement {
  id: string;
  text: string;
  section: string | null;           // Specific subsection: "A.1.2"
  sectionGroup?: string | null;     // Parent section with title: "A: REQUIRED BANKING SERVICES"
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
  isAttestation?: boolean;
  complianceStatus?: ComplianceStatus;
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
  evaluationCriteria: EvaluationCriterion[] | null;
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

  // Warn user if they try to navigate away while extraction is in progress
  useEffect(() => {
    if (project.status === "PROCESSING") {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "Extraction is still in progress. Are you sure you want to leave?";
        return e.returnValue;
      };
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }, [project.status]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(initialProject.name);
  const [isRenamingSaving, setIsRenamingSaving] = useState(false);
  const [companyName, setCompanyName] = useState(initialProject.companyName || "");
  const [isCompanyNameSaving, setIsCompanyNameSaving] = useState(false);
  const [showCompanyNameSaved, setShowCompanyNameSaved] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Library dialog state
  const [showSaveLibraryDialog, setShowSaveLibraryDialog] = useState(false);
  const [showInsertLibraryModal, setShowInsertLibraryModal] = useState(false);
  const [libraryTargetReqId, setLibraryTargetReqId] = useState<string | null>(null);
  const [libraryContent, setLibraryContent] = useState("");
  const [librarySuggestedTitle, setLibrarySuggestedTitle] = useState("");
  const [librarySuggestedTags, setLibrarySuggestedTags] = useState<string[]>([]);

  // Evaluation weights editor state
  const [showWeightsEditor, setShowWeightsEditor] = useState(false);
  const [evaluationCriteria, setEvaluationCriteria] = useState<EvaluationCriterion[] | null>(
    initialProject.evaluationCriteria
  );
  const [isWeightsSaving, setIsWeightsSaving] = useState(false);

  // Trigger extraction and poll for updates when status is PROCESSING
  useEffect(() => {
    if (project.status !== "PROCESSING") {
      return;
    }

    let pollTimeoutId: NodeJS.Timeout;
    let extractionTriggered = false;
    let currentJobId: string | null = null;
    const abortController = new AbortController();

    // Trigger extraction - returns immediately with jobId for async processing
    const triggerExtraction = async () => {
      if (extractionTriggered) return;
      extractionTriggered = true;

      try {
        console.log("[ProjectView] Triggering async extraction...");
        const res = await fetch(`/api/projects/${project.id}/extract`, {
          method: "POST",
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) return;

        const data = await res.json();
        console.log("[ProjectView] Extraction response:", data);

        if (data.jobId) {
          currentJobId = data.jobId;
          console.log("[ProjectView] Got jobId:", currentJobId);
          // Start polling for job status
          pollJobStatus();
        } else if (data.status === "READY" || data.status === "FAILED") {
          // Extraction already complete (maybe from a previous attempt)
          refreshProjectData();
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("[ProjectView] Extraction trigger error:", err);
      }
    };

    // Poll job status endpoint
    const pollJobStatus = async () => {
      if (!currentJobId || abortController.signal.aborted) return;

      try {
        console.log("[ProjectView] Polling job status:", currentJobId);
        const res = await fetch(`/api/extract/status?jobId=${currentJobId}`, {
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) return;

        if (res.ok) {
          const data = await res.json();
          console.log("[ProjectView] Job status:", data.status);

          if (data.status === "COMPLETE") {
            console.log("[ProjectView] Extraction complete! Refreshing project data...");
            await refreshProjectData();
            return; // Stop polling
          } else if (data.status === "FAILED") {
            console.error("[ProjectView] Extraction failed:", data.error);
            await refreshProjectData();
            return; // Stop polling
          }
          // Still processing - continue polling
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("[ProjectView] Job polling error:", err);
      }

      // Poll every 3 seconds while processing
      pollTimeoutId = setTimeout(pollJobStatus, 3000);
    };

    // Refresh project data from server
    const refreshProjectData = async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) return;

        if (res.ok) {
          const data = await res.json();
          setProject(data);
          setRequirements(data.requirements || []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("[ProjectView] Project refresh error:", err);
      }
    };

    // Trigger extraction immediately
    triggerExtraction();

    return () => {
      abortController.abort();
      clearTimeout(pollTimeoutId);
    };
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

  const handleAddRequirement = useCallback((newRequirement: Requirement) => {
    // Add the new requirement to the state
    setRequirements((prev) => [...prev, newRequirement]);
  }, []);

  const handleComplianceChange = useCallback(async (id: string, complianceStatus: ComplianceStatus) => {
    // Map compliance status to requirement status
    const newStatus: Requirement["status"] = complianceStatus === "PENDING" ? "UNANSWERED" : "ANSWERED";

    // Optimistic update
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, complianceStatus, status: newStatus } : r))
    );

    // Save to server
    await fetch("/api/requirements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, complianceStatus, status: newStatus }),
    });
  }, []);

  const handleAttestationToggle = useCallback(async (id: string, isAttestation: boolean) => {
    // Optimistic update
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? {
        ...r,
        isAttestation,
        // Reset compliance status when switching to attestation, preserve draft when switching away
        complianceStatus: isAttestation ? "PENDING" : r.complianceStatus,
        status: isAttestation ? "UNANSWERED" : r.status,
      } : r))
    );

    // Save to server
    await fetch("/api/requirements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        isAttestation,
        complianceStatus: isAttestation ? "PENDING" : undefined,
        status: isAttestation ? "UNANSWERED" : undefined,
      }),
    });
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

  // Library handlers
  const handleSaveToLibrary = useCallback((id: string, content: string, requirement: Requirement) => {
    setLibraryTargetReqId(id);
    setLibraryContent(content);
    // Generate suggested title from requirement text (first 50 chars)
    const titleBase = requirement.text.slice(0, 50).replace(/[\n\r]+/g, " ").trim();
    setLibrarySuggestedTitle(titleBase.length < requirement.text.length ? titleBase + "..." : titleBase);
    // Generate tags from section and domain
    const tags: string[] = [];
    if (requirement.section) {
      // Remove apostrophes first (possessives like "District's" → "Districts"), then replace other non-alphanumeric with dashes
      tags.push(requirement.section.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
    if (requirement.domainContext) {
      tags.push(requirement.domainContext.toLowerCase());
    }
    if (requirement.type) {
      tags.push(requirement.type.toLowerCase().replace(/_/g, "-"));
    }
    setLibrarySuggestedTags(tags.filter(Boolean));
    setShowSaveLibraryDialog(true);
  }, []);

  const handleInsertFromLibrary = useCallback((id: string) => {
    setLibraryTargetReqId(id);
    setShowInsertLibraryModal(true);
  }, []);

  const handleLibraryInsert = useCallback((content: string) => {
    if (libraryTargetReqId) {
      // Update the draft answer with library content
      handleDraftChange(libraryTargetReqId, content);
    }
  }, [libraryTargetReqId, handleDraftChange]);

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

  // Get unique major categories for weights editor - memoized
  const sections = useMemo(() => {
    const categories = requirements
      .map(r => getMajorCategory(r.section))
      .filter(cat => cat !== "Uncategorized");
    const unique = [...new Set(categories)].sort((a, b) => {
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.localeCompare(b);
    });
    // Build title map for display (uses sectionGroup when available)
    const titleMap = buildCategoryTitleMap(requirements.map(r => ({
      section: r.section,
      sectionGroup: r.sectionGroup
    })));
    return unique.map(key => titleMap.get(key) || key);
  }, [requirements]);

  // Calculate compliance score with enhanced features
  const complianceScore = useMemo(() => {
    if (requirements.length === 0) return null;

    const reqsForScoring: RequirementForScoring[] = requirements.map(r => ({
      id: r.id,
      text: r.text,
      status: r.status,
      isMandatory: r.isMandatory,
      domainContext: r.domainContext || "FEATURE",
      requiresReview: r.requiresReview || false,
      section: r.section,
      sectionGroup: r.sectionGroup,
      draftAnswer: r.draftAnswer,
      wordLimit: r.wordLimit,
      characterLimit: r.characterLimit,
      isAttestation: r.isAttestation,
      complianceStatus: r.complianceStatus,
    }));

    return calculateComplianceScoreEnhanced(reqsForScoring, project.companyName, evaluationCriteria);
  }, [requirements, project.companyName, evaluationCriteria]);

  // Handler to save evaluation criteria
  const handleSaveEvaluationCriteria = useCallback(async (criteria: EvaluationCriterion[] | null) => {
    setIsWeightsSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluationCriteria: criteria }),
      });

      if (res.ok) {
        setEvaluationCriteria(criteria);
        setShowWeightsEditor(false);
      }
    } catch (error) {
      console.error("Failed to save evaluation criteria:", error);
    } finally {
      setIsWeightsSaving(false);
    }
  }, [project.id]);

  // Handle clicking on issues in the checklist to scroll to requirements
  const handleIssueClick = useCallback((requirementIds: string[]) => {
    if (requirementIds.length > 0) {
      // Find the first requirement element and scroll to it
      const element = document.getElementById(`requirement-${requirementIds[0]}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("ring-2", "ring-[#14b8a6]", "ring-offset-2");
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-[#14b8a6]", "ring-offset-2");
        }, 2000);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header - Light theme with teal accents */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/" className="font-extrabold text-xl text-slate-800 tracking-tight">
                RFP Matrix
              </Link>
              <span className="text-slate-300">/</span>
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
                    className="w-80 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-[#14b8a6]"
                    autoFocus
                    disabled={isRenamingSaving}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRenameProject}
                    disabled={isRenamingSaving}
                    className="text-slate-600 hover:text-[#0d9488] hover:bg-[#f0fdfa]"
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
                    className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="font-semibold text-slate-700 hover:text-[#0d9488] hover:underline cursor-pointer transition-colors"
                  title="Click to rename"
                >
                  {project.name}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {project.deadline && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#fffbeb] border border-[#fcd34d] rounded-lg">
                  <svg className="w-4 h-4 text-[#d97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="text-sm">
                    <span className="text-[#92400e] font-semibold">
                      Deadline: {new Date(project.deadline).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {project.deadlineText && (
                      <span className="text-[#b45309] ml-1 text-xs">({project.deadlineText})</span>
                    )}
                    {new Date(project.deadline) < new Date() && (
                      <span className="ml-2 text-red-600 font-semibold text-xs">(OVERDUE)</span>
                    )}
                    {new Date(project.deadline) >= new Date() && (
                      <span className="ml-2 text-[#b45309] text-xs">
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
              {project.status === "READY" && (
                <Button size="sm" onClick={() => setShowExportDialog(true)} className="bg-[#18bfb2] hover:bg-[#14b8a6] text-white font-semibold shadow-sm">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="text-slate-600 hover:text-[#0d9488] hover:bg-[#f0fdfa]">
                Back to Projects
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        projectId={project.id}
        projectName={project.name}
      />

      {/* Company Name Input */}
      {project.status === "READY" && (
        <div className="bg-gradient-to-b from-white to-[#faf9f7] border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center gap-4">
              <label htmlFor="companyName" className="text-sm font-semibold text-slate-700 whitespace-nowrap">
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
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14b8a6]"
                  disabled={isCompanyNameSaving}
                />
              </div>
              {isCompanyNameSaving && (
                <span className="text-xs text-slate-500">Saving...</span>
              )}
              {showCompanyNameSaved && (
                <span className="text-xs font-medium text-[#0d9488]">Saved!</span>
              )}
              {companyName.trim() && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCompanyNameSave(true)}
                  disabled={isCompanyNameSaving}
                  title="Replace [COMPANY NAME] placeholders in all existing drafts"
                  className="border-[#14b8a6] text-[#0d9488] hover:bg-[#f0fdfa]"
                >
                  Update Existing Drafts
                </Button>
              )}
              <p className="text-xs text-slate-400">
                Replaces [COMPANY NAME] in generated drafts
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {project.status === "PROCESSING" ? (
          <div className="flex flex-col items-center justify-center py-20">
            <svg className="animate-spin h-12 w-12 text-[#14b8a6] mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h2 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">Analyzing Document</h2>
            <p className="text-slate-500">
              We&apos;re extracting requirements from your RFP.
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Small documents: 1-2 minutes. Large documents (100+ requirements): 5-10 minutes.
            </p>
          </div>
        ) : project.status === "FAILED" ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Extraction Failed</h2>
            <p className="text-slate-500 mb-2">
              We couldn&apos;t extract requirements from this document.
            </p>
            <p className="text-sm text-emerald-600 mb-4">
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
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Requirements Found</h2>
            <p className="text-slate-500 mb-4">
              We couldn&apos;t extract any requirements from this document.
            </p>
            <Button variant="outline" onClick={() => router.push("/projects/new")}>
              Try Another Document
            </Button>
          </div>
        ) : (
          <>
            {/* Compliance Score Dashboard */}
            {complianceScore && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <ComplianceScoreCard
                  score={complianceScore}
                  onEditWeights={() => setShowWeightsEditor(true)}
                  hasCustomWeights={evaluationCriteria !== null && evaluationCriteria.length > 0}
                  onRequirementClick={handleIssueClick ? (id) => handleIssueClick([id]) : undefined}
                />
                <SubmissionChecklist
                  readiness={complianceScore.readiness}
                  onIssueClick={handleIssueClick}
                />
              </div>
            )}

            <ComplianceMatrix
              requirements={requirements}
              onStatusChange={handleStatusChange}
              onDraftChange={handleDraftChange}
              onGenerateDraft={handleGenerateDraft}
              onTypeChange={handleTypeChange}
              onDomainChange={handleDomainChange}
              onInternalNotesChange={handleInternalNotesChange}
              onComplianceChange={handleComplianceChange}
              onAttestationToggle={handleAttestationToggle}
              generatingIds={generatingIds}
              onSaveToLibrary={handleSaveToLibrary}
              onInsertFromLibrary={handleInsertFromLibrary}
              onAddRequirement={handleAddRequirement}
              projectId={project.id}
            />
          </>
        )}
      </main>

      {/* Library Dialogs */}
      <SaveToLibraryDialog
        isOpen={showSaveLibraryDialog}
        onClose={() => {
          setShowSaveLibraryDialog(false);
          setLibraryTargetReqId(null);
        }}
        onSaved={() => {
          // Could show a toast notification here
        }}
        content={libraryContent}
        suggestedTitle={librarySuggestedTitle}
        suggestedTags={librarySuggestedTags}
      />

      <InsertFromLibraryModal
        isOpen={showInsertLibraryModal}
        onClose={() => {
          setShowInsertLibraryModal(false);
          setLibraryTargetReqId(null);
        }}
        onInsert={handleLibraryInsert}
      />

      {/* Evaluation Weights Editor */}
      <EvaluationWeightsEditor
        isOpen={showWeightsEditor}
        onClose={() => setShowWeightsEditor(false)}
        sections={sections}
        currentCriteria={evaluationCriteria}
        onSave={handleSaveEvaluationCriteria}
        isSaving={isWeightsSaving}
      />
    </div>
  );
}
