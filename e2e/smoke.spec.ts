import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test.beforeEach(async ({ context }) => {
    // Clear all browser state before each test
    await context.clearCookies();
    await context.clearPermissions();
  });

  test('application loads root', async ({ page }) => {
    // Listen for console messages and errors
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    // Clear localStorage and sessionStorage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Now reload to ensure fresh state
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait a bit more for React to hydrate
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'test-results/smoke-test-root.png', fullPage: true });

    const url = page.url();
    console.log('Root redirected to:', url);

    const bodyText = await page.locator('body').textContent();
    console.log('Body text (first 300 chars):', bodyText?.substring(0, 300));

    // Check for React root
    const hasReactRoot = await page.locator('#root').count();
    console.log('Has #root element:', hasReactRoot > 0);
  });

  test('signup page loads', async ({ page }) => {
    // Clear localStorage first
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/#/sign-up');
    await page.waitForLoadState('networkidle');

    // Wait a bit for any redirects
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/smoke-test-signup.png', fullPage: true });

    console.log('Signup page URL:', page.url());
    console.log('Final URL after redirects:', page.url());

    const bodyText = await page.locator('body').textContent();
    console.log('Signup page body (first 300 chars):', bodyText?.substring(0, 300));

    // Check page title
    const h1Text = await page.locator('h1').first().textContent();
    console.log('Page H1:', h1Text);

    // Check if signup page component is in DOM
    const hasSignupPage = await page.locator('[data-testid="signup-page"]').count();
    console.log('Signup page component in DOM:', hasSignupPage);

    const hasSignupHeading = await page.locator('[data-testid="signup-heading"]').isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Has signup heading:', hasSignupHeading);

    // Check if we see signup form elements
    const hasFirstName = await page.locator('input#first_name').isVisible({ timeout: 2000 }).catch(() => false);
    const hasEmail = await page.locator('input#email').isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Has first_name input:', hasFirstName);
    console.log('Has email input:', hasEmail);

    // Dump HTML structure for debugging
    const html = await page.content();
    const fs = await import('fs');
    fs.writeFileSync('test-results/signup-page-html.txt', html);
    console.log('Full HTML dumped to test-results/signup-page-html.txt');
  });

  test('login page loads', async ({ page }) => {
    // Clear localStorage first
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/smoke-test-login.png', fullPage: true });

    console.log('Login page URL:', page.url());

    const bodyText = await page.locator('body').textContent();
    console.log('Login page body (first 300 chars):', bodyText?.substring(0, 300));

    // Check if we see login form elements
    const hasEmail = await page.locator('input[name="email"]').isVisible({ timeout: 2000 }).catch(() => false);
    const hasPassword = await page.locator('input[name="password"]').isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Has email input:', hasEmail);
    console.log('Has password input:', hasPassword);
  });
});
