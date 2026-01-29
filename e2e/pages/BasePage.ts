/**
 * Base Page Object - Atomic CRM
 *
 * Provides common patterns for all page objects:
 * - Selector waiting with timeouts
 * - Error messages on timeout
 * - Network idle checks
 * - Screenshot capture on errors
 * - Assertion helpers
 *
 * All page objects should extend this class.
 *
 * Usage:
 *   export class ContactsPage extends BasePage {
 *     async createContact() { ... }
 *   }
 */

import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to page by path
   *
   * @param path - URL path (e.g., '/#/contacts')
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get locator with immediate visibility check
   *
   * @param selector - CSS selector or data-testid
   */
  locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  /**
   * Click element with built-in wait and error handling
   *
   * @param selector - Element selector
   * @param timeout - Max wait time in milliseconds (default: 10s)
   * @throws Error with screenshot if click fails
   */
  async click(selector: string, timeout: number = 10000): Promise<void> {
    try {
      await this.page.locator(selector).click({ timeout });
    } catch (error) {
      await this.screenshot(`click-error-${Date.now()}`);
      throw new Error(`Failed to click "${selector}": ${error}`);
    }
  }

  /**
   * Fill input field with label for debugging
   *
   * @param selector - Input selector
   * @param value - Value to fill
   * @param label - Optional label for error messages
   * @throws Error with screenshot if fill fails
   */
  async fill(selector: string, value: string, label: string = ''): Promise<void> {
    try {
      await this.page.locator(selector).fill(value);
    } catch (error) {
      await this.screenshot(`fill-error-${Date.now()}`);
      throw new Error(`Failed to fill ${label || selector} with "${value}": ${error}`);
    }
  }

  /**
   * Type text slowly (useful for autocomplete fields)
   *
   * @param selector - Input selector
   * @param text - Text to type
   * @param delay - Delay between keystrokes in milliseconds (default: 50ms)
   */
  async type(selector: string, text: string, delay: number = 50): Promise<void> {
    await this.page.locator(selector).type(text, { delay });
  }

  /**
   * Wait for element and verify visibility
   *
   * @param selector - Element selector
   * @param timeout - Max wait time in milliseconds (default: 10s)
   * @param label - Optional label for error messages
   * @returns Locator instance
   * @throws Error with screenshot if element not found
   */
  async waitForElement(
    selector: string,
    timeout: number = 10000,
    label: string = ''
  ): Promise<Locator> {
    const locator = this.page.locator(selector);
    try {
      await locator.waitFor({ state: 'visible', timeout });
      return locator;
    } catch (error) {
      await this.screenshot(`wait-error-${Date.now()}`);
      throw new Error(
        `Element not found within ${timeout}ms ${label ? `(${label})` : ''}: ${selector}`
      );
    }
  }

  /**
   * Assert element is visible
   *
   * @param selector - Element selector
   * @param label - Optional label for error messages
   * @throws Error if element not visible
   */
  async assertVisible(selector: string, label: string = ''): Promise<void> {
    try {
      await expect(this.page.locator(selector)).toBeVisible({ timeout: 5000 });
    } catch (error) {
      await this.screenshot(`visibility-error-${Date.now()}`);
      throw new Error(`Expected visible ${label || selector}, but not found`);
    }
  }

  /**
   * Assert element is hidden
   *
   * @param selector - Element selector
   * @param label - Optional label for error messages
   * @throws Error if element is visible
   */
  async assertHidden(selector: string, label: string = ''): Promise<void> {
    try {
      await expect(this.page.locator(selector)).not.toBeVisible({ timeout: 5000 });
    } catch (error) {
      await this.screenshot(`hidden-error-${Date.now()}`);
      throw new Error(`Expected hidden ${label || selector}, but is visible`);
    }
  }

  /**
   * Assert text content contains substring
   *
   * @param selector - Element selector
   * @param text - Text to search for
   * @throws Error if text not found
   */
  async assertContainsText(selector: string, text: string): Promise<void> {
    try {
      await expect(this.page.locator(selector)).toContainText(text);
    } catch (error) {
      await this.screenshot(`text-error-${Date.now()}`);
      throw new Error(`Expected "${selector}" to contain "${text}"`);
    }
  }

  /**
   * Wait for navigation to complete
   *
   * @param path - Optional URL path to wait for
   * @param timeout - Max wait time in milliseconds (default: 15s)
   */
  async waitForNavigation(path?: string, timeout: number = 15000): Promise<void> {
    if (path) {
      await this.page.waitForURL(path, { timeout });
    } else {
      await this.page.waitForLoadState('networkidle');
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Take screenshot for debugging
   *
   * @param name - Screenshot name (timestamp added automatically)
   */
  async screenshot(name: string): Promise<void> {
    const timestamp = Date.now();
    await this.page.screenshot({
      path: `test-results/${name}-${timestamp}.png`,
      fullPage: true,
    });
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Get text content of element
   *
   * @param selector - Element selector
   */
  async getText(selector: string): Promise<string | null> {
    return this.page.locator(selector).textContent();
  }

  /**
   * Get input value
   *
   * @param selector - Input selector
   */
  async getInputValue(selector: string): Promise<string | null> {
    return this.page.locator(selector).inputValue();
  }

  /**
   * Press keyboard key
   *
   * @param key - Key name (e.g., 'Enter', 'Escape', 'Tab')
   */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * Wait for function to return true
   *
   * @param fn - Function to evaluate
   * @param timeout - Max wait time in milliseconds
   * @param message - Error message if timeout
   */
  async waitForFunction(
    fn: () => Promise<boolean>,
    timeout: number = 5000,
    message: string = 'Wait for function timeout'
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await fn()) {
        return;
      }
      await this.page.waitForTimeout(100);
    }
    throw new Error(message);
  }

  /**
   * Handle browser alert/confirm dialogs
   *
   * @param action - 'accept' or 'dismiss'
   */
  setupDialogHandler(action: 'accept' | 'dismiss' = 'accept'): void {
    this.page.on('dialog', (dialog) => {
      if (action === 'accept') {
        dialog.accept();
      } else {
        dialog.dismiss();
      }
    });
  }
}
