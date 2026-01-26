import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, createErrorResponse } from "../_shared/utils.ts";

async function updateOrganization(req: Request, currentUserSale: any) {
  if (!currentUserSale.administrator) {
    return createErrorResponse(401, "Not Authorized");
  }

  const { name, settings, logo_light, logo_dark } = await req.json();

  // Validate required fields
  if (!name || typeof name !== "string") {
    return createErrorResponse(400, "Invalid name");
  }

  if (settings && typeof settings !== "object") {
    return createErrorResponse(400, "Invalid settings format");
  }

  // Users can only update their own organization
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .update({
      name,
      settings: settings || {},
      logo_light,
      logo_dark,
    })
    .eq("id", currentUserSale.organization_id)
    .select()
    .single();

  if (error) {
    console.error("Error updating organization:", error);
    return createErrorResponse(500, "Failed to update organization");
  }

  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function getOrganization(req: Request, currentUserSale: any) {
  // Any authenticated user can view their organization
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq("id", currentUserSale.organization_id)
    .single();

  if (error) {
    console.error("Error fetching organization:", error);
    return createErrorResponse(500, "Failed to fetch organization");
  }

  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
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

  const currentUserSale = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("user_id", data.user.id)
    .single();

  if (!currentUserSale?.data) {
    return createErrorResponse(401, "Unauthorized");
  }

  if (req.method === "GET") {
    return getOrganization(req, currentUserSale.data);
  }

  if (req.method === "PATCH") {
    return updateOrganization(req, currentUserSale.data);
  }

  return createErrorResponse(405, "Method Not Allowed");
});
