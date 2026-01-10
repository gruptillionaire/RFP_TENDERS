import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)),
      MAX_LIMIT
    );
    const offset = parseInt(searchParams.get("offset") || "0");

    // Verify ownership through project
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } },
    });

    if (!requirement || requirement.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get version history
    const [versions, totalCount] = await Promise.all([
      prisma.requirementVersion.findMany({
        where: { requirementId: id },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          editedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.requirementVersion.count({
        where: { requirementId: id },
      }),
    ]);

    return NextResponse.json({
      versions,
      totalCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Version history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch version history" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { versionId } = await request.json();

    if (!versionId || typeof versionId !== "string") {
      return NextResponse.json({ error: "Version ID is required" }, { status: 400 });
    }

    // Verify ownership through project
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } },
    });

    if (!requirement || requirement.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get the version to restore
    const version = await prisma.requirementVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.requirementId !== id) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Restore the version and create a new version entry for the current state
    const updated = await prisma.$transaction(async (tx) => {
      // Create version entry for the current state before restoring
      if (requirement.draftAnswer !== null) {
        await tx.requirementVersion.create({
          data: {
            requirementId: id,
            draftAnswer: requirement.draftAnswer,
            status: requirement.status,
            editedById: session.user.id,
            changeSource: "restored",
          },
        });
      }

      // Update the requirement with the restored version
      return tx.requirement.update({
        where: { id },
        data: {
          draftAnswer: version.draftAnswer,
          status: version.status,
        },
      });
    });

    // Log the restore action
    await logAudit({
      userId: session.user.id,
      action: AuditAction.REQUIREMENT_UPDATE,
      resource: AuditResource.REQUIREMENT,
      resourceId: id,
      details: {
        action: "restore_version",
        restoredVersionId: versionId,
        projectId: requirement.projectId,
      },
      request,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Version restore error:", error);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 }
    );
  }
}
