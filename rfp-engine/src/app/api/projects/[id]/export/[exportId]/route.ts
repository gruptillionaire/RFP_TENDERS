import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDocxMimeType } from "@/lib/export";

interface Props {
  params: Promise<{ id: string; exportId: string }>;
}

/**
 * GET /api/projects/[id]/export/[exportId]
 *
 * Download a cached export
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, exportId } = await params;

    // Fetch export with project to verify ownership
    const exportRecord = await prisma.projectExport.findUnique({
      where: { id: exportId },
      include: {
        project: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!exportRecord) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    // Verify ownership
    if (exportRecord.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify project ID matches
    if (exportRecord.projectId !== id) {
      return NextResponse.json({ error: "Export does not belong to this project" }, { status: 400 });
    }

    // Determine content type
    const contentType = exportRecord.format === "docx"
      ? getDocxMimeType()
      : "application/pdf";

    // Return the cached file
    return new NextResponse(exportRecord.fileData, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${exportRecord.fileName}"`,
        "Content-Length": String(exportRecord.fileSize),
      },
    });
  } catch (error) {
    console.error("Export download error:", error);
    return NextResponse.json(
      { error: "Failed to download export" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/export/[exportId]
 *
 * Delete a cached export
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, exportId } = await params;

    // Fetch export with project to verify ownership
    const exportRecord = await prisma.projectExport.findUnique({
      where: { id: exportId },
      include: {
        project: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!exportRecord) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    // Verify ownership
    if (exportRecord.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify project ID matches
    if (exportRecord.projectId !== id) {
      return NextResponse.json({ error: "Export does not belong to this project" }, { status: 400 });
    }

    // Delete the export
    await prisma.projectExport.delete({
      where: { id: exportId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Export delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete export" },
      { status: 500 }
    );
  }
}
