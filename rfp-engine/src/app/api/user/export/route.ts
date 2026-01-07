import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource, getAuditLogsForUser, getConsentHistory } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Log the export request
    await logAudit({
      userId,
      action: AuditAction.USER_EXPORT_REQUESTED,
      resource: AuditResource.USER,
      resourceId: userId,
      request,
    });

    // Fetch all user data
    const [user, projects, auditLogs, consentHistory] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          createdAt: true,
          updatedAt: true,
          termsAcceptedAt: true,
          privacyPolicyAcceptedAt: true,
          marketingConsentGiven: true,
          cookieConsentGiven: true,
          doNotSellData: true,
          // Exclude sensitive fields like passwordHash
        },
      }),
      prisma.project.findMany({
        where: { userId },
        include: {
          requirements: {
            select: {
              id: true,
              text: true,
              section: true,
              isMandatory: true,
              draftAnswer: true,
              internalNotes: true,
              wordLimit: true,
              characterLimit: true,
              status: true,
              type: true,
              domainContext: true,
              requiresReview: true,
              order: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      getAuditLogsForUser(userId, { limit: 1000 }),
      getConsentHistory(userId),
    ]);

    // Structure the export data
    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        userId,
        format: "json",
        version: "1.0",
      },
      profile: user,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        companyName: project.companyName,
        fileName: project.fileName,
        rawText: project.rawText,
        deadline: project.deadline,
        deadlineText: project.deadlineText,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        requirements: project.requirements,
      })),
      consentHistory,
      auditLogs: auditLogs.logs,
    };

    // Log successful export
    await logAudit({
      userId,
      action: AuditAction.USER_EXPORT_COMPLETED,
      resource: AuditResource.USER,
      resourceId: userId,
      details: {
        projectCount: projects.length,
        requirementCount: projects.reduce((acc, p) => acc + p.requirements.length, 0),
      },
      request,
    });

    // Return as downloadable JSON file
    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="rfp-engine-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Data export error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
