"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    fileName: string;
    status: string;
    deadline: Date | null;
    deadlineText: string | null;
    isPastDeadline?: boolean;
    stats: {
      total: number;
      answered: number;
      partial: number;
      percentage: number;
    };
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || title === project.name) {
      setTitle(project.name);
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title.trim() }),
      });

      if (!res.ok) {
        setTitle(project.name);
      }
    } catch {
      setTitle(project.name);
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setTitle(project.name);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.refresh();
      }
    } catch {
      // Error deleting
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <Card className={`hover:border-primary/50 transition-colors ${project.stats.percentage === 100 ? "border-success/50 bg-success/10" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2 pr-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSave}
                  disabled={saving}
                  className="h-8 text-lg font-semibold max-w-[500px]"
                  autoFocus
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 group pr-4">
                <Link href={`/projects/${project.id}`} className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate hover:text-blue-600">{title}</CardTitle>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  title="Edit title"
                >
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  title="Delete project"
                >
                  <svg className="w-3.5 h-3.5 text-gray-500 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </div>
            )}
            <Link href={`/projects/${project.id}`}>
              <CardDescription className="hover:text-gray-700">{project.fileName}</CardDescription>
            </Link>
            {project.deadline && (
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <svg className={`w-3.5 h-3.5 ${project.isPastDeadline ? "text-destructive" : "text-warning-foreground"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className={project.isPastDeadline ? "text-destructive" : "text-warning-foreground"}>
                  {new Date(project.deadline).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {project.isPastDeadline && " (overdue)"}
                  {!project.isPastDeadline && (
                    <span className="text-muted-foreground ml-1">
                      ({Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}d left)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
          <Badge
            variant={
              project.stats.percentage === 100
                ? "default"
                : project.status === "FAILED"
                ? "destructive"
                : project.status === "READY"
                ? "secondary"
                : "outline"
            }
          >
            {project.stats.percentage === 100 ? "completed" : project.status.toLowerCase()}
          </Badge>
        </div>
      </CardHeader>
      <Link href={`/projects/${project.id}`}>
        <CardContent className="cursor-pointer">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{project.stats.total}</span> requirements
            </div>
            <div>
              <span className="font-medium text-success-foreground">{project.stats.answered}</span> answered
            </div>
            <div>
              <span className="font-medium text-warning-foreground">{project.stats.partial}</span> partial
            </div>
            <div className="ml-auto">
              <span className="font-medium text-foreground">{project.stats.percentage}%</span> complete
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${project.stats.percentage}%` }}
            />
          </div>
        </CardContent>
      </Link>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Project</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-600 mb-2">
              Are you sure you want to delete <span className="font-medium">&quot;{project.name}&quot;</span>?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              All requirements, draft responses, and associated data will be permanently deleted.
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Project"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
