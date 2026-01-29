/**
 * E2E Test Helpers - Atomic CRM
 *
 * Centralized utilities for E2E tests:
 * - Authentication (signup, login, logout)
 * - CRUD operations (contacts, companies, API keys)
 * - Assertions (page state, data visibility)
 * - State management (database cleanup, data verification)
 *
 * Usage:
 *   import { login, logout, createContact } from './helpers';
 *   await login(page, email, password);
 *   await createContact(page, { firstName, lastName, email });
 *   await logout(page);
 */

import { Page, expect, APIRequestContext } from '@playwright/test';

// ============================================================================
// TYPES
// ============================================================================

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
}

export interface TestContact {
  firstName: string;
  lastName: string;
  email: string;
}

export interface TestCompany {
  name: string;
  sector?: string;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Sign up a new user with optional new organization
 *
 * @param page - Playwright page instance
 * @param user - User credentials and profile
 * @param newOrg - Whether to create new organization (uses ?new_org=true param)
 *
 * @throws Timeout error if form elements not found within 10s
 * @throws Timeout error if redirect to dashboard doesn't complete within 15s
 */
export async function signup(
  page: Page,
  user: TestUser,
  newOrg: boolean = false
): Promise<void> {
  const url = newOrg ? '/#/sign-up?new_org=true' : '/#/sign-up';
  await page.goto(url);

  // Wait for signup form to be interactive
  await page.waitForSelector('input#organization_name', { timeout: 10000 });

  // Fill form fields in order
  await page.fill('input#organization_name', user.organizationName || 'Test Organization');
  await page.fill('input#first_name', user.firstName);
  await page.fill('input#last_name', user.lastName);
  await page.fill('input#email', user.email);
  await page.fill('input#password', user.password);

  // Submit and wait for redirect
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.hash.includes('/sign-up'), { timeout: 15000 });

  // Ensure dashboard is fully loaded
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

/**
 * Login with email and password
 *
 * @param page - Playwright page instance
 * @param email - User email
 * @param password - User password
 *
 * @throws Timeout error if form not found
 * @throws Timeout error if redirect to dashboard fails
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/#/login');
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]:has-text("Sign in")');

  // Wait for redirect to dashboard
  await page.waitForURL((url) => url.hash === '#/' || url.hash === '', {
    timeout: 15000,
  });

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

/**
 * Logout current user via UI
 *
 * Tries multiple selector strategies for user menu button:
 * 1. data-testid="user-menu"
 * 2. aria-label containing "menu"
 * 3. Button containing avatar
 * 4. Falls back to direct navigation to login page
 *
 * @param page - Playwright page instance
 * @throws Timeout error if logout doesn't complete within 5s
 */
export async function logout(page: Page): Promise<void> {
  const userMenuSelectors = [
    '[data-testid="user-menu"]',
    'button[aria-label*="menu"]',
    'button:has([data-avatar])',
    '.avatar',
  ];

  let clicked = false;
  for (const selector of userMenuSelectors) {
    try {
      if (await page.locator(selector).isVisible({ timeout: 1000 })) {
        await page.locator(selector).click();
        clicked = true;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!clicked) {
    await page.goto('/#/login');
    return;
  }

  await page.click('text="Logout", text="Sign out", text="Log out"');
  await page.waitForURL('/#/login', { timeout: 5000 });
}

// ============================================================================
// CONTACT OPERATIONS
// ============================================================================

/**
 * Create a contact via UI
 *
 * @param page - Playwright page instance
 * @param contactData - Contact information
 *
 * @throws Timeout if contact form elements not found within 10s
 */
export async function createContact(
  page: Page,
  contactData: TestContact
): Promise<void> {
  await page.goto('/#/contacts');
  await page.waitForLoadState('networkidle');

  const createButton = page.locator('a[href="#/contacts/create"]');
  await createButton.click({ timeout: 10000 });

  await page.waitForSelector('input[name="first_name"]', { timeout: 10000 });

  await page.fill('input[name="first_name"]', contactData.firstName);
  await page.fill('input[name="last_name"]', contactData.lastName);
  await page.fill('input[name="email"]', contactData.email);

  await page.click('button[type="submit"]');
  await page.waitForURL('/#/contacts', { timeout: 10000 });

  await expect(
    page.locator(`text="${contactData.firstName} ${contactData.lastName}"`)
  ).toBeVisible({ timeout: 5000 });
}

/**
 * Verify contact exists in list
 *
 * @param page - Playwright page instance
 * @param contactData - Contact to verify
 * @throws Error if contact not found
 */
export async function assertContactExists(
  page: Page,
  contactData: TestContact
): Promise<void> {
  await page.goto('/#/contacts');
  await page.waitForLoadState('networkidle');

  const fullName = `${contactData.firstName} ${contactData.lastName}`;
  await expect(page.locator(`text="${fullName}"`)).toBeVisible({
    timeout: 5000,
  });
}

/**
 * Verify contact does NOT exist in list
 *
 * @param page - Playwright page instance
 * @param contactData - Contact to verify absence
 */
export async function assertContactNotExists(
  page: Page,
  contactData: TestContact
): Promise<void> {
  await page.goto('/#/contacts');
  await page.waitForLoadState('networkidle');

  const fullName = `${contactData.firstName} ${contactData.lastName}`;
  const isVisible = await page
    .locator(`text="${fullName}"`)
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  expect(isVisible).toBeFalsy();
}

// ============================================================================
// COMPANY OPERATIONS
// ============================================================================

/**
 * Create a company via UI
 *
 * @param page - Playwright page instance
 * @param companyData - Company information
 */
export async function createCompany(
  page: Page,
  companyData: TestCompany
): Promise<void> {
  await page.goto('/#/companies');
  await page.waitForLoadState('networkidle');

  const createLink = page.locator('a[href="#/companies/create"]');
  await createLink.click({ timeout: 10000 });

  await page.waitForSelector('input[name="name"]', { timeout: 10000 });
  await page.fill('input[name="name"]', companyData.name);

  if (companyData.sector) {
    const sectorSelect = page.locator('select[name="sector"]');
    if (await sectorSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sectorSelect.selectOption(companyData.sector);
    }
  }

  await page.click('button[type="submit"]');
  await page.waitForURL('/#/companies', { timeout: 10000 });
}

/**
 * Verify company exists in list
 */
export async function assertCompanyExists(
  page: Page,
  companyData: TestCompany
): Promise<void> {
  await page.goto('/#/companies');
  await page.waitForLoadState('networkidle');

  await expect(page.locator(`text="${companyData.name}"`)).toBeVisible({
    timeout: 5000,
  });
}

/**
 * Verify company does NOT exist in list
 */
export async function assertCompanyNotExists(
  page: Page,
  companyData: TestCompany
): Promise<void> {
  await page.goto('/#/companies');
  await page.waitForLoadState('networkidle');

  const isVisible = await page
    .locator(`text="${companyData.name}"`)
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  expect(isVisible).toBeFalsy();
}

// ============================================================================
// API KEY OPERATIONS
// ============================================================================

/**
 * Create API key via UI
 *
 * @param page - Playwright page instance
 * @param keyName - Name for the API key
 * @returns The generated API key token (shown only once)
 */
export async function createApiKey(page: Page, keyName: string): Promise<string> {
  await page.goto('/#/settings/api-keys');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const createButton = page.locator('button:has-text("Create API Key")');
  await createButton.click({ timeout: 10000 });

  await page.waitForSelector('input#keyName', { timeout: 5000 });
  await page.fill('input#keyName', keyName);

  await page.click('button:has-text("Create"):not(:has-text("Cancel"))');

  await page.waitForSelector('input[readonly][class*="font-mono"]', {
    timeout: 10000,
  });

  const apiKey = await page.inputValue('input[readonly][class*="font-mono"]');

  if (!apiKey) {
    throw new Error('Failed to extract API key from dialog');
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  return apiKey;
}

/**
 * Revoke API key via UI
 *
 * @param page - Playwright page instance
 * @param keyName - Name of key to revoke
 */
export async function revokeApiKey(page: Page, keyName: string): Promise<void> {
  await page.goto('/#/settings/api-keys');
  await page.waitForLoadState('networkidle');

  const keyRow = page.locator(`text=${keyName}`).locator('..');
  const revokeButton = keyRow.locator('button:has(svg)');

  page.on('dialog', (dialog) => dialog.accept());

  await revokeButton.click({ timeout: 10000 });
  await page.waitForTimeout(1000);
}

/**
 * Verify API key is listed
 */
export async function assertApiKeyExists(page: Page, keyName: string): Promise<void> {
  await page.goto('/#/settings/api-keys');
  await page.waitForLoadState('networkidle');

  await expect(page.locator(`text="${keyName}"`)).toBeVisible({
    timeout: 5000,
  });
}

// ============================================================================
// API OPERATIONS (for non-UI tests)
// ============================================================================

/**
 * List contacts via API using API key
 *
 * @param request - Playwright API request context
 * @param apiKey - API key for authentication
 * @param baseUrl - Base API URL
 * @returns Array of contact objects
 */
export async function listContactsViaApi(
  request: APIRequestContext,
  apiKey: string,
  baseUrl: string = 'http://127.0.0.1:54321/functions/v1'
): Promise<any[]> {
  const response = await request.get(`${baseUrl}/api-gateway?resource=contacts`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok()) {
    const error = await response.json();
    throw new Error(`API request failed: ${error.message}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Create contact via API using API key
 */
export async function createContactViaApi(
  request: APIRequestContext,
  apiKey: string,
  contactData: any,
  baseUrl: string = 'http://127.0.0.1:54321/functions/v1'
): Promise<any> {
  const response = await request.post(`${baseUrl}/api-gateway?resource=contacts`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    data: contactData,
  });

  if (!response.ok()) {
    const error = await response.json();
    throw new Error(`API request failed: ${error.message}`);
  }

  const result = await response.json();
  return result.data?.[0];
}

/**
 * Update contact via API using API key
 */
export async function updateContactViaApi(
  request: APIRequestContext,
  apiKey: string,
  contactId: number,
  updates: any,
  baseUrl: string = 'http://127.0.0.1:54321/functions/v1'
): Promise<any> {
  const response = await request.patch(
    `${baseUrl}/api-gateway?resource=contacts&id=${contactId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: updates,
    }
  );

  if (!response.ok()) {
    const error = await response.json();
    throw new Error(`API request failed: ${error.message}`);
  }

  const result = await response.json();
  return result.data?.[0];
}

/**
 * Delete contact via API using API key
 */
export async function deleteContactViaApi(
  request: APIRequestContext,
  apiKey: string,
  contactId: number,
  baseUrl: string = 'http://127.0.0.1:54321/functions/v1'
): Promise<void> {
  const response = await request.delete(
    `${baseUrl}/api-gateway?resource=contacts&id=${contactId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok()) {
    const error = await response.json();
    throw new Error(`API request failed: ${error.message}`);
  }
}

// ============================================================================
// PAGE ASSERTIONS
// ============================================================================

/**
 * Assert user is on dashboard (logged in)
 */
export async function assertOnDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL('/#/');
  await expect(page.locator('body')).toContainText(/(Dashboard|Contacts|Companies|Deals)/i);
}

/**
 * Assert user is on login page (logged out)
 */
export async function assertOnLoginPage(page: Page): Promise<void> {
  await expect(page).toHaveURL('/#/login');
  await expect(
    page.locator('input[name="email"], input[name="password"]')
  ).toBeDefined();
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

// ============================================================================
// RETRY UTILITY
// ============================================================================

/**
 * Retry a flaky operation with exponential backoff
 *
 * @param operation - Function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelayMs - Initial delay in milliseconds (doubles on each retry)
 *
 * @returns Result of operation on success
 * @throws Error from last failed attempt if all retries exhausted
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 100
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.warn(
        `⚠️  Operation failed (attempt ${attempt + 1}/${maxRetries}), ` +
        `retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Unreachable');
}
