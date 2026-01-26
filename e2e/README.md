# E2E Testing for Multi-Tenancy

## Overview

This directory contains end-to-end tests for the multi-tenancy implementation using Playwright. These tests verify the complete user flow including organization creation, user invitation, data isolation, and access control.

## Test Structure

### Test Files

- `setup.spec.ts` - Smoke tests to verify basic application loading
- `multi-tenancy.spec.ts` - Comprehensive multi-tenancy tests

### Test Coverage

The multi-tenancy test suite covers:

1. **Organization Creation**
   - First signup creates organization automatically
   - Admin can access organization settings

2. **User Invitation and Access Control**
   - Admin can invite users to organization
   - Invited users can login
   - Non-admin cannot access organization settings

3. **Data Isolation Between Organizations**
   - Organization 1 users cannot see Organization 2 data
   - Organization 2 users cannot see Organization 1 data
   - Search does not leak data between organizations
   - Sales teams are isolated between organizations

4. **Data Ownership**
   - Data created by user belongs to their organization
   - Admin in same org can see user-created data
   - Other organizations cannot see user-created data

## Running Tests

### Prerequisites

1. Supabase local instance running:
   ```bash
   make start
   ```

2. Application running on http://localhost:5173:
   ```bash
   npm run dev
   ```

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npm run test:e2e -- multi-tenancy.spec.ts
```

### Run with UI Mode (Interactive)

```bash
npm run test:e2e:ui
```

This opens the Playwright UI where you can:
- See tests running in real-time
- Inspect each step
- View screenshots
- Debug failures

### Run in Headed Mode (See Browser)

```bash
npm run test:e2e:headed
```

### Debug Tests

```bash
npm run test:e2e:debug
```

This opens Playwright Inspector for step-by-step debugging.

## Manual Test Setup

If automatic server startup doesn't work, run manually:

### Terminal 1: Start Supabase
```bash
npx supabase start
```

### Terminal 2: Start Application
```bash
npm run dev
```

### Terminal 3: Run Tests
```bash
npm run test:e2e
```

## Test Data

The tests create the following test data:

### Organizations
- **Organization 1**: test-org-1 (admin: admin1@test-org1.com)
- **Organization 2**: test-org-2 (admin: admin2@test-org2.com)

### Users
- `admin1@test-org1.com` - Admin in Org 1
- `user1@test-org1.com` - Regular user in Org 1
- `admin2@test-org2.com` - Admin in Org 2

### Test Data
- Contacts: "Contact Org1" (Org 1), "Contact Org2" (Org 2)
- Companies: "Company by User Org1" (Org 1)

**Note**: Database is reset before tests via `npx supabase db reset`

## Test Configuration

Configuration is in `playwright.config.ts`:

```typescript
{
  testDir: './e2e',
  fullyParallel: false,  // Sequential for isolation
  workers: 1,            // Single worker to avoid races
  timeout: 60000,        // 60 second timeout
  baseURL: 'http://localhost:5173',

  webServer: {
    command: 'make start',
    url: 'http://localhost:5173',
    timeout: 120000,
  }
}
```

## Troubleshooting

### Tests Failing with "element not found"

**Issue**: Selectors don't match the actual page elements

**Solutions**:
1. Run with `--headed` to see the browser
2. Check screenshots in `test-results/` directory
3. Update selectors in test files to match actual DOM
4. Use Playwright Inspector: `npm run test:e2e:debug`

### Database Reset Fails

**Issue**: `npx supabase db reset` fails or times out

**Solutions**:
1. Ensure Supabase is running: `npx supabase status`
2. Manually reset: `npx supabase db reset`
3. Check migrations are valid: `npx supabase migration list`

### Application Not Starting

**Issue**: `make start` command fails or times out

**Solutions**:
1. Start components separately:
   ```bash
   npx supabase start
   npm run dev
   ```
2. Check ports 5173 and 54321 are not in use
3. Review logs for errors

### Tests Timeout

**Issue**: Tests timeout waiting for page elements

**Solutions**:
1. Increase timeout in `playwright.config.ts`
2. Check application performance
3. Use `page.waitForLoadState('networkidle')` before assertions

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Start Supabase
        run: npx supabase start

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Writing New Tests

### Test Structure

```typescript
import { test, expect, type Page } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeAll(async () => {
    // Setup: reset database, create test data
  });

  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/path');

    // Act
    await page.click('button');

    // Assert
    await expect(page.locator('...')).toBeVisible();
  });
});
```

### Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Wait for network idle** before assertions
3. **Use page.locator()** over page.$ for auto-wait
4. **Avoid hard-coded waits** (use waitFor methods instead)
5. **Reset state** between tests (database, local storage)
6. **Use descriptive test names** that explain what's being tested

### Useful Selectors

```typescript
// By test ID
page.locator('[data-testid="user-menu"]')

// By text content
page.locator('text="Sign in"')

// By role
page.getByRole('button', { name: 'Submit' })

// By placeholder
page.getByPlaceholder('Enter email')

// By label
page.getByLabel('Email')

// Combined
page.locator('form').locator('button[type="submit"]')
```

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Multi-Tenancy Implementation Guide](../MULTI_TENANCY.md)
