import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

/**
 * DELETE /api/requirements/[id] - Delete a single requirement
 *
 * Allows users to remove mistakenly extracted requirements from their projects.
 * Verifies ownership through the project relationship.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership through project
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        project: { select: { userId: true, id: true, name: true } },
      },
    });

    if (!requirement) {
      return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
    }

    if (requirement.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete the requirement (cascade deletes versions automatically via Prisma schema)
    await prisma.requirement.delete({
      where: { id },
    });

    // Log the deletion
    await logAudit({
      userId: session.user.id,
      action: AuditAction.REQUIREMENT_DELETE,
      resource: AuditResource.REQUIREMENT,
      resourceId: id,
      details: {
        projectId: requirement.projectId,
        projectName: requirement.project.name,
        requirementText: requirement.text.substring(0, 200), // Truncate for audit log
        section: requirement.section,
      },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Requirement delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete requirement" },
      { status: 500 }
    );
  }
}
