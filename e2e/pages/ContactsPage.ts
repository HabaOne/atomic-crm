/**
 * Contacts Page Object - Atomic CRM
 *
 * Encapsulates all contact list and contact creation interactions.
 *
 * Usage:
 *   const contactsPage = new ContactsPage(page);
 *   await contactsPage.navigate();
 *   await contactsPage.createContact(contactData);
 *   await contactsPage.assertContactVisible(contactData);
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { TestContact } from '../helpers';

export class ContactsPage extends BasePage {
  // Selectors
  private readonly createButton = 'a[href="#/contacts/create"]';
  private readonly firstNameInput = 'input[name="first_name"]';
  private readonly lastNameInput = 'input[name="last_name"]';
  private readonly emailInput = 'input[name="email"]';
  private readonly submitButton = 'button[type="submit"]';
  private readonly searchInput = 'input[type="search"]';
  private readonly contactTable = 'table';

  /**
   * Navigate to contacts list page
   */
  async navigate(): Promise<void> {
    await this.goto('/#/contacts');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click create contact button
   */
  async clickCreate(): Promise<void> {
    await this.click(this.createButton);
    await this.waitForElement(this.firstNameInput, 10000, 'Contact form');
  }

  /**
   * Create contact with full flow
   *
   * Navigates to contacts, clicks create, fills form, submits, and verifies creation
   *
   * @param contactData - Contact information
   * @throws Error if any step fails
   */
  async createContact(contactData: TestContact): Promise<void> {
    await this.navigate();
    await this.clickCreate();

    await this.fill(this.firstNameInput, contactData.firstName, 'First name');
    await this.fill(this.lastNameInput, contactData.lastName, 'Last name');
    await this.fill(this.emailInput, contactData.email, 'Email');

    await this.click(this.submitButton);
    await this.waitForNavigation('/#/contacts');

    // Verify contact appears in list
    await this.assertContactVisible(contactData);
  }

  /**
   * Assert contact is visible in list
   *
   * @param contactData - Contact to verify
   * @throws Error if contact not found
   */
  async assertContactVisible(contactData: TestContact): Promise<void> {
    const fullName = `${contactData.firstName} ${contactData.lastName}`;
    await this.assertVisible(`text="${fullName}"`, `Contact: ${fullName}`);
  }

  /**
   * Assert contact is NOT visible in list
   *
   * @param contactData - Contact to verify absence
   * @throws Error if contact is visible
   */
  async assertContactNotVisible(contactData: TestContact): Promise<void> {
    const fullName = `${contactData.firstName} ${contactData.lastName}`;
    await this.assertHidden(`text="${fullName}"`, `Contact: ${fullName}`);
  }

  /**
   * Search for contact by name
   *
   * @param query - Search query
   */
  async search(query: string): Promise<void> {
    const searchField = await this.waitForElement(
      this.searchInput,
      5000,
      'Search input'
    );
    await searchField.fill(query);
    await this.page.waitForTimeout(1000); // Wait for search results
  }

  /**
   * Get count of visible contacts in table
   *
   * Useful for verification (e.g., should only see 5 contacts from own org)
   */
  async getContactCount(): Promise<number> {
    await this.navigate();
    const rows = await this.page.locator('table tbody tr').count();
    return rows;
  }

  /**
   * Get all visible contact names
   *
   * Useful for verification and debugging
   */
  async getVisibleContacts(): Promise<string[]> {
    await this.navigate();

    const contactNames: string[] = [];
    const rows = await this.page.locator('table tbody tr');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const text = await row.textContent();
      if (text) {
        contactNames.push(text.trim());
      }
    }

    return contactNames;
  }

  /**
   * Verify contact with specific email exists
   *
   * More specific than assertContactVisible (checks email too)
   *
   * @param contactData - Contact with email to verify
   */
  async assertContactWithEmailExists(contactData: TestContact): Promise<void> {
    await this.navigate();

    const emailVisible = await this.page
      .locator(`text="${contactData.email}"`)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!emailVisible) {
      throw new Error(
        `Contact with email ${contactData.email} not found in list`
      );
    }
  }

  /**
   * Filter contacts by search and verify result count
   *
   * Useful for testing search functionality and data isolation
   *
   * @param query - Search query
   * @param expectedCount - Expected number of results
   */
  async assertSearchResultCount(query: string, expectedCount: number): Promise<void> {
    await this.navigate();
    await this.search(query);

    const contactCount = await this.getContactCount();
    if (contactCount !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} contacts for query "${query}", ` +
        `but found ${contactCount}`
      );
    }
  }
}
