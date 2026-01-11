"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EvaluationCriterion } from "@/lib/compliance-scoring";

interface EvaluationWeightsEditorProps {
  isOpen: boolean;
  onClose: () => void;
  sections: string[];  // Available major categories with titles
  currentCriteria: EvaluationCriterion[] | null;
  onSave: (criteria: EvaluationCriterion[] | null) => void;
  isSaving?: boolean;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function EvaluationWeightsEditor({
  isOpen,
  onClose,
  sections,
  currentCriteria,
  onSave,
  isSaving = false,
}: EvaluationWeightsEditorProps) {
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize criteria when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (currentCriteria && currentCriteria.length > 0) {
        setCriteria(currentCriteria);
      } else {
        // Start with one empty criterion
        setCriteria([
          { id: generateId(), name: "", weight: 0, linkedSections: [] },
        ]);
      }
      setError(null);
    }
  }, [isOpen, currentCriteria]);

  // Calculate total weight
  const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
  const isValidWeight = totalWeight >= 95 && totalWeight <= 105;

  // Add new criterion
  const handleAddCriterion = useCallback(() => {
    setCriteria((prev) => [
      ...prev,
      { id: generateId(), name: "", weight: 0, linkedSections: [] },
    ]);
  }, []);

  // Remove criterion
  const handleRemoveCriterion = useCallback((id: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Update criterion field
  const handleUpdateCriterion = useCallback(
    (id: string, field: keyof EvaluationCriterion, value: string | number | string[]) => {
      setCriteria((prev) =>
        prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
      );
    },
    []
  );

  // Toggle section in linkedSections
  const handleToggleSection = useCallback((criterionId: string, section: string) => {
    setCriteria((prev) =>
      prev.map((c) => {
        if (c.id !== criterionId) return c;
        const linked = c.linkedSections.includes(section)
          ? c.linkedSections.filter((s) => s !== section)
          : [...c.linkedSections, section];
        return { ...c, linkedSections: linked };
      })
    );
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    // Validate all criteria have names and weights
    const validCriteria = criteria.filter((c) => c.name.trim() && c.weight > 0);

    if (validCriteria.length === 0) {
      // Clear criteria if none are valid
      onSave(null);
      return;
    }

    const total = validCriteria.reduce((sum, c) => sum + c.weight, 0);
    if (total < 95 || total > 105) {
      setError(`Weights must sum to 100% (currently ${total}%)`);
      return;
    }

    setError(null);
    onSave(validCriteria);
  }, [criteria, onSave]);

  // Handle clear all
  const handleClear = useCallback(() => {
    onSave(null);
  }, [onSave]);

  // Get sections already linked to other criteria
  const getLinkedSections = useCallback(
    (excludeCriterionId: string) => {
      const linked = new Set<string>();
      for (const c of criteria) {
        if (c.id !== excludeCriterionId) {
          for (const s of c.linkedSections) {
            linked.add(s);
          }
        }
      }
      return linked;
    },
    [criteria]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evaluation Weights</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Enter the evaluation criteria from the RFP and link them to relevant sections.
            Weights should sum to 100%.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {criteria.map((criterion, index) => {
            const linkedElsewhere = getLinkedSections(criterion.id);
            return (
              <div
                key={criterion.id}
                className="p-4 border rounded-lg bg-gray-50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">
                    Criterion {index + 1}
                  </span>
                  {criteria.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCriterion(criterion.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor={`name-${criterion.id}`} className="text-xs">
                      Name
                    </Label>
                    <Input
                      id={`name-${criterion.id}`}
                      placeholder="e.g., Technical Approach"
                      value={criterion.name}
                      onChange={(e) =>
                        handleUpdateCriterion(criterion.id, "name", e.target.value)
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`weight-${criterion.id}`} className="text-xs">
                      Weight (%)
                    </Label>
                    <Input
                      id={`weight-${criterion.id}`}
                      type="number"
                      min={0}
                      max={100}
                      placeholder="40"
                      value={criterion.weight || ""}
                      onChange={(e) =>
                        handleUpdateCriterion(
                          criterion.id,
                          "weight",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Linked Sections</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {sections.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">
                        No sections available
                      </span>
                    ) : (
                      sections.map((section) => {
                        const isLinked = criterion.linkedSections.includes(section);
                        const isLinkedElsewhere = linkedElsewhere.has(section);
                        return (
                          <button
                            key={section}
                            type="button"
                            disabled={isLinkedElsewhere && !isLinked}
                            onClick={() => handleToggleSection(criterion.id, section)}
                            className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                              isLinked
                                ? "bg-blue-100 border-blue-300 text-blue-700"
                                : isLinkedElsewhere
                                ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-100"
                            }`}
                            title={
                              isLinkedElsewhere && !isLinked
                                ? "Already linked to another criterion"
                                : ""
                            }
                          >
                            {section}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <Button
            variant="outline"
            onClick={handleAddCriterion}
            className="w-full"
          >
            + Add Criterion
          </Button>

          {/* Weight summary */}
          <div
            className={`p-3 rounded-lg border ${
              isValidWeight
                ? "bg-green-50 border-green-200"
                : totalWeight > 0
                ? "bg-yellow-50 border-yellow-200"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Weight:</span>
              <span
                className={`text-lg font-bold ${
                  isValidWeight
                    ? "text-green-600"
                    : totalWeight > 100
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {totalWeight}%
              </span>
            </div>
            {!isValidWeight && totalWeight > 0 && (
              <p className="text-xs mt-1 text-yellow-700">
                {totalWeight < 95
                  ? `Add ${100 - totalWeight}% more to reach 100%`
                  : `Remove ${totalWeight - 100}% to reach 100%`}
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="ghost"
            onClick={handleClear}
            disabled={isSaving}
            className="text-gray-500"
          >
            Clear All
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Weights"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
