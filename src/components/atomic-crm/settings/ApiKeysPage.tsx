import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Plus, Trash2, Key, AlertCircle } from "lucide-react";
import { useNotify, usePermissions } from "ra-core";
import { Navigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "../providers/supabase/supabase";

interface ApiKey {
  id: number;
  key_prefix: string;
  type: "master" | "organization";
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

interface NewKeyResponse {
  key: string;
  id: number;
  key_prefix: string;
  type: string;
  name: string;
  created_at: string;
}

export const ApiKeysPage = () => {
  const { permissions } = usePermissions();
  const notify = useNotify();
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");

  const { data: keys, refetch, isLoading } = useQuery({
    queryKey: ["api-keys"],
    enabled: !!permissions?.administrator,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        data: ApiKey[];
      }>("api-keys", {
        method: "GET",
      });
      if (error) throw error;
      return data.data;
    },
  });

  const createKey = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke<
        NewKeyResponse
      >("api-keys", {
        method: "POST",
        body: { name, type: "organization" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setNewKeyValue(data.key);
      setShowNewKeyDialog(true);
      setShowCreateDialog(false);
      setKeyName("");
      refetch();
      notify("API key created successfully", { type: "success" });
    },
    onError: (error) => {
      console.error("Failed to create API key:", error);
      notify("Failed to create API key", { type: "error" });
    },
  });

  const revokeKey = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke("api-keys", {
        method: "DELETE",
        body: { id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      notify("API key revoked", { type: "success" });
    },
    onError: (error) => {
      console.error("Failed to revoke API key:", error);
      notify("Failed to revoke API key", { type: "error" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify("Copied to clipboard", { type: "success" });
  };

  const handleCreateClick = () => {
    setShowCreateDialog(true);
  };

  const handleCreateSubmit = () => {
    if (keyName.trim()) {
      createKey.mutate(keyName.trim());
    }
  };

  // Wait for permissions to load
  if (permissions === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading permissions...</div>
      </div>
    );
  }

  // Only admins can access this page
  if (!permissions.administrator) {
    return <Navigate to="/" />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading API keys...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8" data-testid="api-keys-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for programmatic access to your CRM
          </p>
        </div>
        <Button onClick={handleCreateClick} data-testid="create-api-key-button">
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          API keys provide full access to your organization's data. Keep them
          secure and never share them publicly.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Active API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {keys?.filter((k) => !k.revoked_at).map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 border rounded"
              >
                <div className="flex items-center space-x-4">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{key.name || "Unnamed"}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {key.key_prefix}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at &&
                        ` • Last used ${
                          new Date(key.last_used_at).toLocaleDateString()
                        }`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  data-testid={`revoke-api-key-${key.id}`}
                  onClick={() => {
                    if (
                      confirm("Revoke this API key? This cannot be undone.")
                    ) {
                      revokeKey.mutate(key.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(!keys || keys.filter((k) => !k.revoked_at).length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                No API keys yet. Create one to get started.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Enter a name to identify this API key (e.g., "Zapier
              Integration").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g., Zapier Integration"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateSubmit();
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setKeyName("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubmit}
                disabled={!keyName.trim() || createKey.isPending}
              >
                {createKey.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showNewKeyDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewKeyDialog(false);
            setNewKeyValue(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy this key now - you won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This is the only time you'll see this key. Copy it now and store
                it securely.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Your API Key</Label>
              <div className="flex space-x-2">
                <Input
                  value={newKeyValue || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={() => copyToClipboard(newKeyValue!)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 bg-muted rounded text-sm space-y-2">
              <p className="font-medium">Usage Example:</p>
              <code className="block text-xs overflow-x-auto">
                curl -X GET \<br />
                &nbsp;&nbsp;'{window.location.origin}/functions/v1/api-gateway?resource=contacts' \<br />
                &nbsp;&nbsp;-H 'Authorization: Bearer {newKeyValue}'
              </code>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

ApiKeysPage.path = "/settings/api-keys";
