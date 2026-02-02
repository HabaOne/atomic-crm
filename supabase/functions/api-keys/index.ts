import { createClient } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, createErrorResponse } from "../_shared/utils.ts";

interface ApiKeyValidation {
  isValid: boolean;
  type: "master" | "organization" | null;
  organizationId: number | null;
  scopes: string[];
}

function generateApiKey(type: "master" | "organization"): string {
  const prefix = type === "master" ? "ak_master_" : "ak_org_";
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const randomString = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 32);
  return prefix + randomString;
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateApiKey(authHeader: string): Promise<ApiKeyValidation> {
  const key = authHeader.replace(/^Bearer\s+/i, "");

  if (!key.startsWith("ak_")) {
    return { isValid: false, type: null, organizationId: null, scopes: [] };
  }

  const keyHash = await hashApiKey(key);

  const { data: apiKeyRecord, error } = await supabaseAdmin
    .from("api_keys")
    .select("type, organization_id, scopes, revoked_at, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !apiKeyRecord) {
    return { isValid: false, type: null, organizationId: null, scopes: [] };
  }

  if (apiKeyRecord.revoked_at) {
    return { isValid: false, type: null, organizationId: null, scopes: [] };
  }

  if (
    apiKeyRecord.expires_at &&
    new Date(apiKeyRecord.expires_at) < new Date()
  ) {
    return { isValid: false, type: null, organizationId: null, scopes: [] };
  }

  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash)
    .then(() => {});

  return {
    isValid: true,
    type: apiKeyRecord.type as "master" | "organization",
    organizationId: apiKeyRecord.organization_id,
    scopes: apiKeyRecord.scopes || ["read", "write"],
  };
}

async function handleMasterKeyPost(
  req: Request,
): Promise<Response> {
  const { name, organization_id, expires_at } = await req.json();

  if (!organization_id) {
    return createErrorResponse(
      400,
      "organization_id is required when using master key",
    );
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("id", organization_id)
    .single();

  if (orgError || !org) {
    return createErrorResponse(404, "Organization not found");
  }

  const apiKey = generateApiKey("organization");
  const keyHash = await hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 12) + "...";

  const { data: newKey, error } = await supabaseAdmin
    .from("api_keys")
    .insert({
      key_hash: keyHash,
      key_prefix: keyPrefix,
      type: "organization",
      organization_id,
      created_by: null,
      expires_at: expires_at || null,
      name: name || "Auto-provisioned by HABA",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create API key:", error);
    return createErrorResponse(500, "Failed to create API key");
  }

  return new Response(
    JSON.stringify({
      key: apiKey,
      id: newKey.id,
      key_prefix: keyPrefix,
      type: "organization",
      organization_id,
      name: newKey.name,
      created_at: newKey.created_at,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return createErrorResponse(401, "Missing Authorization header");
  }

  if (authHeader.includes("ak_master_") || authHeader.includes("ak_org_")) {
    const validation = await validateApiKey(authHeader);

    if (!validation.isValid) {
      return createErrorResponse(401, "Invalid or expired API key");
    }

    if (validation.type !== "master") {
      return createErrorResponse(
        403,
        "Only master API keys can provision organization keys",
      );
    }

    if (req.method === "POST") {
      return handleMasterKeyPost(req);
    }

    return createErrorResponse(405, "Master key only supports POST method");
  }

  const localClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data } = await localClient.auth.getUser();
  if (!data?.user) {
    return createErrorResponse(401, "Unauthorized");
  }

  const { data: currentUserSale } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("user_id", data.user.id)
    .single();

  if (!currentUserSale) {
    return createErrorResponse(401, "Unauthorized");
  }

  if (!currentUserSale.administrator) {
    return createErrorResponse(
      403,
      "Only administrators can manage API keys",
    );
  }

  if (req.method === "POST") {
    const { name, type, expires_at } = await req.json();

    if (!["master", "organization"].includes(type)) {
      return createErrorResponse(400, "Invalid key type");
    }

    if (type === "master") {
      return createErrorResponse(
        403,
        "Master keys can only be created via database",
      );
    }

    const apiKey = generateApiKey(type);
    const keyHash = await hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 12) + "...";

    const { data: newKey, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        key_hash: keyHash,
        key_prefix: keyPrefix,
        type,
        organization_id: type === "organization"
          ? currentUserSale.organization_id
          : null,
        created_by: currentUserSale.id,
        expires_at: expires_at || null,
        name,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create API key:", error);
      return createErrorResponse(500, "Failed to create API key");
    }

    return new Response(
      JSON.stringify({
        key: apiKey,
        id: newKey.id,
        key_prefix: keyPrefix,
        type,
        name,
        created_at: newKey.created_at,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  if (req.method === "GET") {
    const { data: keys, error } = await supabaseAdmin
      .from("api_keys")
      .select(
        "id, key_prefix, type, name, created_at, last_used_at, expires_at, revoked_at",
      )
      .eq("organization_id", currentUserSale.organization_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch API keys:", error);
      return createErrorResponse(500, "Failed to fetch API keys");
    }

    return new Response(
      JSON.stringify({ data: keys }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  if (req.method === "DELETE") {
    const { id } = await req.json();

    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", currentUserSale.organization_id);

    if (error) {
      console.error("Failed to revoke API key:", error);
      return createErrorResponse(500, "Failed to revoke API key");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  return createErrorResponse(405, "Method not allowed");
});
