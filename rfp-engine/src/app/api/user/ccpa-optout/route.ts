import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { optOut } = await request.json();

    if (typeof optOut !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    // Update user's CCPA preference
    await prisma.user.update({
      where: { id: session.user.id },
      data: { doNotSellData: optOut },
    });

    // Log the CCPA action
    await logAudit({
      userId: session.user.id,
      action: optOut ? AuditAction.CCPA_OPTOUT : AuditAction.CCPA_OPTIN,
      resource: AuditResource.USER,
      resourceId: session.user.id,
      details: { doNotSellData: optOut },
      request,
    });

    return NextResponse.json({
      success: true,
      doNotSellData: optOut,
    });
  } catch (error) {
    console.error("CCPA opt-out error:", error);
    return NextResponse.json(
      { error: "Failed to update preference" },
      { status: 500 }
    );
  }
}
