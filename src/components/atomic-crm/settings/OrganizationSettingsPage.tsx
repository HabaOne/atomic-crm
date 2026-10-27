import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import {
  Form,
  useDataProvider,
  useNotify,
  usePermissions,
  useTranslate,
} from "ra-core";
import { Navigate } from "react-router";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useOrganization } from "../root/OrganizationContext";
import type { Organization } from "../root/OrganizationContext";
import { ContactStagesInput } from "./ContactStagesInput";
import { formatJson, formatList, parseJson, parseList } from "./settingsFormat";
import {
  fromContactStageFormValues,
  toContactStageFormValues,
} from "./contactStagesForm";

export const OrganizationSettingsPage = () => {
  OrganizationSettingsPage.path = "/settings/organization";

  const { organization, loading, refetch } = useOrganization();
  const { permissions, isPending: permissionsPending } = usePermissions();
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const translate = useTranslate();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationKey: ["organization", organization?.id],
    mutationFn: async (data: Partial<Organization>) => {
      if (!organization) {
        throw new Error("Organization not found");
      }
      return dataProvider.update("organizations", {
        id: organization.id,
        data: {
          name: data.name,
          settings: data.settings,
        },
        previousData: organization,
      });
    },
    onSuccess: () => {
      refetch();
      // the board and the dashboard read the stages from this cache
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      notify("Organization settings updated", { type: "success" });
    },
    onError: (error) => {
      console.error("Failed to update organization:", error);
      notify("Failed to update organization settings", { type: "error" });
    },
  });

  // Wait for the permissions: redirecting before they load sends admins
  // away on a direct page load
  if (permissionsPending) return null;

  // Only admins can access this page
  if (!permissions?.administrator) {
    return <Navigate to="/" />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading organization settings...</div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Organization not found</div>
      </div>
    );
  }

  const handleSubmit = (values: Partial<Organization>) => {
    const settings = values.settings as Record<string, unknown> | undefined;
    mutate({
      ...values,
      settings: {
        ...settings,
        contactStages: fromContactStageFormValues(settings?.contactStages),
      } as Organization["settings"],
    });
  };

  const defaultValues = {
    ...organization,
    settings: {
      ...organization.settings,
      contactStages: toContactStageFormValues(
        (organization.settings as Record<string, unknown> | undefined)
          ?.contactStages,
      ),
    },
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization's configuration and branding
        </p>
      </div>

      <Form
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        className="space-y-8"
      >
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <TextInput source="name" label={false} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings.title">Application Title</Label>
              <TextInput source="settings.title" label={false} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company Sectors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Available Sectors (comma-separated)</Label>
              <TextInput
                source="settings.companySectors"
                format={formatList}
                parse={parseList}
                label={false}
                multiline
                rows={3}
                helperText="Enter company sectors, one per line or comma-separated"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deal Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Deal Categories (comma-separated)</Label>
              <TextInput
                source="settings.dealCategories"
                format={formatList}
                parse={parseList}
                label={false}
                multiline
                rows={3}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Deal Pipeline Statuses (comma-separated)</Label>
              <TextInput
                source="settings.dealPipelineStatuses"
                format={formatList}
                parse={parseList}
                label={false}
                multiline
                rows={2}
                helperText="Example: won, lost"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Deal Stages (JSON format)</Label>
              <TextInput
                source="settings.dealStages"
                format={formatJson}
                parse={parseJson}
                label={false}
                multiline
                rows={5}
                helperText='Example: [{"value": "opportunity", "label": "Opportunity"}]'
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{translate("crm.settings.contact_stages")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {translate("crm.settings.contact_stages_description")}
            </p>
          </CardHeader>
          <CardContent>
            <ContactStagesInput />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Note Statuses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Note Statuses (JSON format)</Label>
              <TextInput
                source="settings.noteStatuses"
                format={formatJson}
                parse={parseJson}
                label={false}
                multiline
                rows={5}
                helperText='Example: [{"value": "hot", "label": "Hot", "color": "#e88b7d"}]'
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Available Task Types (comma-separated)</Label>
              <TextInput
                source="settings.taskTypes"
                format={formatList}
                parse={parseList}
                label={false}
                multiline
                rows={3}
                helperText="Example: Email, Call, Meeting, Follow-up"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Gender Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Gender Options (JSON format)</Label>
              <TextInput
                source="settings.contactGender"
                format={formatJson}
                parse={parseJson}
                label={false}
                multiline
                rows={5}
                helperText='Example: [{"value": "male", "label": "He/Him"}]'
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </Form>
    </div>
  );
};

OrganizationSettingsPage.path = "/settings/organization";
