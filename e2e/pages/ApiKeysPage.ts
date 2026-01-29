/**
 * API Keys Page Object - Atomic CRM
 *
 * Encapsulates all API key management interactions.
 *
 * Usage:
 *   const apiKeysPage = new ApiKeysPage(page);
 *   await apiKeysPage.navigate();
 *   const key = await apiKeysPage.createKey('My Key');
 *   await apiKeysPage.assertKeyExists('My Key');
 *   await apiKeysPage.revokeKey('My Key');
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ApiKeysPage extends BasePage {
  // Selectors
  private readonly createButton = 'button:has-text("Create API Key")';
  private readonly keyNameInput = 'input#keyName';
  private readonly createDialogButton = 'button:has-text("Create"):not(:has-text("Cancel"))';
  private readonly keyDisplayInput = 'input[readonly][class*="font-mono"]';
  private readonly heading = 'h1:text-is("API Keys")';

  /**
   * Navigate to API keys settings page
   */
  async navigate(): Promise<void> {
    await this.goto('/#/settings/api-keys');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000); // Settings rendering
  }

  /**
   * Assert API keys page is loaded with expected elements
   */
  async assertPageLoaded(): Promise<void> {
    await this.assertVisible(this.heading, 'API Keys heading');
    await this.assertVisible(this.createButton, 'Create API Key button');
  }

  /**
   * Create new API key and return the token
   *
   * The key is displayed only once in a success dialog.
   * This function captures and returns it.
   *
   * @param keyName - Name for the new API key
   * @returns The generated API key token (e.g., 'ak_org_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
   * @throws Error if key creation or extraction fails
   */
  async createKey(keyName: string): Promise<string> {
    await this.navigate();
    await this.click(this.createButton);

    // Fill key name in dialog
    await this.waitForElement(this.keyNameInput, 5000, 'Key name input');
    await this.fill(this.keyNameInput, keyName, 'Key name');

    // Submit dialog
    await this.click(this.createDialogButton);

    // Wait for success dialog with key display
    const keyInput = await this.waitForElement(
      this.keyDisplayInput,
      10000,
      'Key display input'
    );

    const apiKey = await keyInput.inputValue();

    if (!apiKey) {
      throw new Error('Failed to extract API key from dialog');
    }

    // Close dialog
    await this.pressKey('Escape');
    await this.page.waitForTimeout(500);

    return apiKey;
  }

  /**
   * Assert API key is listed on the page
   *
   * @param keyName - Name of the API key to verify
   * @throws Error if key not found
   */
  async assertKeyExists(keyName: string): Promise<void> {
    await this.navigate();
    await this.assertVisible(`text="${keyName}"`, `API key: ${keyName}`);
  }

  /**
   * Assert API key is NOT listed on the page
   *
   * Useful after revoking a key
   *
   * @param keyName - Name of the API key to verify absence
   */
  async assertKeyNotExists(keyName: string): Promise<void> {
    await this.navigate();
    await this.assertHidden(`text="${keyName}"`, `API key should not exist: ${keyName}`);
  }

  /**
   * Revoke (delete) an API key by name
   *
   * Finds the key by name in the list, clicks the revoke button, and confirms.
   *
   * @param keyName - Name of the key to revoke
   * @throws Error if key not found or revocation fails
   */
  async revokeKey(keyName: string): Promise<void> {
    await this.navigate();

    // Find key row and revoke button
    const keyRow = this.page.locator(`text=${keyName}`).locator('..');
    const revokeButton = keyRow.locator('button:has(svg)'); // Trash icon

    // Handle confirmation dialog
    this.setupDialogHandler('accept');

    await revokeButton.click({ timeout: 10000 });
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get all visible API key names
   *
   * Useful for verification and debugging
   *
   * @returns Array of key names currently visible
   */
  async getVisibleKeyNames(): Promise<string[]> {
    await this.navigate();

    const keyNames: string[] = [];
    const keyRows = await this.page.locator('table tbody tr');
    const count = await keyRows.count();

    for (let i = 0; i < count; i++) {
      const row = keyRows.nth(i);
      // First cell typically contains the key name
      const text = await row.locator('td').first().textContent();
      if (text) {
        keyNames.push(text.trim());
      }
    }

    return keyNames;
  }

  /**
   * Get API key count
   *
   * @returns Number of API keys currently shown
   */
  async getKeyCount(): Promise<number> {
    await this.navigate();
    const rows = await this.page.locator('table tbody tr').count();
    return rows;
  }

  /**
   * Verify key has correct format
   *
   * API keys should match: ak_org_[a-f0-9]{32}
   *
   * @param key - API key to verify
   * @throws Error if key format is invalid
   */
  assertKeyFormat(key: string): void {
    const keyRegex = /^ak_org_[a-f0-9]{32}$/;
    if (!keyRegex.test(key)) {
      throw new Error(
        `Invalid API key format. Expected 'ak_org_[32 hex chars]', got: ${key}`
      );
    }
  }

  /**
   * Verify key is only shown as prefix in list
   *
   * Full key is only shown once in create dialog. In the list, only prefix should be visible.
   *
   * @param keyName - Name of the key
   * @throws Error if full key is visible
   */
  async assertKeyShownAsPrefix(keyName: string): Promise<void> {
    await this.navigate();

    // Full key should not be visible in list (starts with ak_org_)
    const fullKeyVisible = await this.page
      .locator('text=/^ak_org_[a-f0-9]{32}$/')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (fullKeyVisible) {
      throw new Error(
        'Full API key is visible in list (security issue). Should only show prefix.'
      );
    }

    // Prefix should be visible
    await this.assertVisible('text=/ak_org_/', `API key prefix for: ${keyName}`);
  }

  /**
   * Get creation date of a key
   *
   * Useful for testing metadata display
   *
   * @param keyName - Name of the key
   * @returns Date string if visible
   */
  async getKeyCreatedDate(keyName: string): Promise<string | null> {
    await this.navigate();

    const keyRow = this.page.locator(`text=${keyName}`).locator('..');
    // Typically second or third cell contains date
    const dateCell = await keyRow.locator('td').nth(1).textContent();

    return dateCell?.trim() || null;
  }
}
