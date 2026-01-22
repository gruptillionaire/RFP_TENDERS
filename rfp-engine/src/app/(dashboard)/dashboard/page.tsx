import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDashboardUserData } from "@/lib/quota";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectCard } from "@/components/ProjectCard";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { QuotaBanner } from "@/components/QuotaBanner";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user data and projects in parallel (2 queries instead of 4)
  const [userData, projects] = await Promise.all([
    getDashboardUserData(session.user.id),
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

  const userPlan = userData?.plan || "FREE";
  const quota = userData?.quota || { allowed: false, used: 0, limit: 0, remaining: 0 };
  const singleUseQuota = userData?.singleUseQuota || { hasCredits: false, extractionsRemaining: 0, draftsRemaining: 0, expiresAt: null, isExpired: false };

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
      <EmailVerificationBanner emailVerified={userData?.emailVerified} />

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
        {/* Quota Banner with tooltips */}
        <QuotaBanner
          userPlan={userPlan}
          quota={quota}
          singleUseQuota={singleUseQuota}
        />

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
