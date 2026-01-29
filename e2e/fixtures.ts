/**
 * E2E Test Fixtures - Atomic CRM
 *
 * Factory functions for generating consistent test data.
 *
 * Benefits:
 * - Centralized test data management
 * - Easy to create variations for different scenarios
 * - Deterministic naming for assertions
 * - Easy to update fields without modifying tests
 *
 * Usage:
 *   import { generateUser, generateContact, multiTenancyScenario } from './fixtures';
 *   const user = generateUser('org1');
 *   const contact = generateContact('John Doe');
 *   const scenario = multiTenancyScenario; // Complete predefined scenario
 */

import { TestUser, TestContact, TestCompany } from './helpers';

// ============================================================================
// USER FIXTURES
// ============================================================================

/**
 * Generate unique user credentials based on prefix
 *
 * Example: generateUser('org1') creates:
 * - email: admin@org1-test.local
 * - password: test-password-org1-123
 * - firstName: Test
 * - lastName: AdminORG1
 *
 * @param prefix - Prefix for uniqueness (e.g., 'org1', 'tenant2')
 * @param overrides - Optional field overrides
 */
export function generateUser(prefix: string, overrides?: Partial<TestUser>): TestUser {
  const emailDomain = `${prefix}-test.local`;

  return {
    email: `admin@${emailDomain}`,
    password: `test-password-${prefix}-123`,
    firstName: 'Test',
    lastName: `Admin${prefix.toUpperCase()}`,
    organizationName: `Test Organization - ${prefix}`,
    ...overrides,
  };
}

/**
 * Generate regular (non-admin) user
 *
 * @param prefix - Prefix for uniqueness
 * @param overrides - Optional field overrides
 */
export function generateRegularUser(
  prefix: string,
  overrides?: Partial<TestUser>
): TestUser {
  const emailDomain = `${prefix}-test.local`;

  return {
    email: `user@${emailDomain}`,
    password: `test-password-${prefix}-456`,
    firstName: 'Test',
    lastName: `User${prefix.toUpperCase()}`,
    ...overrides,
  };
}

/**
 * Generate unique user with timestamp
 *
 * Ensures uniqueness even across multiple test runs:
 * - email: test+org1-1705046400000@atomic-crm.local
 *
 * @param prefix - Prefix for uniqueness
 */
export function generateUniqueUser(prefix: string): TestUser {
  const timestamp = Date.now();
  const runId = `${prefix}-${timestamp}`;

  return {
    email: `test+${runId}@atomic-crm.local`,
    password: `test-password-${runId}`,
    firstName: `TestUser${prefix}`,
    lastName: `Run${timestamp}`,
    organizationName: `Test Org ${runId}`,
  };
}

// ============================================================================
// CONTACT FIXTURES
// ============================================================================

/**
 * Generate unique contact data
 *
 * @param name - Full name (first and last separated by space)
 * @param overrides - Optional field overrides
 */
export function generateContact(
  name: string,
  overrides?: Partial<TestContact>
): TestContact {
  const parts = name.split(' ');
  const firstName = parts[0];
  const lastName = parts[1] || 'Contact';

  return {
    firstName,
    lastName,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@test-crm.local`,
    ...overrides,
  };
}

/**
 * Generate unique contact with timestamp
 *
 * Ensures uniqueness across test runs:
 * - email: contact-1705046400000@test.local
 *
 * @param name - Base contact name
 */
export function generateUniqueContact(name: string): TestContact {
  const timestamp = Date.now();

  return {
    firstName: name,
    lastName: `Contact${timestamp}`,
    email: `${name.toLowerCase()}-${timestamp}@test.local`,
  };
}

/**
 * Predefined contact for Org 1
 */
export function contactOrg1(): TestContact {
  return generateContact('Contact Org1', {
    email: 'contact@org1.test',
  });
}

/**
 * Predefined contact for Org 2
 */
export function contactOrg2(): TestContact {
  return generateContact('Contact Org2', {
    email: 'contact@org2.test',
  });
}

/**
 * Contact created by regular user in Org 1
 */
export function contactCreatedByUser(): TestContact {
  return generateContact('Company Org1', {
    email: 'company.user@org1.test',
  });
}

/**
 * Contact for API testing in Org 1
 */
export function contactApiOrg1(): TestContact {
  return generateContact('API Contact Org1', {
    email: 'api@org1.test',
  });
}

/**
 * Contact for API testing in Org 2
 */
export function contactApiOrg2(): TestContact {
  return generateContact('API Contact Org2', {
    email: 'api@org2.test',
  });
}

// ============================================================================
// COMPANY FIXTURES
// ============================================================================

/**
 * Generate unique company data
 *
 * @param name - Company name
 * @param overrides - Optional field overrides
 */
export function generateCompany(
  name: string,
  overrides?: Partial<TestCompany>
): TestCompany {
  return {
    name,
    sector: 'Technology',
    ...overrides,
  };
}

/**
 * Company created in Org 1
 */
export function companyOrg1(): TestCompany {
  return generateCompany('Company Org1 Inc', {
    sector: 'Technology',
  });
}

/**
 * Company created in Org 2
 */
export function companyOrg2(): TestCompany {
  return generateCompany('Company Org2 Ltd', {
    sector: 'Healthcare',
  });
}

// ============================================================================
// API KEY FIXTURES
// ============================================================================

export const apiKeyNames = {
  org1: 'Test Integration Org1',
  org2: 'Test Integration Org2',
  oneTime: 'One-Time Display Key',
  documentation: 'Documentation Example',
  revoke: 'Key to Revoke',
};

// ============================================================================
// PREDEFINED SCENARIOS
// ============================================================================

/**
 * Test data for multi-tenancy scenario
 *
 * Creates two complete organizations with:
 * - Admin user for each organization
 * - Regular user in each organization
 * - Sample contacts for each organization
 * - Sample companies for each organization
 *
 * Usage:
 *   const scenario = multiTenancyScenario;
 *   await signup(page, scenario.org1.admin);
 *   await createContact(page, scenario.org1.contacts[0]);
 */
export const multiTenancyScenario = {
  org1: {
    admin: generateUser('org1', {
      email: 'admin1@org1-test.local',
      lastName: 'AdminOrg1',
    }),
    user: generateRegularUser('org1', {
      email: 'user1@org1-test.local',
      lastName: 'UserOrg1',
    }),
    contacts: [contactOrg1(), contactCreatedByUser()],
    companies: [companyOrg1()],
  },
  org2: {
    admin: generateUser('org2', {
      email: 'admin2@org2-test.local',
      lastName: 'AdminOrg2',
    }),
    user: generateRegularUser('org2', {
      email: 'user2@org2-test.local',
      lastName: 'UserOrg2',
    }),
    contacts: [contactOrg2()],
    companies: [companyOrg2()],
  },
};

/**
 * Test data for API key scenario
 *
 * Creates two organizations for API testing with:
 * - Admin user for each organization
 * - Named API keys for each organization
 * - Sample contacts for API CRUD testing
 *
 * Usage:
 *   const scenario = apiKeyScenario;
 *   const org1Key = await createApiKey(page, scenario.org1.apiKeyName);
 */
export const apiKeyScenario = {
  org1: {
    admin: generateUser('apikey1', {
      email: 'apikey-admin1@test.com',
      organizationName: 'API Test Org 1',
    }),
    apiKeyName: apiKeyNames.org1,
    contact: contactApiOrg1(),
  },
  org2: {
    admin: generateUser('apikey2', {
      email: 'apikey-admin2@test.com',
      organizationName: 'API Test Org 2',
    }),
    apiKeyName: apiKeyNames.org2,
    contact: contactApiOrg2(),
  },
};

/**
 * Test data for smoke tests
 *
 * Minimal data for basic UI verification
 */
export const smokeTestScenario = {
  newUser: generateUser('smoke', {
    email: 'smoke-test@test.local',
    organizationName: 'Smoke Test Org',
  }),
};

/**
 * Test data for edge cases
 */
export const edgeCaseScenario = {
  // User with special characters in name
  specialCharactersUser: generateUser('edge1', {
    firstName: "O'Brien",
    lastName: "Müller-González",
  }),

  // Contact with long name
  longNameContact: generateContact('Alexander Christopher Thompson-Williams'),

  // User with similar email to another
  similarEmailUser1: generateUser('similar', {
    email: 'testuser@example.com',
  }),
  similarEmailUser2: generateUser('similar', {
    email: 'test.user@example.com',
  }),

  // Contact with numeric first name (edge case)
  numericContact: generateContact('123 Test'),
};

// ============================================================================
// SELECTORS FOR TESTING
// ============================================================================

/**
 * Priority data-testid selectors to add to components
 *
 * Format: 'page-element-purpose'
 * Example: 'login-email-input' (login page, input, email)
 */
export const priorityTestIds = {
  // Auth pages
  'login-email-input': 'input[name="email"]',
  'login-password-input': 'input[name="password"]',
  'login-submit-button': 'button[type="submit"]',
  'signup-form': 'form',
  'signup-org-name-input': 'input#organization_name',
  'signup-first-name-input': 'input#first_name',
  'signup-last-name-input': 'input#last_name',
  'signup-email-input': 'input#email',
  'signup-password-input': 'input#password',
  'signup-submit-button': 'button[type="submit"]',

  // Contacts page
  'contacts-list': 'table',
  'contacts-create-button': 'a[href="#/contacts/create"]',
  'contacts-first-name-input': 'input[name="first_name"]',
  'contacts-last-name-input': 'input[name="last_name"]',
  'contacts-email-input': 'input[name="email"]',
  'contacts-submit-button': 'button[type="submit"]',

  // API keys page
  'api-keys-heading': 'h1',
  'api-keys-create-button': 'button:has-text("Create API Key")',
  'api-keys-key-name-input': 'input#keyName',
  'api-keys-create-dialog-button': 'button:has-text("Create")',
  'api-keys-key-display': 'input[readonly][class*="font-mono"]',

  // User menu
  'user-menu': '[data-testid="user-menu"]',
  'user-menu-logout': 'text="Logout", text="Sign out", text="Log out"',
};
