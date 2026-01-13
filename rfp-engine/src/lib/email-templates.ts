/**
 * Email templates for the RFP Matrix application
 */

const APP_NAME = "RFP Matrix";

interface DeadlineReminderData {
  projectName: string;
  daysRemaining: number;
  deadlineDate: string;
  completionPercentage: number;
  mandatoryCompletionPercentage: number;
  projectUrl: string;
}

/**
 * Generate deadline reminder email
 */
export function deadlineReminderEmail(data: DeadlineReminderData): { subject: string; html: string; text: string } {
  const { projectName, daysRemaining, deadlineDate, completionPercentage, mandatoryCompletionPercentage, projectUrl } = data;

  let urgency: "low" | "medium" | "high" | "overdue";
  let subjectPrefix: string;
  let headerColor: string;

  if (daysRemaining <= 0) {
    urgency = "overdue";
    subjectPrefix = "OVERDUE";
    headerColor = "#dc2626"; // red-600
  } else if (daysRemaining === 1) {
    urgency = "high";
    subjectPrefix = "URGENT";
    headerColor = "#ea580c"; // orange-600
  } else if (daysRemaining <= 3) {
    urgency = "medium";
    subjectPrefix = "Reminder";
    headerColor = "#d97706"; // amber-600
  } else {
    urgency = "low";
    subjectPrefix = "Upcoming";
    headerColor = "#2563eb"; // blue-600
  }

  const subject = daysRemaining <= 0
    ? `[${subjectPrefix}] RFP deadline has passed: ${projectName}`
    : `[${subjectPrefix}] RFP deadline in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}: ${projectName}`;

  const urgencyMessage = daysRemaining <= 0
    ? `The submission deadline for <strong>${projectName}</strong> has passed.`
    : daysRemaining === 1
    ? `The submission deadline for <strong>${projectName}</strong> is <strong>tomorrow</strong>!`
    : `The submission deadline for <strong>${projectName}</strong> is in <strong>${daysRemaining} days</strong>.`;

  const progressBarColor = completionPercentage >= 80 ? "#22c55e" : completionPercentage >= 50 ? "#eab308" : "#ef4444";
  const mandatoryBarColor = mandatoryCompletionPercentage >= 100 ? "#22c55e" : mandatoryCompletionPercentage >= 80 ? "#eab308" : "#ef4444";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RFP Deadline Reminder</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
        <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: ${headerColor}; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">
              ${urgency === "overdue" ? "Deadline Passed" : "Deadline Reminder"}
            </h1>
          </div>

          <!-- Content -->
          <div style="padding: 32px;">
            <p style="color: #374151; margin-bottom: 24px; font-size: 16px;">
              ${urgencyMessage}
            </p>

            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Project:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500; text-align: right;">${projectName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Deadline:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500; text-align: right;">${deadlineDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Overall Progress:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500; text-align: right;">${completionPercentage}%</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Mandatory Complete:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500; text-align: right;">${mandatoryCompletionPercentage}%</td>
                </tr>
              </table>
            </div>

            <!-- Progress Bars -->
            <div style="margin-bottom: 24px;">
              <p style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Overall Progress</p>
              <div style="background: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden;">
                <div style="background: ${progressBarColor}; height: 100%; width: ${Math.min(completionPercentage, 100)}%;"></div>
              </div>
            </div>

            <div style="margin-bottom: 24px;">
              <p style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Mandatory Requirements</p>
              <div style="background: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden;">
                <div style="background: ${mandatoryBarColor}; height: 100%; width: ${Math.min(mandatoryCompletionPercentage, 100)}%;"></div>
              </div>
            </div>

            <a href="${projectUrl}"
               style="display: block; background: ${headerColor}; color: white; text-decoration: none; padding: 14px 24px; border-radius: 6px; font-weight: 500; text-align: center; margin-bottom: 16px;">
              ${urgency === "overdue" ? "View Project" : "Continue Working"}
            </a>

            ${urgency !== "overdue" && mandatoryCompletionPercentage < 100 ? `
            <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 12px; margin-top: 16px;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                <strong>Note:</strong> You have mandatory requirements that still need to be completed.
              </p>
            </div>
            ` : ""}
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              You're receiving this because you have a project with an upcoming deadline on ${APP_NAME}.
            </p>
          </div>
        </div>

        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
          &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
      </body>
    </html>
  `;

  const text = `
${urgency === "overdue" ? "DEADLINE PASSED" : "DEADLINE REMINDER"}

${daysRemaining <= 0
  ? `The submission deadline for "${projectName}" has passed.`
  : `The submission deadline for "${projectName}" is in ${daysRemaining} day(s).`}

Project: ${projectName}
Deadline: ${deadlineDate}
Overall Progress: ${completionPercentage}%
Mandatory Complete: ${mandatoryCompletionPercentage}%

View your project: ${projectUrl}

---
${APP_NAME}
  `.trim();

  return { subject, html, text };
}

interface WelcomeEmailData {
  userName: string;
  loginUrl: string;
}

/**
 * Generate welcome email for new users
 */
export function welcomeEmail(data: WelcomeEmailData): { subject: string; html: string; text: string } {
  const { userName, loginUrl } = data;
  const displayName = userName || "there";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${APP_NAME}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
        <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: #2563eb; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
              Welcome to ${APP_NAME}!
            </h1>
          </div>

          <!-- Content -->
          <div style="padding: 32px;">
            <p style="color: #374151; margin-bottom: 24px; font-size: 16px;">
              Hi ${displayName},
            </p>

            <p style="color: #374151; margin-bottom: 24px; font-size: 16px;">
              Thank you for signing up! We're excited to help you streamline your RFP response process with AI-powered requirement extraction and draft generation.
            </p>

            <h3 style="color: #111827; font-size: 16px; margin-bottom: 16px;">Getting Started:</h3>

            <ul style="color: #374151; margin-bottom: 24px; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Upload your first RFP document</li>
              <li style="margin-bottom: 8px;">Review AI-extracted requirements</li>
              <li style="margin-bottom: 8px;">Generate draft responses with AI</li>
              <li style="margin-bottom: 8px;">Export your completed response</li>
            </ul>

            <a href="${loginUrl}"
               style="display: block; background: #2563eb; color: white; text-decoration: none; padding: 14px 24px; border-radius: 6px; font-weight: 500; text-align: center;">
              Get Started
            </a>
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              If you have any questions, just reply to this email. We're here to help!
            </p>
          </div>
        </div>

        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
          &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
      </body>
    </html>
  `;

  const text = `
Welcome to ${APP_NAME}!

Hi ${displayName},

Thank you for signing up! We're excited to help you streamline your RFP response process with AI-powered requirement extraction and draft generation.

Getting Started:
- Upload your first RFP document
- Review AI-extracted requirements
- Generate draft responses with AI
- Export your completed response

Get started: ${loginUrl}

---
${APP_NAME}
  `.trim();

  return {
    subject: `Welcome to ${APP_NAME}!`,
    html,
    text,
  };
}
