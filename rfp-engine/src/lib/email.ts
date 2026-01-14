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

// =============================================================================
// SECURITY NOTIFICATION EMAILS
// =============================================================================

function securityEmailTemplate(title: string, message: string, actionText?: string): { html: string; text: string } {
  const settingsUrl = `${APP_URL}/settings`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f9fafb; border-radius: 8px; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #fef3c7; border-radius: 50%; padding: 12px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
          </div>

          <h1 style="color: #111; margin-bottom: 16px; font-size: 24px; text-align: center;">${title}</h1>

          <p style="color: #666; margin-bottom: 24px; text-align: center;">
            ${message}
          </p>

          ${actionText ? `
          <p style="color: #888; font-size: 14px; text-align: center; margin-bottom: 24px;">
            ${actionText}
          </p>
          ` : ''}

          <div style="text-align: center;">
            <a href="${settingsUrl}"
               style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500;">
              View Account Settings
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

          <p style="color: #888; font-size: 12px; text-align: center;">
            If you didn't make this change, please secure your account immediately by changing your password.
          </p>
        </div>

        <p style="text-align: center; color: #888; font-size: 12px; margin-top: 24px;">
          &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br>
          This is a security notification from RFP Matrix.
        </p>
      </body>
    </html>
  `;

  const text = `
${title}

${message}

${actionText || ''}

View your account settings: ${settingsUrl}

If you didn't make this change, please secure your account immediately by changing your password.

${APP_NAME}
  `.trim();

  return { html, text };
}

export async function sendPasswordChangedEmail(email: string) {
  const template = securityEmailTemplate(
    "Password Changed",
    "Your RFP Matrix password was successfully changed.",
    "If you made this change, no further action is needed."
  );

  return sendEmail({
    to: email,
    subject: `${APP_NAME}: Your password was changed`,
    html: template.html,
    text: template.text,
  });
}

export async function sendTwoFactorEnabledEmail(email: string) {
  const template = securityEmailTemplate(
    "Two-Factor Authentication Enabled",
    "Two-factor authentication (2FA) has been enabled on your RFP Matrix account.",
    "Your account is now more secure. You'll need your authenticator app to sign in."
  );

  return sendEmail({
    to: email,
    subject: `${APP_NAME}: 2FA has been enabled`,
    html: template.html,
    text: template.text,
  });
}

export async function sendTwoFactorDisabledEmail(email: string) {
  const template = securityEmailTemplate(
    "Two-Factor Authentication Disabled",
    "Two-factor authentication (2FA) has been disabled on your RFP Matrix account.",
    "Your account is now less secure. We recommend re-enabling 2FA for better protection."
  );

  return sendEmail({
    to: email,
    subject: `${APP_NAME}: 2FA has been disabled`,
    html: template.html,
    text: template.text,
  });
}

// =============================================================================
// SUBSCRIPTION NOTIFICATION EMAILS
// =============================================================================

export async function sendSubscriptionStartedEmail(email: string, planName: string) {
  const dashboardUrl = `${APP_URL}/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Confirmed</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f9fafb; border-radius: 8px; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #dcfce7; border-radius: 50%; padding: 12px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
            </div>
          </div>

          <h1 style="color: #111; margin-bottom: 16px; font-size: 24px; text-align: center;">Welcome to ${planName}!</h1>

          <p style="color: #666; margin-bottom: 24px; text-align: center;">
            Your subscription to the <strong>${planName}</strong> plan is now active. You have full access to all features included in your plan.
          </p>

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${dashboardUrl}"
               style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500;">
              Go to Dashboard
            </a>
          </div>

          <p style="color: #888; font-size: 14px; text-align: center;">
            You can manage your subscription anytime from your account settings.
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
Welcome to ${planName}!

Your subscription to the ${planName} plan is now active. You have full access to all features included in your plan.

Go to your dashboard: ${dashboardUrl}

You can manage your subscription anytime from your account settings.

${APP_NAME}
  `.trim();

  return sendEmail({
    to: email,
    subject: `${APP_NAME}: Welcome to ${planName}!`,
    html,
    text,
  });
}

export async function sendSubscriptionCancelledEmail(email: string, planName: string, endDate: string) {
  const pricingUrl = `${APP_URL}/pricing`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Cancelled</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f9fafb; border-radius: 8px; padding: 32px;">
          <h1 style="color: #111; margin-bottom: 16px; font-size: 24px; text-align: center;">Subscription Cancelled</h1>

          <p style="color: #666; margin-bottom: 24px; text-align: center;">
            Your <strong>${planName}</strong> subscription has been cancelled. You'll continue to have access until <strong>${endDate}</strong>.
          </p>

          <div style="background: #fef3c7; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #92400e; font-size: 14px; margin: 0; text-align: center;">
              After ${endDate}, your account will revert to the free tier with limited features.
            </p>
          </div>

          <p style="color: #666; margin-bottom: 24px; text-align: center;">
            Changed your mind? You can resubscribe anytime to regain full access.
          </p>

          <div style="text-align: center;">
            <a href="${pricingUrl}"
               style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500;">
              View Plans
            </a>
          </div>
        </div>

        <p style="text-align: center; color: #888; font-size: 12px; margin-top: 24px;">
          &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br>
          This is a transactional email from RFP Matrix.
        </p>
      </body>
    </html>
  `;

  const text = `
Subscription Cancelled

Your ${planName} subscription has been cancelled. You'll continue to have access until ${endDate}.

After ${endDate}, your account will revert to the free tier with limited features.

Changed your mind? You can resubscribe anytime: ${pricingUrl}

${APP_NAME}
  `.trim();

  return sendEmail({
    to: email,
    subject: `${APP_NAME}: Your subscription has been cancelled`,
    html,
    text,
  });
}
