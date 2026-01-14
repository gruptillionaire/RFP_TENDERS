import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDeadlineReminderEmail } from "@/lib/email";

// Cron secret for security
const CRON_SECRET = process.env.CRON_SECRET;

// Reminder thresholds in days
const REMINDER_THRESHOLDS = [
  { days: 7, type: "7d" },
  { days: 3, type: "3d" },
  { days: 1, type: "1d" },
  { days: 0, type: "overdue" }, // On the day or after
] as const;

function getDaysUntilDeadline(deadline: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const diffTime = deadlineDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function shouldSendReminder(
  daysRemaining: number,
  lastReminderType: string | null
): { shouldSend: boolean; reminderType: string | null } {
  // Find the appropriate reminder threshold
  for (const threshold of REMINDER_THRESHOLDS) {
    if (threshold.days === 0 && daysRemaining <= 0) {
      // Only send overdue reminder once
      if (lastReminderType !== "overdue") {
        return { shouldSend: true, reminderType: "overdue" };
      }
      return { shouldSend: false, reminderType: null };
    }

    if (daysRemaining === threshold.days && lastReminderType !== threshold.type) {
      return { shouldSend: true, reminderType: threshold.type };
    }
  }

  return { shouldSend: false, reminderType: null };
}

function calculateCompletionStats(requirements: { status: string; isMandatory: boolean }[]): {
  completionPercentage: number;
  mandatoryCompletionPercentage: number;
} {
  const total = requirements.length;
  const mandatory = requirements.filter(r => r.isMandatory);

  if (total === 0) {
    return { completionPercentage: 100, mandatoryCompletionPercentage: 100 };
  }

  const answered = requirements.filter(r => r.status === "ANSWERED").length;
  const partial = requirements.filter(r => r.status === "PARTIAL").length;
  const completionPercentage = Math.round(((answered + partial * 0.5) / total) * 100);

  if (mandatory.length === 0) {
    return { completionPercentage, mandatoryCompletionPercentage: 100 };
  }

  const mandatoryAnswered = mandatory.filter(r => r.status === "ANSWERED").length;
  const mandatoryPartial = mandatory.filter(r => r.status === "PARTIAL").length;
  const mandatoryCompletionPercentage = Math.round(
    ((mandatoryAnswered + mandatoryPartial * 0.5) / mandatory.length) * 100
  );

  return { completionPercentage, mandatoryCompletionPercentage };
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    console.log("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Use production domain for email links, strip trailing slashes
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://rfpmatrix.com").replace(/\/+$/, "");

    // Find projects with deadlines that need reminders
    // Look for projects with deadlines between -1 day (overdue) and +8 days from now
    const now = new Date();
    const overdueDate = new Date(now);
    overdueDate.setDate(overdueDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 8);

    const projects = await prisma.project.findMany({
      where: {
        deadline: {
          gte: overdueDate,
          lte: futureDate,
        },
        status: {
          in: ["READY", "PROCESSING"],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        requirements: {
          select: {
            status: true,
            isMandatory: true,
          },
        },
      },
    });

    const results: { projectId: string; projectName: string; reminderType: string; success: boolean }[] = [];

    for (const project of projects) {
      if (!project.deadline || !project.user.email) continue;

      const daysRemaining = getDaysUntilDeadline(project.deadline);
      const { shouldSend, reminderType } = shouldSendReminder(daysRemaining, project.lastReminderType);

      if (!shouldSend || !reminderType) continue;

      const { completionPercentage, mandatoryCompletionPercentage } = calculateCompletionStats(project.requirements);

      const projectUrl = `${baseUrl}/projects/${project.id}`;
      const deadlineDate = project.deadline.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      try {
        const emailResult = await sendDeadlineReminderEmail({
          email: project.user.email,
          projectName: project.name,
          daysRemaining,
          deadlineDate,
          completionPercentage,
          mandatoryCompletionPercentage,
          projectUrl,
        });

        if (emailResult.success) {
          // Update project with reminder sent
          await prisma.project.update({
            where: { id: project.id },
            data: {
              lastReminderSent: new Date(),
              lastReminderType: reminderType,
            },
          });

          results.push({
            projectId: project.id,
            projectName: project.name,
            reminderType,
            success: true,
          });

          console.log(`Sent ${reminderType} reminder for project: ${project.name}`);
        } else {
          results.push({
            projectId: project.id,
            projectName: project.name,
            reminderType,
            success: false,
          });

          console.error(`Failed to send reminder for project: ${project.name}`, emailResult.error);
        }
      } catch (error) {
        console.error(`Error sending reminder for project: ${project.name}`, error);
        results.push({
          projectId: project.id,
          projectName: project.name,
          reminderType,
          success: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: projects.length,
      remindersSent: results.filter(r => r.success).length,
      results,
    });
  } catch (error) {
    console.error("Deadline reminder cron error:", error);
    return NextResponse.json(
      { error: "Failed to process deadline reminders" },
      { status: 500 }
    );
  }
}
