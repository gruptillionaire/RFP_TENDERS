import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { id } = await params;
    const body = await request.json();
    const { name, companyName, updateExistingDrafts, forceUpdate } = body;

    // Validate at least one field is being updated (allow updateExistingDrafts alone)
    if (!name && companyName === undefined && !updateExistingDrafts) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
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
    const updateData: { name?: string; companyName?: string | null } = {};
    if (name) {
      updateData.name = name.trim();
    }
    if (companyName !== undefined) {
      updateData.companyName = companyName ? companyName.trim() : null;
    }

    // Only update project if there are fields to update
    let updated: { name: string; companyName: string | null };
    if (Object.keys(updateData).length > 0) {
      updated = await prisma.project.update({
        where: { id },
        data: updateData,
        select: { name: true, companyName: true },
      });
    } else {
      const existing = await prisma.project.findUnique({
        where: { id },
        select: { name: true, companyName: true },
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

    return NextResponse.json({ name: updated.name, companyName: updated.companyName });
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
