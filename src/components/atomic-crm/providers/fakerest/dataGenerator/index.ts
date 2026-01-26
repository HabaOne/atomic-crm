import { generateCompanies } from "./companies";
import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { generateDealNotes } from "./dealNotes";
import { generateDeals } from "./deals";
import { finalize } from "./finalize";
import { generateOrganizations } from "./organizations";
import { generateSales } from "./sales";
import { generateTags } from "./tags";
import { generateTasks } from "./tasks";
import type { Db } from "./types";

export default (): Db => {
  const db = {} as Db;

  // Generate organizations first (needed for organization_id)
  db.organizations = generateOrganizations(db);

  // All other resources belong to organization 1
  const organizationId = 1;

  db.sales = generateSales(db).map(sale => ({ ...sale, organization_id: organizationId }));
  db.tags = generateTags(db).map(tag => ({ ...tag, organization_id: organizationId }));
  db.companies = generateCompanies(db).map(company => ({ ...company, organization_id: organizationId }));
  db.contacts = generateContacts(db).map(contact => ({ ...contact, organization_id: organizationId }));
  db.contact_notes = generateContactNotes(db).map(note => ({ ...note, organization_id: organizationId }));
  db.deals = generateDeals(db).map(deal => ({ ...deal, organization_id: organizationId }));
  db.deal_notes = generateDealNotes(db).map(note => ({ ...note, organization_id: organizationId }));
  db.tasks = generateTasks(db).map(task => ({ ...task, organization_id: organizationId }));

  finalize(db);

  return db;
};
