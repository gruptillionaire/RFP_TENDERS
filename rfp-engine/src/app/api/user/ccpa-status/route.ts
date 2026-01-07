import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { doNotSellData: true },
    });

    return NextResponse.json({
      doNotSellData: user?.doNotSellData || false,
    });
  } catch (error) {
    console.error("CCPA status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch CCPA status" },
      { status: 500 }
    );
  }
}
