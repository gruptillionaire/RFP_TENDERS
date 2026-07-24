/**
 * MSW Server Instance
 * Sets up Mock Service Worker for intercepting HTTP requests in tests
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create MSW server with all handlers
export const server = setupServer(...handlers);

// Export handlers for use in specific tests
export { handlers };

// Re-export handler utilities
export {
  resetAllMocks,
  // Stripe
  resetStripeMocks,
  addMockCustomer,
  addMockSubscription,
  createWebhookEvent,
  createWebhookSignature,
  // OpenAI
  resetOpenAIMocks,
  setMockResponse,
  setMockFailure,
  setMockDelay,
  // Resend
  resetResendMocks,
  getSentEmails,
  getLastEmail,
  getEmailsTo,
  getEmailsBySubject,
  clearSentEmails,
  extractLinksFromEmail,
  extractTokenFromEmail,
  // Upstash
  resetUpstashMocks,
  setRateLimitConfig,
  getStoreValue,
  setStoreValue,
  // Fly.io
  resetFlyIOMocks,
  setAutoComplete,
  setCompletionDelay,
  setExtractionFailure,
  getExtractionJob,
  completeExtractionJob,
  failExtractionJob,
} from './handlers';
