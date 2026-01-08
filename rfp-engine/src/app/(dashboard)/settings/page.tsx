import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user's CCPA status and billing info
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      doNotSellData: true,
      plan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      stripeCustomerId: true,
      monthlyExtractionsUsed: true,
      monthlyExtractionsLimit: true,
    },
  });

  return (
    <SettingsClient
      userEmail={user?.email || session.user.email || ""}
      userName={user?.name || session.user.name || null}
      initialCcpaOptOut={user?.doNotSellData || false}
      billingInfo={{
        plan: user?.plan || "FREE",
        subscriptionStatus: user?.subscriptionStatus || null,
        currentPeriodEnd: user?.currentPeriodEnd?.toISOString() || null,
        cancelAtPeriodEnd: user?.cancelAtPeriodEnd || false,
        hasStripeAccount: !!user?.stripeCustomerId,
        usage: {
          extractionsUsed: user?.monthlyExtractionsUsed || 0,
          extractionsLimit: user?.monthlyExtractionsLimit || 2,
        },
      }}
    />
  );
}
