import { createClient } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, createErrorResponse } from "../_shared/utils.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization")!;
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
