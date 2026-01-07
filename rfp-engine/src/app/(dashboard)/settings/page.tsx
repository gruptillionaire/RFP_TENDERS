import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user's CCPA status
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      doNotSellData: true,
    },
  });

  return (
    <SettingsClient
      userEmail={user?.email || session.user.email || ""}
      userName={user?.name || session.user.name || null}
      initialCcpaOptOut={user?.doNotSellData || false}
    />
  );
}
