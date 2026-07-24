/**
 * Test Factories Index
 * Re-exports all factories for convenient importing
 */

import { resetUserFactory } from './user';
import { resetProjectFactory } from './project';
import { resetSubscriptionFactory } from './subscription';

// User factories
export {
  createMockUser,
  createUserData,
  createSubscribedUser,
  createTwoFactorUser,
  getDefaultPassword,
  resetUserFactory,
  type MockUser,
  type CreateUserOptions,
} from './user';

// Project and requirement factories
export {
  createMockProject,
  createProjectData,
  createMockRequirement,
  createRequirementData,
  createSampleRequirements,
  createProjectWithRequirements,
  getSampleRfpText,
  resetProjectFactory,
  type MockProject,
  type MockRequirement,
  type CreateProjectOptions,
  type CreateRequirementOptions,
} from './project';

// Subscription and billing factories
export {
  createMockSubscription,
  createMockCustomer,
  createMockCheckoutSession,
  createMockPaymentIntent,
  createWebhookPayload,
  createSubscriptionCreatedEvent,
  createSubscriptionUpdatedEvent,
  createSubscriptionDeletedEvent,
  createCheckoutCompletedEvent,
  createInvoicePaidEvent,
  createInvoicePaymentFailedEvent,
  getPriceId,
  resetSubscriptionFactory,
  type MockStripeSubscription,
  type MockStripeCustomer,
  type MockStripeCheckoutSession,
  type MockStripePaymentIntent,
  type CreateSubscriptionOptions,
  type CreateCustomerOptions,
  type CreateCheckoutSessionOptions,
  type CreatePaymentIntentOptions,
} from './subscription';

/**
 * Reset all factories (call in beforeEach for isolated tests)
 */
export function resetAllFactories(): void {
  resetUserFactory();
  resetProjectFactory();
  resetSubscriptionFactory();
}
