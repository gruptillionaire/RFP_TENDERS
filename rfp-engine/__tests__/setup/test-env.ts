/**
 * Test Environment Variables
 * Sets up mock environment variables for testing
 */

// Database - use test database URL if available, otherwise mock
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/rfp_test';

// NextAuth
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-only';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Stripe - test keys (not real keys)
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
process.env.STRIPE_STARTER_PRICE_ID = 'price_test_starter';
process.env.STRIPE_PRO_PRICE_ID = 'price_test_pro';
process.env.STRIPE_BUSINESS_PRICE_ID = 'price_test_business';
process.env.STRIPE_SINGLE_USE_PRICE_ID = 'price_test_single_use';

// OpenAI - mock key
process.env.OPENAI_API_KEY = 'sk-test-mock-openai-key';

// Upstash Redis - mock configuration (tests will use in-memory mock)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-redis-token';

// Resend email - mock key
process.env.RESEND_API_KEY = 're_test_mock_resend_key';

// Fly.io extraction worker
process.env.FLY_EXTRACTION_URL = 'https://rfp-extraction-worker.fly.dev';

// App configuration
process.env.NODE_ENV = 'test';

export {};
