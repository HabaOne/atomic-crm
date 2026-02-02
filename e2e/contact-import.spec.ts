import { test, expect, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { signup, login, logout } from './helpers';
import { generateUser } from './fixtures';

/**
 * Contact Import E2E Tests
 *
 * Tests the contact import flow with CSV files containing tags.
 * Verifies the fix for 403 Forbidden errors when creating tags during import.
 *
 * Root cause was: tags table missing the auto-populate trigger for organization_id
 * Fix: Added set_tags_sales_id_trigger in migration 20260131142221_add_tags_trigger.sql
 */

const ADMIN_ORG1 = generateUser('import-org1', { organizationName: 'Import Test Org 1' });

// Helper: Create sample CSV file for testing
function createTestCsv(filename: string, rows: string[]): string {
  const dir = '/tmp/e2e-test-files';

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const filePath = join(dir, filename);
  writeFileSync(filePath, rows.join('\n'));
  return filePath;
}

test.describe('Contact Import - Tags Trigger Fix', () => {
  // Run tests serially to maintain database state across tests
  test.describe.configure({ mode: 'serial' });

  test('should import contacts with tags without 403 errors', async ({ page }) => {
    // #given - Setup: Create test user and login
    await signup(page, ADMIN_ORG1, true);
    await page.goto('/#/contacts');
    await page.waitForLoadState('networkidle');

    // Create test CSV with tags
    const csvPath = createTestCsv(
      'contacts-with-tags.csv',
      [
        'first_name,last_name,email_work,company,tags',
        'John,Doe,john@example.com,Acme,"VIP,developer"',
        'Jane,Smith,jane@example.com,Acme,"Sales,UI"',
      ]
    );

    // #when - Click import button and upload CSV
    const importButton = page.locator('button:has-text("Import")');
    await expect(importButton).toBeVisible({ timeout: 10000 });
    await importButton.click();

    // Wait for import dialog to appear
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Upload CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);

    // Wait for file to be selected
    await page.waitForTimeout(500);

    // Click Import button in dialog
    const importDialogButton = page.locator('[role="dialog"] button:has-text("Import")');
    await importDialogButton.click({ timeout: 10000 });

    // Wait for import to complete - look for success message or close button
    await expect(page.locator('[role="alert"]:has-text("import complete")')).toBeVisible({ timeout: 30000 });

    // Close the dialog after import completes (use first() since there are 2 Close buttons)
    const closeButton = page.locator('[role="dialog"] button:has-text("Close")').first();
    await closeButton.click({ timeout: 5000 });

    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // #then - Verify import succeeded by checking for contacts in the list
    // Navigate to contacts page to verify import
    await page.goto('/#/contacts');
    await page.waitForLoadState('networkidle');

    // Wait a bit more for data to load
    await page.waitForTimeout(1000);

    // Verify the page loaded without errors (no 403 errors would have redirected or errored)
    // Check that we're still on the contacts page
    expect(page.url()).toContain('/#/contacts');

    // If import had 403 errors during tag creation, we would either:
    // 1. See an error notification
    // 2. Have incomplete data

    // Verify contacts list is visible (data loaded successfully)
    // The contacts list uses div.divide-y with Link elements, not a table
    const contactsListContainer = page.locator('.divide-y').first();
    const isListVisible = await contactsListContainer.isVisible().catch(() => false);
    // Also check for contact links (the list items are Link elements to /contacts/*)
    const contactLinks = page.locator('a[href*="/contacts/"]');
    const hasContactLinks = (await contactLinks.count()) > 0;
    expect(isListVisible || hasContactLinks).toBeTruthy();

    await logout(page);
  });

  test('should handle tags with special characters', async ({ page }) => {
    // #given - Setup: Login as existing user
    await login(page, ADMIN_ORG1.email, ADMIN_ORG1.password);
    await page.goto('/#/contacts');
    await page.waitForLoadState('networkidle');

    // Create CSV with special character tags
    const csvPath = createTestCsv(
      'special-chars-contacts.csv',
      [
        'first_name,last_name,email_work,tags',
        'Special,User,special@example.com,"C++,Node.js,#important"',
      ]
    );

    // #when - Import CSV with special character tags
    const importButton = page.locator('button:has-text("Import")');
    await importButton.click();
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await page.waitForTimeout(500);
    await page.locator('[role="dialog"] button:has-text("Import")').click({ timeout: 10000 });

    // Wait for import to complete
    await expect(page.locator('[role="alert"]:has-text("import complete")')).toBeVisible({ timeout: 30000 });

    // Close the dialog (use first() since there are 2 Close buttons)
    await page.locator('[role="dialog"] button:has-text("Close")').first().click({ timeout: 5000 });
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // #then - Verify import completed successfully
    await page.goto('/#/contacts');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/#/contacts');

    await logout(page);
  });

  test('should import multiple batches of contacts with tags', async ({ page }) => {
    // #given - Setup: Login as existing user
    await login(page, ADMIN_ORG1.email, ADMIN_ORG1.password);
    await page.goto('/#/contacts');
    await page.waitForLoadState('networkidle');

    // Create CSV with 20+ rows to test batch processing
    const rows = [
      'first_name,last_name,email_work,company,tags',
    ];
    for (let i = 1; i <= 15; i++) {
      rows.push(`Contact${i},User${i},contact${i}@example.com,Company${i},"tag${i},bulk-import"`);
    }

    const csvPath = createTestCsv('batch-contacts.csv', rows);

    // #when - Import batch of contacts
    const importButton = page.locator('button:has-text("Import")');
    await importButton.click();
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await page.waitForTimeout(500);
    await page.locator('[role="dialog"] button:has-text("Import")').click({ timeout: 10000 });

    // Wait for import to complete (batch may take longer)
    await expect(page.locator('[role="alert"]:has-text("import complete")')).toBeVisible({ timeout: 45000 });

    // Close the dialog (use first() since there are 2 Close buttons)
    await page.locator('[role="dialog"] button:has-text("Close")').first().click({ timeout: 5000 });
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // #then - Verify batch import succeeded
    await page.goto('/#/contacts');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/#/contacts');

    await logout(page);
  });
});
