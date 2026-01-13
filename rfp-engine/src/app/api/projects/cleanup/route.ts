import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/projects/cleanup - Delete all stuck PROCESSING projects
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all PROCESSING and FAILED projects for this user
    const result = await prisma.project.deleteMany({
      where: {
        userId: session.user.id,
        status: { in: ["PROCESSING", "FAILED"] },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Deleted ${result.count} stuck/failed projects`,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup projects" },
      { status: 500 }
    );
  }
}
