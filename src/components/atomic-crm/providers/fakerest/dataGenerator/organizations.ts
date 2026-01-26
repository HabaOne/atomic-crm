import type { Organization } from "../../../root/OrganizationContext";
import {
  defaultCompanySectors,
  defaultContactGender,
  defaultDealCategories,
  defaultDealPipelineStatuses,
  defaultDealStages,
  defaultNoteStatuses,
  defaultTaskTypes,
  defaultTitle,
} from "../../../root/defaultConfiguration";
import type { Db } from "./types";

export const generateOrganizations = (_: Db): Organization[] => {
  return [
    {
      id: 1,
      name: "Demo Organization",
      slug: "demo",
      created_at: new Date().toISOString(),
      disabled: false,
      settings: {
        title: defaultTitle,
        companySectors: defaultCompanySectors,
        dealCategories: defaultDealCategories,
        dealPipelineStatuses: defaultDealPipelineStatuses,
        dealStages: defaultDealStages,
        noteStatuses: defaultNoteStatuses,
        taskTypes: defaultTaskTypes,
        contactGender: defaultContactGender,
      },
    },
  ];
};
