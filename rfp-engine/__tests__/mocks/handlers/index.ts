/**
 * Combined Mock Handlers
 * Exports all handlers and reset functions
 */

export { stripeHandlers, resetStripeMocks, addMockCustomer, addMockSubscription, createWebhookEvent, createWebhookSignature } from './stripe';
export { openaiHandlers, resetOpenAIMocks, setMockResponse, setMockFailure, setMockDelay } from './openai';
export { resendHandlers, resetResendMocks, getSentEmails, getLastEmail, getEmailsTo, getEmailsBySubject, clearSentEmails, extractLinksFromEmail, extractTokenFromEmail } from './resend';
export { upstashHandlers, resetUpstashMocks, setRateLimitConfig, getStoreValue, setStoreValue } from './upstash';
export { flyioHandlers, resetFlyIOMocks, setAutoComplete, setCompletionDelay, setExtractionFailure, getExtractionJob, completeExtractionJob, failExtractionJob } from './flyio';

import { stripeHandlers } from './stripe';
import { openaiHandlers } from './openai';
import { resendHandlers } from './resend';
import { upstashHandlers } from './upstash';
import { flyioHandlers } from './flyio';

import { resetStripeMocks } from './stripe';
import { resetOpenAIMocks } from './openai';
import { resetResendMocks } from './resend';
import { resetUpstashMocks } from './upstash';
import { resetFlyIOMocks } from './flyio';

// All handlers combined
export const handlers = [
  ...stripeHandlers,
  ...openaiHandlers,
  ...resendHandlers,
  ...upstashHandlers,
  ...flyioHandlers,
];

// Reset all mock services
export function resetAllMocks(): void {
  resetStripeMocks();
  resetOpenAIMocks();
  resetResendMocks();
  resetUpstashMocks();
  resetFlyIOMocks();
}
