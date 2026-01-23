import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlanLimits } from "@/lib/stripe";
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
      stripeSubscriptionId: true,
      monthlyExtractionsUsed: true,
      monthlyDraftsUsed: true,
      // Single-use credits
      singleUseExtractionsRemaining: true,
      singleUseDraftsRemaining: true,
      singleUseExpiresAt: true,
    },
  });

  // Check if this is an expired granted subscription (no Stripe ID, past currentPeriodEnd)
  const isGrantedSubscription =
    user?.plan && ["STARTER", "PRO", "BUSINESS"].includes(user.plan) && !user.stripeSubscriptionId;
  const grantExpired =
    isGrantedSubscription &&
    user?.currentPeriodEnd &&
    new Date() > user.currentPeriodEnd;

  // Use effective plan for expired grants
  const effectivePlan = grantExpired ? "FREE" : (user?.plan || "FREE");

  // Get plan limits for the effective plan
  const planLimits = getPlanLimits(effectivePlan);

  // Calculate single-use status
  const singleUseExpired = user?.singleUseExpiresAt
    ? new Date() > user.singleUseExpiresAt
    : false;

  return (
    <SettingsClient
      userEmail={user?.email || session.user.email || ""}
      userName={user?.name || session.user.name || null}
      initialCcpaOptOut={user?.doNotSellData || false}
      billingInfo={{
        plan: effectivePlan,
        subscriptionStatus: grantExpired ? null : (user?.subscriptionStatus || null),
        currentPeriodEnd: grantExpired ? null : (user?.currentPeriodEnd?.toISOString() || null),
        cancelAtPeriodEnd: user?.cancelAtPeriodEnd || false,
        hasStripeAccount: !!user?.stripeCustomerId,
        usage: {
          extractionsUsed: user?.monthlyExtractionsUsed || 0,
          extractionsLimit: planLimits.monthlyExtractions,
          draftsUsed: user?.monthlyDraftsUsed || 0,
          draftsLimit: planLimits.monthlyDrafts,
        },
        limits: {
          canExportWord: planLimits.canExportWord,
          canUseLibrary: planLimits.canUseLibrary,
        },
        singleUse: {
          hasCredits: (user?.singleUseExtractionsRemaining || 0) > 0 && !singleUseExpired,
          extractionsRemaining: singleUseExpired ? 0 : (user?.singleUseExtractionsRemaining || 0),
          draftsRemaining: singleUseExpired ? 0 : (user?.singleUseDraftsRemaining || 0),
          expiresAt: user?.singleUseExpiresAt?.toISOString() || null,
          isExpired: singleUseExpired,
        },
      }}
    />
  );
}
