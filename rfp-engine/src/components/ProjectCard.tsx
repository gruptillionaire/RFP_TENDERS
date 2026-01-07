"use client";

import { useState } from "react";
import Link from "next/link";
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
    stats: {
      total: number;
      answered: number;
      partial: number;
      percentage: number;
    };
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(project.name);
  const [saving, setSaving] = useState(false);

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

  return (
    <Card className={`hover:border-blue-300 transition-colors ${project.stats.percentage === 100 ? "border-green-200 bg-green-50/30" : ""}`}>
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
              <div className="flex items-center gap-2 group">
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
              </div>
            )}
            <Link href={`/projects/${project.id}`}>
              <CardDescription className="hover:text-gray-700">{project.fileName}</CardDescription>
            </Link>
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
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div>
              <span className="font-medium">{project.stats.total}</span> requirements
            </div>
            <div>
              <span className="font-medium text-green-600">{project.stats.answered}</span> answered
            </div>
            <div>
              <span className="font-medium text-yellow-600">{project.stats.partial}</span> partial
            </div>
            <div className="ml-auto">
              <span className="font-medium">{project.stats.percentage}%</span> complete
            </div>
          </div>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${project.stats.percentage}%` }}
            />
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
