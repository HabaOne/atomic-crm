import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'child_process';

/**
 * API Key Authentication E2E Test Suite
 *
 * Tests the complete API key implementation including:
 * - Creating API keys via UI
 * - Using API keys for CRUD operations
 * - Tenant isolation enforcement
 * - Key revocation
 * - Error handling
 */

// Test configuration
const BASE_API_URL = 'http://127.0.0.1:54321/functions/v1';

// Test users
const ADMIN_ORG1 = {
  email: 'apikey-admin1@test.com',
  password: 'test-password-123',
  firstName: 'AdminOne',
  lastName: 'ApiTest',
  organizationName: 'API Test Org 1',
};

const ADMIN_ORG2 = {
  email: 'apikey-admin2@test.com',
  password: 'test-password-456',
  firstName: 'AdminTwo',
  lastName: 'ApiTest',
  organizationName: 'API Test Org 2',
};

// Helper functions
async function resetDatabase() {
  try {
    console.log('Resetting database...');
    execSync('npx supabase db reset --no-seed', {
      stdio: 'inherit',
      cwd: process.cwd(),
      timeout: 120000, // 2 minute timeout
    });
    // Run seed separately for better error handling
    execSync('npx supabase db seed', {
      stdio: 'inherit',
      cwd: process.cwd(),
      timeout: 30000,
    });
    console.log('Database reset complete');
  } catch (error) {
    console.error('Failed to reset database:', error);
    // Don't throw - allow tests to continue with existing data
    console.log('Continuing with existing database state...');
  }
}

async function signup(page: Page, user: typeof ADMIN_ORG1, newOrg: boolean = false) {
  // Always use ?new_org=true to ensure signup form renders (bypasses isInitialized redirect)
  await page.goto('/#/sign-up?new_org=true');
  await page.waitForLoadState('networkidle');

  // Wait for signup page component to be visible (not login redirect)
  await expect(page.locator('[data-testid="signup-page"]')).toBeVisible({ timeout: 10000 });

  // Wait for form to be visible
  await page.waitForSelector('input#organization_name', { timeout: 10000 });

  await page.fill('input#organization_name', user.organizationName);
  await page.fill('input#first_name', user.firstName);
  await page.fill('input#last_name', user.lastName);
  await page.fill('input#email', user.email);
  await page.fill('input#password', user.password);

  // Listen for console errors before clicking
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });

  await page.click('button[type="submit"]');

  // Wait for either success redirect OR error notification
  try {
    await page.waitForURL((url) => !url.hash.includes('/sign-up'), { timeout: 15000 });
  } catch (e) {
    // Check for error message on page
    const errorText = await page.locator('.text-destructive, [role="alert"], .error').textContent().catch(() => 'No error found');
    console.log('Signup may have failed. Error on page:', errorText);
    throw e;
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Wait for auth state to fully initialize
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/#/login');
  await page.waitForLoadState('networkidle');

  // Check if already logged in (redirected to dashboard)
  if (page.url().includes('#/') && !page.url().includes('#/login') && !page.url().includes('#/sign-up')) {
    // Already logged in, log out first
    await logout(page);
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
  }

  // Check if we're on signup page (app not initialized)
  if (page.url().includes('#/sign-up')) {
    // App thinks it's not initialized, skip to login
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
  }

  // Wait for login form to appear
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.locator('button[type="submit"]').filter({ hasText: 'Sign in' }).click();

  await page.waitForURL((url) => url.hash === '#/' || url.hash === '', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function logout(page: Page) {
  try {
    // Click user menu
    await page.locator('[data-testid="user-menu"]').click({ timeout: 3000 });

    // Wait for dropdown and click logout
    await page.waitForTimeout(500);
    const logoutLink = page.locator('text="Log out"').first();
    if (await logoutLink.isVisible({ timeout: 2000 })) {
      await logoutLink.click();
      await page.waitForURL('/#/login', { timeout: 5000 });
    }
  } catch (e) {
    // If logout fails, just navigate to login
    await page.goto('/#/login');
  }
}

async function createApiKey(page: Page, keyName: string): Promise<string> {
  // Navigate to API keys page
  await page.goto('/#/settings/api-keys');
  await page.waitForLoadState('networkidle');

  // Wait for any existing dialogs to close
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

  // Click create button
  await page.click('[data-testid="create-api-key-button"]');

  // Wait for dialog to open
  await page.waitForSelector('input#keyName', { timeout: 5000 });

  // Fill key name
  await page.fill('input#keyName', keyName);

  // Click create button in dialog
  await page.locator('[role="dialog"] button:has-text("Create")').click();

  // Wait for success dialog with the key
  await page.waitForSelector('input[readonly][class*="font-mono"]', { timeout: 10000 });

  // Extract the API key from the readonly input
  const apiKey = await page.inputValue('input[readonly][class*="font-mono"]');

  // Close the dialog by clicking outside or pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  return apiKey;
}

async function createContact(page: Page, contactData: { firstName: string; lastName: string; email?: string }) {
  await page.goto('/#/contacts');
  await page.waitForLoadState('networkidle');

  // Hash router uses #/contacts/create
  // Use first() since there may be multiple create buttons (header + empty state)
  const createButton = page.locator('a[href="#/contacts/create"]').first();
  await createButton.click({ timeout: 10000 });

  await page.waitForSelector('input[name="first_name"]', { timeout: 10000 });

  await page.fill('input[name="first_name"]', contactData.firstName);
  await page.fill('input[name="last_name"]', contactData.lastName);

  // Email is optional - the contact form uses a complex email list component
  // For testing purposes, we just fill first/last name which are required

  await page.click('button[type="submit"]');

  // After creation, app redirects to contact show page (redirect="show")
  await page.waitForURL((url) => url.hash.match(/#\/contacts\/\d+(\/show)?/) !== null, { timeout: 10000 });
}

// Tests
test.describe('API Key Authentication E2E Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let org1ApiKey: string;
  let org2ApiKey: string;
  let org1ContactId: number;

  test.beforeAll(async () => {
    // Skip database reset - it's unstable in CI and causes issues
    // Tests should run against a fresh database from the full test suite
    console.log('Skipping database reset - ensure database is clean before running tests');
  });

  test.describe('API Key Creation via UI', () => {
    test('admin can access API keys page', async ({ page }) => {
      // #given: First organization exists
      await signup(page, ADMIN_ORG1);

      // Verify user is on dashboard/contacts page
      await expect(page).toHaveURL(/\/#\/(|contacts)/);

      // Verify navigation is visible (user is logged in)
      await expect(page.locator('text=Dashboard')).toBeVisible();

      // Wait a bit more for auth state to settle
      await page.waitForTimeout(3000);

      // #when: Admin navigates to API keys page
      // Navigate using window.location to ensure hash router picks it up
      await page.evaluate(() => {
        window.location.hash = '#/settings/api-keys';
      });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Debug output
      const bodyText = await page.locator('body').textContent();
      console.log('Current URL:', page.url());
      console.log('Body content (first 500):', bodyText?.substring(0, 500));

      // Wait for loading states to disappear
      await page.locator('text=Loading permissions').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await page.locator('text=Loading API keys').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});

      // #then: Should see API keys page
      await expect(page.locator('[data-testid="api-keys-page"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('h1').filter({ hasText: 'API Keys' })).toBeVisible();
      await expect(page.locator('[data-testid="create-api-key-button"]')).toBeVisible();
    });

    test('can create API key with name', async ({ page }) => {
      // #given: Admin is logged in
      await login(page, ADMIN_ORG1.email, ADMIN_ORG1.password);

      // #when: Admin creates API key
      org1ApiKey = await createApiKey(page, 'Test Integration');

      // #then: Key should be valid format
      expect(org1ApiKey).toMatch(/^ak_org_[a-f0-9]{32}$/);

      // #then: Key should appear in list
      await expect(page.locator('text=Test Integration')).toBeVisible();
      await expect(page.locator('text=ak_org_')).toBeVisible();
    });

    test('key is shown only once with warning', async ({ page }) => {
      // #given: Admin is logged in
      await login(page, ADMIN_ORG1.email, ADMIN_ORG1.password);
      await page.goto('/#/settings/api-keys');
      await page.waitForLoadState('networkidle');

      // Wait for any existing dialogs to close
      await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

      // #when: Admin creates a new key
      await page.click('[data-testid="create-api-key-button"]');
      await page.waitForSelector('input#keyName', { timeout: 5000 });
      await page.fill('input#keyName', 'One-time Key');
      await page.locator('[role="dialog"] button:has-text("Create")').click();

      // #then: Should see warning about one-time display
      await expect(page.locator('text=/won\'t be able to see it again/i')).toBeVisible();
      await expect(page.locator('text=/Copy this key now/i')).toBeVisible();

      // Close dialog
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // #then: Full key should not be visible in list (only prefix)
      await expect(page.locator('input[readonly][class*="font-mono"]')).not.toBeVisible();
      await expect(page.locator('text=ak_org_').first()).toBeVisible(); // prefix only
    });
  });

  test.describe('API Key CRUD Operations', () => {
    test('can list contacts with API key', async ({ request }) => {
      // #given: Org 1 has an API key and some contacts
      const response = await request.get(`${BASE_API_URL}/api-gateway?resource=contacts`, {
        headers: {
          'Authorization': `Bearer ${org1ApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // #then: Should return successful response
      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBeTruthy();
    });

    test('can create contact with API key', async ({ request }) => {
      // #given: Org 1 API key
      const newContact = {
        first_name: 'API',
        last_name: 'Created',
        email_jsonb: [{ email: 'api.created@test.com' }],
      };

      // #when: Creating contact via API
      const response = await request.post(`${BASE_API_URL}/api-gateway?resource=contacts`, {
        headers: {
          'Authorization': `Bearer ${org1ApiKey}`,
          'Content-Type': 'application/json',
        },
        data: newContact,
      });

      // #then: Should create successfully
      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const result = await response.json();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBeTruthy();
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0].first_name).toBe('API');
      expect(result.data[0].last_name).toBe('Created');

      // Save contact ID for later tests
      org1ContactId = result.data[0].id;
    });

    test('can update contact with API key', async ({ request }) => {
      // #given: Contact created in previous test
      const updates = {
        first_name: 'Updated',
      };

      // #when: Updating contact via API
      const response = await request.patch(
        `${BASE_API_URL}/api-gateway?resource=contacts&id=${org1ContactId}`,
        {
          headers: {
            'Authorization': `Bearer ${org1ApiKey}`,
            'Content-Type': 'application/json',
          },
          data: updates,
        }
      );

      // #then: Should update successfully
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.data[0].first_name).toBe('Updated');
    });

    test('can delete contact with API key', async ({ request }) => {
      // #given: Contact to delete
      // #when: Deleting contact via API
      const response = await request.delete(
        `${BASE_API_URL}/api-gateway?resource=contacts&id=${org1ContactId}`,
        {
          headers: {
            'Authorization': `Bearer ${org1ApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // #then: Should delete successfully
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Tenant Isolation', () => {
    test('setup second organization', async ({ page }) => {
      // #given: First org exists
      // #when: Creating second organization
      await logout(page);
      await signup(page, ADMIN_ORG2, true);

      // #then: Should be logged in to second org
      await expect(page).toHaveURL('/#/');
    });

    test('create data in second organization', async ({ page }) => {
      // #given: Logged in as org 2 admin
      await login(page, ADMIN_ORG2.email, ADMIN_ORG2.password);

      // #when: Creating contact in org 2
      await createContact(page, {
        firstName: 'Org2',
        lastName: 'Contact',
        email: 'org2@test.com',
      });

      // #then: Contact should be created
      await page.goto('/#/contacts');
      await expect(page.locator('text=Org2 Contact')).toBeVisible();
    });

    test('create API key for second organization', async ({ page }) => {
      // #given: Logged in as org 2 admin
      await login(page, ADMIN_ORG2.email, ADMIN_ORG2.password);

      // #when: Creating API key for org 2
      org2ApiKey = await createApiKey(page, 'Org 2 Key');

      // #then: Key should be created
      expect(org2ApiKey).toMatch(/^ak_org_[a-f0-9]{32}$/);
    });

    test('org 1 key cannot access org 2 data', async ({ request }) => {
      // #given: Org 1 API key
      // #when: Trying to list contacts with org 1 key
      const response = await request.get(`${BASE_API_URL}/api-gateway?resource=contacts`, {
        headers: {
          'Authorization': `Bearer ${org1ApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // #then: Should only see org 1 contacts
      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Should not contain org 2 contact
      const hasOrg2Contact = data.data.some((contact: any) =>
        contact.first_name === 'Org2' && contact.last_name === 'Contact'
      );
      expect(hasOrg2Contact).toBeFalsy();
    });

    test('org 2 key cannot access org 1 data', async ({ request }) => {
      // #given: Org 2 API key
      // #when: Trying to list contacts with org 2 key
      const response = await request.get(`${BASE_API_URL}/api-gateway?resource=contacts`, {
        headers: {
          'Authorization': `Bearer ${org2ApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // #then: Should only see org 2 contacts
      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Should contain org 2 contact
      const hasOrg2Contact = data.data.some((contact: any) =>
        contact.first_name === 'Org2' && contact.last_name === 'Contact'
      );
      expect(hasOrg2Contact).toBeTruthy();

      // Should not contain any org 1 specific contacts
      const hasUpdatedContact = data.data.some((contact: any) =>
        contact.first_name === 'Updated'
      );
      expect(hasUpdatedContact).toBeFalsy();
    });
  });

  test.describe('Key Revocation', () => {
    test('can revoke API key via UI', async ({ page }) => {
      // #given: Logged in as org 1 admin with API key
      await login(page, ADMIN_ORG1.email, ADMIN_ORG1.password);
      await page.goto('/#/settings/api-keys');
      await page.waitForLoadState('networkidle');

      // Verify Test Integration key exists
      await expect(page.locator('text=Test Integration')).toBeVisible();

      // #when: Revoking the key
      // Find the row containing "Test Integration" and click its revoke button
      // The revoke button is the only button (with destructive variant) in the key row
      const keyRow = page.locator('div').filter({ hasText: /^.*Test Integration.*ak_org_/ }).first();
      const revokeButton = keyRow.locator('button').last();

      // Set up dialog confirmation
      page.on('dialog', dialog => dialog.accept());

      await revokeButton.click();
      await page.waitForTimeout(2000);

      // #then: Key should be removed from active list
      await expect(page.locator('text=Test Integration')).not.toBeVisible({ timeout: 5000 });
    });

    test('revoked key returns 401', async ({ request }) => {
      // #given: Revoked org 1 API key
      // #when: Trying to use revoked key
      const response = await request.get(`${BASE_API_URL}/api-gateway?resource=contacts`, {
        headers: {
          'Authorization': `Bearer ${org1ApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // #then: Should return 401 Unauthorized
      expect(response.status()).toBe(401);
      const error = await response.json();
      expect(error.message).toMatch(/invalid|expired/i);
    });
  });

  test.describe('Error Handling', () => {
    test('invalid API key returns 401', async ({ request }) => {
      // #given: Invalid API key
      const invalidKey = 'ak_org_invalid_key_12345678901234567890';

      // #when: Using invalid key
      const response = await request.get(`${BASE_API_URL}/api-gateway?resource=contacts`, {
        headers: {
          'Authorization': `Bearer ${invalidKey}`,
          'Content-Type': 'application/json',
        },
      });

      // #then: Should return 401
      expect(response.status()).toBe(401);
      const error = await response.json();
      expect(error.message).toMatch(/invalid|expired/i);
    });

    test('missing authorization header returns 401', async ({ request }) => {
      // #given: No authorization header
      // #when: Making request without auth
      const response = await request.get(`${BASE_API_URL}/api-gateway?resource=contacts`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // #then: Should return 401
      expect(response.status()).toBe(401);
      const error = await response.json();
      expect(error.message).toMatch(/missing.*authorization/i);
    });

    test('missing resource parameter returns 400', async ({ request }) => {
      // #given: Valid API key but missing resource
      // #when: Making request without resource parameter
      const response = await request.get(`${BASE_API_URL}/api-gateway`, {
        headers: {
          'Authorization': `Bearer ${org2ApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // #then: Should return 400
      expect(response.status()).toBe(400);
      const error = await response.json();
      expect(error.message).toMatch(/missing.*resource/i);
    });

    test('invalid field type returns error', async ({ request }) => {
      // #given: Valid API key but invalid field type
      // #when: Sending a non-integer for a bigint field
      const response = await request.post(`${BASE_API_URL}/api-gateway?resource=contacts`, {
        headers: {
          'Authorization': `Bearer ${org2ApiKey}`,
          'Content-Type': 'application/json',
        },
        data: { company_id: 'not-a-number' }, // Invalid type for bigint field
      });

      // #then: Should return 400 (invalid input syntax)
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Email/Password Auth Still Works', () => {
    test('can still login with email and password', async ({ page }) => {
      // #given: API keys implemented
      // #when: Logging in with email/password
      await login(page, ADMIN_ORG1.email, ADMIN_ORG1.password);

      // #then: Should successfully login
      await expect(page).toHaveURL('/#/');
      await expect(page.locator('body')).toContainText(/(Dashboard|Contacts|Companies|Deals)/i);
    });

    test('can still access data via UI', async ({ page }) => {
      // #given: Logged in with email/password
      await login(page, ADMIN_ORG2.email, ADMIN_ORG2.password);

      // #when: Navigating to contacts
      await page.goto('/#/contacts');
      await page.waitForLoadState('networkidle');

      // #then: Should see contacts
      await expect(page.locator('text=Org2 Contact')).toBeVisible();
    });
  });

  test.describe('Key Management UI', () => {
    test('non-admin cannot access API keys page', async ({ page }) => {
      // Note: This test assumes you have a non-admin user
      // For now, we'll skip this test since we only have admins
      test.skip();
    });

    test('displays key metadata correctly', async ({ page }) => {
      // #given: Admin with API keys
      await login(page, ADMIN_ORG2.email, ADMIN_ORG2.password);
      await page.goto('/#/settings/api-keys');
      await page.waitForLoadState('networkidle');

      // #then: Should show key prefix, name, and created date
      await expect(page.locator('text=Org 2 Key')).toBeVisible();
      await expect(page.locator('text=/ak_org_.+\\.\\.\\./')).toBeVisible();
      await expect(page.locator('text=/Created.*202[0-9]/')).toBeVisible();
    });

    test('shows usage examples in success dialog after key creation', async ({ page }) => {
      // #given: Admin on API keys page
      await login(page, ADMIN_ORG2.email, ADMIN_ORG2.password);
      await page.goto('/#/settings/api-keys');
      await page.waitForLoadState('networkidle');

      // Wait for any existing dialogs to close
      await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

      // #when: Creating a new API key
      await page.click('[data-testid="create-api-key-button"]');
      await page.waitForSelector('input#keyName', { timeout: 5000 });
      await page.fill('input#keyName', 'Test Usage Example Key');
      await page.locator('[role="dialog"] button:has-text("Create")').click();

      // Wait for success dialog with the key
      await page.waitForSelector('input[readonly][class*="font-mono"]', { timeout: 10000 });

      // #then: Should see usage example in success dialog
      await expect(page.locator('text=/Usage Example/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/curl/i')).toBeVisible({ timeout: 5000 });

      // Close dialog
      await page.keyboard.press('Escape');
    });
  });
});
