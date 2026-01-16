import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, setRLSContext } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { EvaluationCriterion } from "@/lib/compliance-scoring";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Set RLS context for database-level user isolation
    await setRLSContext(session.user.id);

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        requirements: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Project fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Set RLS context for database-level user isolation
    await setRLSContext(session.user.id);

    const { id } = await params;
    const body = await request.json();
    const { name, companyName, updateExistingDrafts, forceUpdate, evaluationCriteria } = body;

    // Validate at least one field is being updated (allow updateExistingDrafts alone)
    if (!name && companyName === undefined && evaluationCriteria === undefined && !updateExistingDrafts) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    // Validate evaluationCriteria if provided
    if (evaluationCriteria !== undefined && evaluationCriteria !== null) {
      if (!Array.isArray(evaluationCriteria)) {
        return NextResponse.json({ error: "evaluationCriteria must be an array" }, { status: 400 });
      }

      // Validate structure of each criterion
      for (const criterion of evaluationCriteria as EvaluationCriterion[]) {
        if (!criterion.id || !criterion.name || typeof criterion.weight !== "number") {
          return NextResponse.json({ error: "Each criterion must have id, name, and weight" }, { status: 400 });
        }
        if (!Array.isArray(criterion.linkedSections)) {
          return NextResponse.json({ error: "Each criterion must have linkedSections array" }, { status: 400 });
        }
      }

      // Validate weights sum to approximately 100 (allow 95-105 for rounding)
      const totalWeight = (evaluationCriteria as EvaluationCriterion[]).reduce((sum, c) => sum + c.weight, 0);
      if (totalWeight < 95 || totalWeight > 105) {
        return NextResponse.json({ error: `Evaluation weights must sum to 100 (currently ${totalWeight})` }, { status: 400 });
      }
    }

    // If name is provided, it must be non-empty
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }

    // Get project with current company name for replacement
    const project = await prisma.project.findUnique({
      where: { id },
      select: { userId: true, companyName: true },
    });

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const oldCompanyName = project.companyName;

    // Build update data
    const updateData: Prisma.ProjectUpdateInput = {};
    if (name) {
      updateData.name = name.trim();
    }
    if (companyName !== undefined) {
      updateData.companyName = companyName ? companyName.trim() : null;
    }
    if (evaluationCriteria !== undefined) {
      // Prisma requires special handling for nullable JSON fields
      updateData.evaluationCriteria = evaluationCriteria === null
        ? Prisma.DbNull
        : (evaluationCriteria as Prisma.InputJsonValue);
    }

    // Only update project if there are fields to update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updated: { name: string; companyName: string | null; evaluationCriteria: any };
    if (Object.keys(updateData).length > 0) {
      updated = await prisma.project.update({
        where: { id },
        data: updateData,
        select: { name: true, companyName: true, evaluationCriteria: true },
      });
    } else {
      const existing = await prisma.project.findUnique({
        where: { id },
        select: { name: true, companyName: true, evaluationCriteria: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      updated = existing;
    }

    // If companyName was set and user wants to update existing drafts
    if (companyName && updateExistingDrafts) {
      const requirements = await prisma.requirement.findMany({
        where: { projectId: id, draftAnswer: { not: null } },
        select: { id: true, draftAnswer: true },
      });

      const newCompanyName = companyName.trim();

      // Collect all updates to batch them
      const updates: { id: string; draftAnswer: string }[] = [];

      // Replace [COMPANY NAME] and optionally old company name in all existing drafts
      for (const req of requirements) {
        if (req.draftAnswer) {
          let newDraft = req.draftAnswer;

          // Replace [COMPANY NAME] placeholder (case-insensitive, handle variations)
          newDraft = newDraft.replace(/\[COMPANY\s*NAME\]/gi, newCompanyName);

          // If forceUpdate and there was an old company name, replace it too
          if (forceUpdate && oldCompanyName && oldCompanyName !== newCompanyName) {
            // Use word boundary to avoid partial matches
            const oldNameRegex = new RegExp(oldCompanyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            newDraft = newDraft.replace(oldNameRegex, newCompanyName);
          }

          // Only queue update if draft changed
          if (newDraft !== req.draftAnswer) {
            updates.push({ id: req.id, draftAnswer: newDraft });
          }
        }
      }

      // Batch update all requirements in a single transaction
      if (updates.length > 0) {
        await prisma.$transaction(
          updates.map((update) =>
            prisma.requirement.update({
              where: { id: update.id },
              data: { draftAnswer: update.draftAnswer },
            })
          )
        );
      }
    }

    return NextResponse.json({
      name: updated.name,
      companyName: updated.companyName,
      evaluationCriteria: updated.evaluationCriteria,
    });
  } catch (error) {
    console.error("Project update error:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Set RLS context for database-level user isolation
    await setRLSContext(session.user.id);

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Project delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
