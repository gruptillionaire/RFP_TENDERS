/**
 * Resend Email API Mock Handlers
 * Captures sent emails for assertion in tests
 */

import { http, HttpResponse } from 'msw';

// Store sent emails for test assertions
interface SentEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  sentAt: Date;
}

const sentEmails: SentEmail[] = [];

// Get all sent emails
export function getSentEmails(): SentEmail[] {
  return [...sentEmails];
}

// Get emails sent to a specific address
export function getEmailsTo(email: string): SentEmail[] {
  return sentEmails.filter(e => e.to.includes(email));
}

// Get last email sent
export function getLastEmail(): SentEmail | undefined {
  return sentEmails[sentEmails.length - 1];
}

// Get emails by subject (partial match)
export function getEmailsBySubject(subject: string): SentEmail[] {
  return sentEmails.filter(e =>
    e.subject.toLowerCase().includes(subject.toLowerCase())
  );
}

// Clear sent emails
export function clearSentEmails(): void {
  sentEmails.length = 0;
}

// Reset mock state
export function resetResendMocks(): void {
  clearSentEmails();
}

// Extract links from HTML content
export function extractLinksFromEmail(email: SentEmail): string[] {
  const html = email.html || '';
  const linkRegex = /href=["']([^"']+)["']/g;
  const links: string[] = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    links.push(match[1]);
  }
  return links;
}

// Extract verification token from email link
export function extractTokenFromEmail(email: SentEmail, tokenParam = 'token'): string | null {
  const links = extractLinksFromEmail(email);
  for (const link of links) {
    try {
      const url = new URL(link, 'http://localhost');
      const token = url.searchParams.get(tokenParam);
      if (token) return token;
    } catch {
      // Invalid URL, skip
    }
  }
  return null;
}

export const resendHandlers = [
  // Send email
  http.post('https://api.resend.com/emails', async ({ request }) => {
    const body = await request.json() as {
      from: string;
      to: string | string[];
      subject: string;
      html?: string;
      text?: string;
    };

    const email: SentEmail = {
      id: `email_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      from: body.from,
      to: Array.isArray(body.to) ? body.to : [body.to],
      subject: body.subject,
      html: body.html,
      text: body.text,
      sentAt: new Date(),
    };

    sentEmails.push(email);

    return HttpResponse.json({
      id: email.id,
    });
  }),

  // Get email status
  http.get('https://api.resend.com/emails/:id', ({ params }) => {
    const email = sentEmails.find(e => e.id === params.id);

    if (!email) {
      return HttpResponse.json(
        { error: { message: 'Email not found' } },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      id: email.id,
      from: email.from,
      to: email.to,
      subject: email.subject,
      created_at: email.sentAt.toISOString(),
      status: 'delivered',
    });
  }),
];
