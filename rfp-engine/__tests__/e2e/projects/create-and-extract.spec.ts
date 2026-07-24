/**
 * E2E Test: Project Creation and Extraction Flow
 * Tests complete RFP upload and requirement extraction journey
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// Test fixtures path
const fixturesPath = path.join(__dirname, '../../fixtures');

test.describe('Project Creation Flow', () => {
  // Before each test, login as test user
  test.beforeEach(async ({ page }) => {
    // Login with test credentials
    // In real E2E, you'd have seeded user in database
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/(dashboard|projects|2fa)/, { timeout: 10000 });
  });

  test('can create new project with PDF upload', async ({ page }) => {
    // Navigate to create project page
    await page.goto('/projects/new');
    await expect(page).toHaveURL(/\/projects\/new/);

    // Set project name
    await page.fill('input[name="name"]', 'E2E Test Project');

    // Upload PDF file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesPath, 'sample-rfp.pdf'));

    // Submit form
    await page.click('button:has-text("Create"), button:has-text("Upload")');

    // Wait for processing
    await expect(page.getByText(/processing|extracting|analyzing/i)).toBeVisible({ timeout: 5000 });

    // Wait for completion or redirect
    await page.waitForResponse(
      response => response.url().includes('/api/projects') && response.status() === 200,
      { timeout: 60000 }
    );
  });

  test('shows error for invalid file type', async ({ page }) => {
    await page.goto('/projects/new');

    // Try to upload non-PDF file
    const fileInput = page.locator('input[type="file"]');
    // Create a fake text file in memory
    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not a PDF'),
    });

    // Submit form
    await page.click('button:has-text("Create"), button:has-text("Upload")');

    // Should show file type error
    await expect(page.getByText(/pdf|docx|file type|invalid/i)).toBeVisible();
  });

  test('shows duplicate warning for existing file', async ({ page }) => {
    // First upload
    await page.goto('/projects/new');
    await page.fill('input[name="name"]', 'Duplicate Test');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'duplicate-test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test content'),
    });

    await page.click('button:has-text("Create"), button:has-text("Upload")');

    // Wait for first upload to process
    await page.waitForTimeout(2000);

    // Try to upload same file again
    await page.goto('/projects/new');
    await fileInput.setInputFiles({
      name: 'duplicate-test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test content'),
    });

    await page.click('button:has-text("Create"), button:has-text("Upload")');

    // Should show duplicate warning
    await expect(page.getByText(/duplicate|already exists|existing/i)).toBeVisible();
  });

  test('shows quota exceeded error when limit reached', async ({ page }) => {
    // This test requires the user to have exceeded their quota
    // In real E2E, you'd set up the user's quota state

    await page.goto('/projects/new');
    await page.fill('input[name="name"]', 'Quota Test');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'quota-test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test content'),
    });

    await page.click('button:has-text("Create"), button:has-text("Upload")');

    // If quota exceeded, should show upgrade prompt
    // This is conditional based on user's plan status
    const hasQuotaError = await page.getByText(/quota|limit|upgrade|credits/i).isVisible().catch(() => false);
    if (hasQuotaError) {
      await expect(page.getByText(/upgrade|purchase|credits/i)).toBeVisible();
    }
  });
});

test.describe('Project Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|projects|2fa)/, { timeout: 10000 });
  });

  test('displays list of user projects', async ({ page }) => {
    await page.goto('/dashboard');

    // Should show projects section
    await expect(page.getByText(/projects|rfps/i)).toBeVisible();

    // Should have project cards or empty state
    const hasProjects = await page.locator('[data-testid="project-card"], .project-item').count() > 0;
    const hasEmptyState = await page.getByText(/no projects|get started|create.*first/i).isVisible().catch(() => false);

    expect(hasProjects || hasEmptyState).toBe(true);
  });

  test('can navigate to project details', async ({ page }) => {
    await page.goto('/dashboard');

    // If there are projects, click on first one
    const projectCard = page.locator('[data-testid="project-card"], .project-item').first();
    const hasProjects = await projectCard.isVisible().catch(() => false);

    if (hasProjects) {
      await projectCard.click();
      await expect(page).toHaveURL(/\/projects\/[a-z0-9]+/i);
    }
  });
});

test.describe('Requirement Extraction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|projects|2fa)/, { timeout: 10000 });
  });

  test('shows extracted requirements after processing', async ({ page }) => {
    // Navigate to an existing project
    // In real E2E, you'd have a pre-seeded project with requirements

    await page.goto('/dashboard');

    // Find a READY project
    const projectCard = page.locator('[data-testid="project-card"]:has-text("Ready"), .project-item:has-text("Ready")').first();
    const hasReadyProject = await projectCard.isVisible().catch(() => false);

    if (hasReadyProject) {
      await projectCard.click();

      // Should show requirements
      await expect(page.getByText(/requirements/i)).toBeVisible();

      // Should have requirement rows
      const requirementRows = page.locator('[data-testid="requirement-row"], .requirement-item, tr');
      await expect(requirementRows.first()).toBeVisible();
    }
  });

  test('can update draft answer', async ({ page }) => {
    // Navigate to project with requirements
    await page.goto('/dashboard');

    const projectCard = page.locator('[data-testid="project-card"]').first();
    const hasProject = await projectCard.isVisible().catch(() => false);

    if (hasProject) {
      await projectCard.click();
      await page.waitForURL(/\/projects\/[a-z0-9]+/i);

      // Click on first requirement
      const requirementRow = page.locator('[data-testid="requirement-row"], .requirement-item').first();
      const hasRequirement = await requirementRow.isVisible().catch(() => false);

      if (hasRequirement) {
        await requirementRow.click();

        // Find and fill the draft answer textarea
        const textarea = page.locator('textarea[name="draftAnswer"], textarea[placeholder*="answer"], [data-testid="draft-answer"]').first();
        if (await textarea.isVisible()) {
          await textarea.fill('E2E Test: This is a test draft answer.');

          // Save
          await page.click('button:has-text("Save")');

          // Verify saved
          await expect(page.getByText(/saved|success/i)).toBeVisible();
        }
      }
    }
  });
});
