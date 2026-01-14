import { Resend } from "resend";
import crypto from "crypto";
import { deadlineReminderEmail } from "./email-templates";

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@rfpmatrix.com";
const APP_NAME = "RFP Matrix";
const APP_URL = "https://rfpmatrix.com";

// Lazy initialization to avoid errors during build when API key is not set
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const client = getResendClient();

  // In development without API key, log the email instead
  if (!client) {
    console.log("========================================");
    console.log("EMAIL WOULD BE SENT (no RESEND_API_KEY):");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("HTML:", html);
    console.log("========================================");
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const { data, error } = await client.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      replyTo: FROM_EMAIL,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for plain text
      headers: {
        "X-Entity-Ref-ID": crypto.randomUUID(), // Prevent threading/grouping
      },
    });

    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  // Use APP_URL for emails (always production domain), strip trailing slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || APP_URL).replace(/\/+$/, "");
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f9fafb; border-radius: 8px; padding: 32px; text-align: center;">
          <h1 style="color: #111; margin-bottom: 24px; font-size: 24px;">Reset Your Password</h1>

          <p style="color: #666; margin-bottom: 24px;">
            You requested to reset your password for your ${APP_NAME} account.
            Click the button below to set a new password.
          </p>

          <a href="${resetUrl}"
             style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; margin-bottom: 24px;">
            Reset Password
          </a>

          <p style="color: #888; font-size: 14px; margin-top: 24px;">
            This link will expire in 1 hour. If you didn't request a password reset,
            you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

          <p style="color: #888; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:
            <br>
            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>

        <p style="text-align: center; color: #888; font-size: 12px; margin-top: 24px;">
          &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br>
          This is a transactional email from RFP Matrix.
        </p>
      </body>
    </html>
  `;

  const text = `
Reset Your Password

You requested to reset your password for your ${APP_NAME} account.

Click the link below to set a new password:
${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

${APP_NAME}
  `.trim();

  return sendEmail({
    to: email,
    subject: `${APP_NAME}: Password reset request`,
    html,
    text,
  });
}

export interface DeadlineReminderParams {
  email: string;
  projectName: string;
  daysRemaining: number;
  deadlineDate: string;
  completionPercentage: number;
  mandatoryCompletionPercentage: number;
  projectUrl: string;
}

export async function sendDeadlineReminderEmail(params: DeadlineReminderParams) {
  const template = deadlineReminderEmail({
    projectName: params.projectName,
    daysRemaining: params.daysRemaining,
    deadlineDate: params.deadlineDate,
    completionPercentage: params.completionPercentage,
    mandatoryCompletionPercentage: params.mandatoryCompletionPercentage,
    projectUrl: params.projectUrl,
  });

  return sendEmail({
    to: params.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}
