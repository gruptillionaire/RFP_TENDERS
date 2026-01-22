"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/FileUpload";

interface DuplicateWarning {
  fileName: string;
  existingProjectName: string;
  existingProjectId: string;
  pendingFile: File;
}

interface SingleUseStatus {
  hasCredits: boolean;
  extractionsRemaining: number;
  draftsRemaining: number;
  expiresAt: string | null;
}

export function NewProjectClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [singleUseStatus, setSingleUseStatus] = useState<SingleUseStatus | null>(null);

  // Fetch billing status to check for single-use credits
  useEffect(() => {
    fetch("/api/billing/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.singleUse?.hasCredits) {
          setSingleUseStatus(data.singleUse);
        }
      })
      .catch(() => {
        // Ignore errors - just won't show the banner
      });
  }, []);

  const handleUpload = async (file: File, allowDuplicate = false) => {
    setError("");
    setDuplicateWarning(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (name) {
        formData.append("name", name);
      }
      if (allowDuplicate) {
        formData.append("allowDuplicate", "true");
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      // Handle 413 (Payload Too Large) - Vercel returns HTML, not JSON
      if (response.status === 413) {
        setError("File too large. Maximum file size is 4.5MB. Please compress your document or split it into smaller files.");
        return;
      }

      // Handle 500 errors with a more helpful message
      if (response.status === 500) {
        setError("Server error processing your document. This may be due to an unsupported PDF format. Please try a different file or contact support.");
        return;
      }

      // Try to parse JSON response
      let data;
      try {
        data = await response.json();
      } catch {
        // Response wasn't JSON (e.g., HTML error page)
        setError("Unexpected server error. Please try again or contact support.");
        return;
      }

      if (!response.ok) {
        // Handle duplicate file warning
        if (response.status === 409 && data.error === "duplicate") {
          setDuplicateWarning({
            fileName: file.name,
            existingProjectName: data.existingProjectName,
            existingProjectId: data.existingProjectId,
            pendingFile: file,
          });
          setIsUploading(false);
          return;
        }
        // Handle processing in progress
        if (response.status === 409 && data.error === "processing") {
          setError(data.message || "This file is currently being processed. Please wait a few minutes.");
          return;
        }
        setError(data.error || "Failed to create project");
        return;
      }

      // Redirect to project page
      router.push(`/projects/${data.id}`);
    } catch (err) {
      // Network error or other unexpected error
      console.error("Upload error:", err);
      setError("Connection error. Please check your internet and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDuplicate = () => {
    if (duplicateWarning) {
      handleUpload(duplicateWarning.pendingFile, true);
    }
  };

  const handleCancelDuplicate = () => {
    setDuplicateWarning(null);
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header - Light theme with teal accents */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-extrabold text-xl text-slate-800 tracking-tight">
              RFP Matrix
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 hover:text-[#0d9488] flex items-center gap-1 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Projects
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section - Subtle gradient */}
      <div className="bg-gradient-to-b from-white to-[#faf9f7] py-8 border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Create New Project</h1>
          <p className="text-slate-500 mt-1">Upload an RFP document to get started</p>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-6 py-8">

        <Card className="bg-white border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#14b8a6] to-[#0d9488] flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-800 tracking-tight">Upload Document</CardTitle>
                <CardDescription className="text-slate-500 mt-1">
                  Drag and drop or click to upload your RFP document
                </CardDescription>
                <div className="flex items-center gap-2 mt-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[#dbeafe] text-[#1e40af]">PDF</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[#f3e8ff] text-[#7c3aed]">DOCX</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[#dcfce7] text-[#166534]">DOC</span>
                  <span className="text-xs text-slate-400 ml-1">max 4.5MB</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Single-Use Credit Notice */}
            {singleUseStatus && (
              <div className="p-4 rounded-lg border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-orange-800">Using Single RFP Credit</p>
                    <p className="text-sm text-orange-700 mt-1">
                      This project will use your single-use credit. You have {singleUseStatus.extractionsRemaining} extraction{singleUseStatus.extractionsRemaining !== 1 ? 's' : ''} and {singleUseStatus.draftsRemaining} AI drafts remaining.
                    </p>
                    {singleUseStatus.expiresAt && (
                      <p className="text-xs text-orange-600 mt-1">
                        Credit expires {new Date(singleUseStatus.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {duplicateWarning && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="font-medium text-yellow-800">Duplicate File Detected</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      A project with the file &quot;{duplicateWarning.fileName}&quot; already exists:
                      <Link href={`/projects/${duplicateWarning.existingProjectId}`} className="font-medium underline ml-1">
                        {duplicateWarning.existingProjectName}
                      </Link>
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={handleConfirmDuplicate}>
                        Upload Anyway
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelDuplicate}>
                        Cancel
                      </Button>
                      <Link href={`/projects/${duplicateWarning.existingProjectId}`}>
                        <Button size="sm" variant="ghost">
                          View Existing Project
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700">Project Name (optional)</Label>
              <Input
                id="name"
                placeholder="e.g., City Council IT Services RFP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isUploading}
                className="border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
              />
              <p className="text-xs text-slate-400">
                If not provided, we&apos;ll use the filename
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">RFP Document</Label>
              <FileUpload onUpload={handleUpload} isUploading={isUploading} />
            </div>

            {/* Helpful tip */}
            {!isUploading && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-[#f0fdfa] flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Tip</p>
                  <p className="text-xs text-slate-500 mt-0.5">For best results, upload documents with clear section headers and numbered requirements.</p>
                </div>
              </div>
            )}

            {isUploading && (
              <div className="bg-[#f0fdfa] p-4 rounded-xl border border-[#99f6e4]">
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-[#0d9488]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div>
                    <p className="font-semibold text-[#115e59]">Processing document...</p>
                    <p className="text-sm text-[#0d9488]">
                      This may take a minute depending on document size.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
