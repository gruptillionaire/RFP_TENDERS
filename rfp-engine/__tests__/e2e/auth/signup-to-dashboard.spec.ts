/**
 * E2E Test: Signup to Dashboard Flow
 * Tests complete user journey from signup to dashboard access
 */

import { test, expect } from '@playwright/test';

// Generate unique email for each test run
const generateTestEmail = () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

test.describe('Signup to Dashboard Flow', () => {
  test('complete signup flow with valid credentials', async ({ page }) => {
    const testEmail = generateTestEmail();
    const testPassword = 'TestPassword123!';

    // Navigate to signup page
    await page.goto('/signup');
    await expect(page).toHaveURL(/\/signup/);

    // Fill signup form
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirmPassword"]', testPassword);

    // Accept terms and privacy
    await page.check('input[name="acceptTerms"]');
    await page.check('input[name="acceptPrivacy"]');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to verification page or show success message
    await expect(page.getByText(/verify|email|sent/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows validation errors for weak password', async ({ page }) => {
    await page.goto('/signup');

    // Fill with weak password
    await page.fill('input[name="email"]', generateTestEmail());
    await page.fill('input[name="password"]', 'weak');
    await page.fill('input[name="confirmPassword"]', 'weak');

    // Try to submit
    await page.check('input[name="acceptTerms"]');
    await page.check('input[name="acceptPrivacy"]');
    await page.click('button[type="submit"]');

    // Should show password validation error
    await expect(page.getByText(/password|characters|uppercase|lowercase|number|special/i)).toBeVisible();
  });

  test('shows error for duplicate email', async ({ page }) => {
    // This test assumes a test user already exists
    // In real E2E tests, you'd seed the database first

    await page.goto('/signup');

    // Fill with existing email
    await page.fill('input[name="email"]', 'existing@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');

    await page.check('input[name="acceptTerms"]');
    await page.check('input[name="acceptPrivacy"]');
    await page.click('button[type="submit"]');

    // Should show duplicate email error
    await expect(page.getByText(/already exists|account.*exists/i)).toBeVisible();
  });

  test('requires terms and privacy acceptance', async ({ page }) => {
    await page.goto('/signup');

    await page.fill('input[name="email"]', generateTestEmail());
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');

    // Don't check terms or privacy
    await page.click('button[type="submit"]');

    // Should show consent error or disable submit
    await expect(page.getByText(/terms|privacy|accept/i)).toBeVisible();
  });
});

test.describe('Login Flow', () => {
  test('successful login redirects to dashboard', async ({ page }) => {
    // This test requires a seeded test user
    // In CI, you'd run database seeds before E2E tests

    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard (or show 2FA if enabled)
    await expect(page.locator('body')).toContainText(/dashboard|2fa|verify/i, { timeout: 10000 });
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'WrongPassword123!');

    await page.click('button[type="submit"]');

    // Should show login error
    await expect(page.getByText(/invalid|incorrect|wrong|failed/i)).toBeVisible();
  });

  test('navigates to forgot password', async ({ page }) => {
    await page.goto('/login');

    // Click forgot password link
    await page.click('text=/forgot.*password/i');

    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

test.describe('Navigation', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('can navigate between auth pages', async ({ page }) => {
    // Start at login
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Navigate to signup
    await page.click('text=/sign.*up|create.*account|register/i');
    await expect(page).toHaveURL(/\/signup/);

    // Navigate back to login
    await page.click('text=/sign.*in|log.*in|already.*account/i');
    await expect(page).toHaveURL(/\/login/);
  });
});
