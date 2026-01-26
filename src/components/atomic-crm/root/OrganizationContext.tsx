import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useDataProvider } from "ra-core";
import type { ConfigurationContextValue } from "./ConfigurationContext";
import {
  defaultCompanySectors,
  defaultContactGender,
  defaultDarkModeLogo,
  defaultDealCategories,
  defaultDealPipelineStatuses,
  defaultDealStages,
  defaultLightModeLogo,
  defaultNoteStatuses,
  defaultTaskTypes,
  defaultTitle,
} from "./defaultConfiguration";

export interface Organization {
  id: number;
  name: string;
  slug: string;
  settings: Partial<ConfigurationContextValue>;
  logo_light?: { src: string };
  logo_dark?: { src: string };
  created_at?: string;
  disabled?: boolean;
}

interface OrganizationContextValue {
  organization: Organization | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export const OrganizationContext = createContext<OrganizationContextValue>({
  organization: null,
  loading: true,
  refetch: async () => {},
});

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider = ({ children }: OrganizationProviderProps) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const dataProvider = useDataProvider();

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      // RLS automatically filters to user's organization
      const { data } = await dataProvider.getList("organizations", {
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      });

      if (data.length > 0) {
        setOrganization(data[0] as Organization);
      }
    } catch (error) {
      // Fail silently if user is not authenticated or has no organization yet
      console.debug("Unable to fetch organization (user may not be authenticated yet)", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if dataProvider is available
    if (dataProvider) {
      fetchOrganization();
    } else {
      setLoading(false);
    }
  }, [dataProvider]);

  return (
    <OrganizationContext.Provider
      value={{ organization, loading, refetch: fetchOrganization }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext);

// Hook to get configuration with fallbacks to defaults
export const useOrganizationConfiguration = (): ConfigurationContextValue => {
  const { organization } = useOrganization();

  return {
    companySectors: organization?.settings?.companySectors || defaultCompanySectors,
    dealCategories: organization?.settings?.dealCategories || defaultDealCategories,
    dealPipelineStatuses:
      organization?.settings?.dealPipelineStatuses || defaultDealPipelineStatuses,
    dealStages: organization?.settings?.dealStages || defaultDealStages,
    noteStatuses: organization?.settings?.noteStatuses || defaultNoteStatuses,
    taskTypes: organization?.settings?.taskTypes || defaultTaskTypes,
    title: organization?.settings?.title || defaultTitle,
    darkModeLogo:
      organization?.logo_dark?.src || organization?.settings?.darkModeLogo || defaultDarkModeLogo,
    lightModeLogo:
      organization?.logo_light?.src ||
      organization?.settings?.lightModeLogo ||
      defaultLightModeLogo,
    contactGender: organization?.settings?.contactGender || defaultContactGender,
  };
};
