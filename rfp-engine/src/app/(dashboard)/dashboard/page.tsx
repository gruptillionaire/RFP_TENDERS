import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getQuotaStatus, getSingleUseQuotaStatus } from "@/lib/quota";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectCard } from "@/components/ProjectCard";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch all data in parallel for faster page load
  const [user, quota, singleUseQuota, projects] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, emailVerified: true },
    }),
    getQuotaStatus(session.user.id),
    getSingleUseQuotaStatus(session.user.id),
    prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        fileName: true,
        status: true,
        deadline: true,
        deadlineText: true,
        createdAt: true,
        _count: {
          select: { requirements: true },
        },
        requirements: {
          select: { status: true },
        },
      },
    }),
  ]);
  const userPlan = user?.plan || "FREE";

  // Auto-recovery: Fix projects marked FAILED that actually have requirements
  // This can happen when user navigates away during extraction but extraction succeeded
  // Use batch update to avoid N+1 query pattern
  const failedWithRequirements = projects
    .filter((p) => p.status === "FAILED" && p._count.requirements > 0)
    .map((p) => p.id);

  if (failedWithRequirements.length > 0) {
    // Use Set for O(1) lookup instead of includes() which is O(n)
    const failedIdsSet = new Set(failedWithRequirements);

    await prisma.project.updateMany({
      where: { id: { in: failedWithRequirements } },
      data: { status: "READY" },
    });
    // Update local state to match
    for (const p of projects) {
      if (failedIdsSet.has(p.id)) {
        p.status = "READY";
      }
    }
  }

  const getProgressStats = (requirements: { status: string }[]) => {
    const total = requirements.length;
    const answered = requirements.filter((r) => r.status === "ANSWERED").length;
    const partial = requirements.filter((r) => r.status === "PARTIAL").length;
    return { total, answered, partial, percentage: total > 0 ? Math.round((answered / total) * 100) : 0 };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Email Verification Banner */}
      <EmailVerificationBanner emailVerified={user?.emailVerified} />

      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-bold text-xl">
              RFP Matrix
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/dashboard"
                className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md"
              >
                Projects
              </Link>
              <Link
                href="/library"
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              >
                Library
              </Link>
              <Link
                href="/settings"
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session.user.email}</span>
            <form action={async () => {
              "use server";
              const { signOut } = await import("@/lib/auth");
              await signOut({ redirectTo: "/" });
            }}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Single-Use Credit Banner - Show when user has active single-use credits */}
        {singleUseQuota.hasCredits && (
          <div className="mb-4 p-4 rounded-lg border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-orange-800">
                  Single RFP Credit Active
                </p>
                <p className="text-sm text-orange-700">
                  Your next project will use your single-use credit ({singleUseQuota.extractionsRemaining} extraction{singleUseQuota.extractionsRemaining !== 1 ? 's' : ''}, {singleUseQuota.draftsRemaining} drafts remaining).
                  {singleUseQuota.expiresAt && (
                    <span className="ml-1">
                      Expires {new Date(singleUseQuota.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quota Banner - Different for free, unlimited, and limited paid users */}
        {userPlan === "FREE" && !singleUseQuota.hasCredits ? (
          /* Free tier - prompt to subscribe */
          <div className="mb-6 p-4 rounded-lg border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    Get started with RFP Matrix
                  </p>
                  <p className="text-sm text-gray-600">
                    Subscribe to extract requirements and generate AI drafts for your RFPs
                  </p>
                </div>
              </div>
              <Link href="/pricing">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  View Plans
                </Button>
              </Link>
            </div>
          </div>
        ) : quota.limit === -1 ? (
          /* Business tier - unlimited extractions */
          <div className="mb-6 p-4 rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  Unlimited extractions
                </p>
                <p className="text-sm text-gray-600">
                  {quota.used} extraction{quota.used === 1 ? "" : "s"} used this month
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Limited paid tiers - show quota */
          <div className={`mb-6 p-4 rounded-lg border ${
            quota.remaining === 0
              ? "bg-red-50 border-red-200"
              : quota.remaining <= 2
              ? "bg-yellow-50 border-yellow-200"
              : "bg-blue-50 border-blue-200"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  quota.remaining === 0
                    ? "bg-red-100"
                    : quota.remaining <= 2
                    ? "bg-yellow-100"
                    : "bg-blue-100"
                }`}>
                  <svg className={`w-5 h-5 ${
                    quota.remaining === 0
                      ? "text-red-600"
                      : quota.remaining <= 2
                      ? "text-yellow-600"
                      : "text-blue-600"
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {quota.remaining === 0
                      ? "Monthly limit reached"
                      : `${quota.remaining} extraction${quota.remaining === 1 ? "" : "s"} remaining`}
                  </p>
                  <p className="text-sm text-gray-600">
                    {quota.used} of {quota.limit} extractions used this month
                  </p>
                </div>
              </div>
              {quota.remaining === 0 && (
                <Link href="/pricing">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    Upgrade Plan
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Your Projects</h1>
            <p className="text-gray-600">Manage your RFP and tender responses</p>
          </div>
          <Link href="/projects/new">
            <Button disabled={quota.remaining === 0 && !singleUseQuota.hasCredits}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No projects yet</h3>
              <p className="text-gray-500 mb-4">Upload your first RFP to get started</p>
              <Link href="/projects/new">
                <Button>Create your first project</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Separate projects into active and completed */}
            {(() => {
              const now = new Date();
              const projectsWithStats = projects.map((project) => ({
                ...project,
                stats: getProgressStats(project.requirements),
                isPastDeadline: project.deadline ? new Date(project.deadline) < now : false,
              }));
              // Active projects: not 100% complete AND not past deadline, OR processing/failed
              const activeProjects = projectsWithStats.filter(p =>
                (p.stats.percentage < 100 && !p.isPastDeadline) || p.status === "PROCESSING" || p.status === "FAILED"
              );
              // Completed projects: 100% complete OR past deadline (silently moved)
              const completedProjects = projectsWithStats.filter(p =>
                (p.stats.percentage === 100 || p.isPastDeadline) && p.status !== "PROCESSING" && p.status !== "FAILED"
              );

              const renderProjectCard = (project: typeof projectsWithStats[0]) => (
                <ProjectCard key={project.id} project={project} />
              );

              return (
                <>
                  {/* Active Projects */}
                  {activeProjects.length > 0 && (
                    <div className="grid gap-4 mb-8">
                      {activeProjects.map(renderProjectCard)}
                    </div>
                  )}

                  {/* Completed Projects */}
                  {completedProjects.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-lg font-semibold text-gray-700">Completed Projects</h2>
                        <span className="text-sm text-gray-500">({completedProjects.length})</span>
                      </div>
                      <div className="grid gap-4">
                        {completedProjects.map(renderProjectCard)}
                      </div>
                    </div>
                  )}

                  {/* Show message if all projects are completed */}
                  {activeProjects.length === 0 && completedProjects.length > 0 && (
                    <div className="text-center px-6 py-12 mt-8 mb-8 bg-green-50 rounded-lg border border-green-200">
                      <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-green-800 font-medium">All projects completed!</p>
                      <p className="text-green-600 text-sm">Start a new project to continue working.</p>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}
