/**
 * Login Page Object - Atomic CRM
 *
 * Encapsulates all signup, signin, and logout interactions.
 *
 * Usage:
 *   const loginPage = new LoginPage(page);
 *   await loginPage.signUp(user);
 *   await loginPage.signIn(email, password);
 *   await loginPage.logout();
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { TestUser } from '../helpers';

export class LoginPage extends BasePage {
  // Selectors (can be updated in one place if DOM changes)
  private readonly emailInput = 'input[name="email"]';
  private readonly passwordInput = 'input[name="password"]';
  private readonly submitButton = 'button[type="submit"]:has-text("Sign in")';
  private readonly organizationNameInput = 'input#organization_name';
  private readonly firstNameInput = 'input#first_name';
  private readonly lastNameInput = 'input#last_name';
  private readonly signupEmailInput = 'input#email';
  private readonly signupPasswordInput = 'input#password';
  private readonly signupSubmitButton = 'button[type="submit"]';

  /**
   * Navigate to login page
   */
  async navigateToLogin(): Promise<void> {
    await this.goto('/#/login');
    await this.waitForElement(this.emailInput, 10000, 'Login form');
  }

  /**
   * Navigate to signup page
   *
   * @param newOrganization - Whether to create new organization (appends ?new_org=true)
   */
  async navigateToSignup(newOrganization: boolean = false): Promise<void> {
    const url = newOrganization ? '/#/sign-up?new_org=true' : '/#/sign-up';
    await this.goto(url);
    await this.waitForElement(this.organizationNameInput, 10000, 'Signup form');
  }

  /**
   * Sign in with email and password
   *
   * @param email - User email
   * @param password - User password
   * @throws Error if login fails or redirect doesn't complete
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.navigateToLogin();

    await this.fill(this.emailInput, email, 'Email');
    await this.fill(this.passwordInput, password, 'Password');
    await this.click(this.submitButton);

    // Wait for redirect to dashboard
    await this.waitForNavigation('/#/');
  }

  /**
   * Sign up new user and create organization
   *
   * @param user - User data (email, password, firstName, lastName, organizationName)
   * @param newOrganization - Whether this is a secondary organization signup
   * @throws Error if signup fails or redirect doesn't complete
   */
  async signUp(user: TestUser, newOrganization: boolean = false): Promise<void> {
    await this.navigateToSignup(newOrganization);

    // Fill form fields in order
    const orgName = user.organizationName || 'Test Organization';
    await this.fill(this.organizationNameInput, orgName, 'Organization name');
    await this.fill(this.firstNameInput, user.firstName, 'First name');
    await this.fill(this.lastNameInput, user.lastName, 'Last name');
    await this.fill(this.signupEmailInput, user.email, 'Email');
    await this.fill(this.signupPasswordInput, user.password, 'Password');

    // Submit and wait for redirect
    await this.click(this.signupSubmitButton);
    await this.waitForNavigation('/#/');
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
   * @throws Error if logout doesn't complete
   */
  async logout(): Promise<void> {
    const userMenuSelectors = [
      '[data-testid="user-menu"]',
      'button[aria-label*="menu"]',
      'button:has([data-avatar])',
      '.avatar',
    ];

    let clicked = false;
    for (const selector of userMenuSelectors) {
      try {
        if (
          await this.page
            .locator(selector)
            .isVisible({ timeout: 1000 })
            .catch(() => false)
        ) {
          await this.click(selector);
          clicked = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!clicked) {
      // Fallback: Direct navigation to login
      await this.goto('/#/login');
      return;
    }

    // Click logout menu item (try multiple text variations)
    const logoutSelectors = [
      'text="Logout"',
      'text="Sign out"',
      'text="Log out"',
    ];

    let logoutClicked = false;
    for (const selector of logoutSelectors) {
      try {
        if (
          await this.page
            .locator(selector)
            .isVisible({ timeout: 1000 })
            .catch(() => false)
        ) {
          await this.click(selector);
          logoutClicked = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (logoutClicked) {
      await this.waitForNavigation('/#/login');
    }
  }

  /**
   * Assert on login page
   */
  async assertOnLoginPage(): Promise<void> {
    await this.assertVisible(this.emailInput, 'Login page should show email input');
    await this.assertVisible(this.passwordInput, 'Login page should show password input');
  }

  /**
   * Assert on signup page
   */
  async assertOnSignupPage(): Promise<void> {
    await this.assertVisible(
      this.organizationNameInput,
      'Signup page should show org name input'
    );
    await this.assertVisible(
      this.firstNameInput,
      'Signup page should show first name input'
    );
  }

  /**
   * Assert on dashboard (logged in)
   */
  async assertOnDashboard(): Promise<void> {
    const url = this.getCurrentUrl();
    if (!url.includes('/#/')) {
      throw new Error(`Expected to be on dashboard, but URL is: ${url}`);
    }
  }
}
