"use client";

import { useState } from "react";
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

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);

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

      const data = await response.json();

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
        setError(data.error || "Failed to create project");
        return;
      }

      // Redirect to project page
      router.push(`/projects/${data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="font-bold text-xl">
            RFP Matrix
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
            <CardDescription>
              Upload an RFP or tender document to extract requirements and start drafting responses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <Label htmlFor="name">Project Name (optional)</Label>
              <Input
                id="name"
                placeholder="e.g., City Council IT Services RFP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isUploading}
              />
              <p className="text-xs text-gray-500">
                If not provided, we&apos;ll use the filename
              </p>
            </div>

            <div className="space-y-2">
              <Label>RFP Document</Label>
              <FileUpload onUpload={handleUpload} isUploading={isUploading} />
            </div>

            {isUploading && (
              <div className="bg-blue-50 p-4 rounded-md">
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div>
                    <p className="font-medium text-blue-900">Processing document...</p>
                    <p className="text-sm text-blue-700">
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
