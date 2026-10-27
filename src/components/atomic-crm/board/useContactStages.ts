import { useGetList } from "ra-core";

import type { Organization } from "../root/OrganizationContext";
import { resolveContactStages } from "./contactStages";

/**
 * The contact stages of the current user's organization. RLS limits the
 * organizations list to the user's own organization.
 */
export const useContactStages = () => {
  const { data, isPending } = useGetList<Organization>(
    "organizations",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime: 5 * 60 * 1000 },
  );
  const settings = data?.[0]?.settings as
    | { contactStages?: unknown }
    | undefined;
  return {
    stages: resolveContactStages(settings?.contactStages),
    isPending,
  };
};
