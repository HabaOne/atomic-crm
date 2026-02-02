import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, createErrorResponse } from "../_shared/utils.ts";

interface ApiKeyValidation {
  isValid: boolean;
  type: "master" | "organization" | null;
  organizationId: number | null;
  scopes: string[];
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

async function createServiceAccount(req: Request): Promise<Response> {
  const { organization_id, name } = await req.json();

  if (!organization_id) {
    return createErrorResponse(400, "organization_id is required");
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("id", organization_id)
    .single();

  if (orgError || !org) {
    return createErrorResponse(404, "Organization not found");
  }

  const serviceEmail = `service-${organization_id}-${Date.now()}@haba.services`;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: serviceEmail,
    email_confirm: true,
    user_metadata: {
      organization_id,
      is_service_account: true,
      first_name: name || "HABA",
      last_name: "Service Account",
    },
  });

  if (error) {
    console.error("Failed to create service account:", error);
    return createErrorResponse(500, error.message);
  }

  return new Response(
    JSON.stringify({
      user_id: data.user.id,
      organization_id,
      email: serviceEmail,
      is_service_account: true,
    }),
    {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}

async function updateSaleDisabled(user_id: string, disabled: boolean) {
  return await supabaseAdmin
    .from("sales")
    .update({ disabled: disabled ?? false })
    .eq("user_id", user_id);
}

async function updateSaleAdministrator(
  user_id: string,
  administrator: boolean,
) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .update({ administrator })
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating user:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }
  return sales.at(0);
}

async function updateSaleAvatar(user_id: string, avatar: string) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .update({ avatar })
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating user:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }
  return sales.at(0);
}

async function inviteUser(req: Request, currentUserSale: any) {
  const { email, password, first_name, last_name, disabled, administrator } =
    await req.json();

  if (!currentUserSale.administrator) {
    return createErrorResponse(401, "Not Authorized");
  }

  const { data, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: !!password,
    user_metadata: {
      first_name,
      last_name,
      organization_id: currentUserSale.organization_id,
      administrator: administrator || false,
    },
  });

  let emailError = null;
  if (!password) {
    const result = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    emailError = result.error;
  }

  if (!data?.user || userError) {
    console.error(`Error inviting user: user_error=${userError}`);
    return createErrorResponse(500, "Internal Server Error");
  }

  if (!data?.user || userError || emailError) {
    console.error(`Error inviting user, email_error=${emailError}`);
    return createErrorResponse(500, "Failed to send invitation mail");
  }

  try {
    await updateSaleDisabled(data.user.id, disabled);
    const sale = await updateSaleAdministrator(data.user.id, administrator);

    return new Response(
      JSON.stringify({
        data: sale,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    return createErrorResponse(500, "Internal Server Error");
  }
}

async function patchUser(req: Request, currentUserSale: any) {
  const {
    sales_id,
    email,
    first_name,
    last_name,
    avatar,
    administrator,
    disabled,
  } = await req.json();
  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("id", sales_id)
    .single();

  if (!sale) {
    return createErrorResponse(404, "Not Found");
  }

  // Users can only update their own profile unless they are an administrator
  if (!currentUserSale.administrator && currentUserSale.id !== sale.id) {
    return createErrorResponse(401, "Not Authorized");
  }

  const { data, error: userError } =
    await supabaseAdmin.auth.admin.updateUserById(sale.user_id, {
      email,
      ban_duration: disabled ? "87600h" : "none",
      user_metadata: { first_name, last_name },
    });

  if (!data?.user || userError) {
    console.error("Error patching user:", userError);
    return createErrorResponse(500, "Internal Server Error");
  }

  if (avatar) {
    await updateSaleAvatar(data.user.id, avatar);
  }

  // Only administrators can update the administrator and disabled status
  if (!currentUserSale.administrator) {
    const { data: new_sale } = await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("id", sales_id)
      .single();
    return new Response(
      JSON.stringify({
        data: new_sale,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  try {
    await updateSaleDisabled(data.user.id, disabled);
    const sale = await updateSaleAdministrator(data.user.id, administrator);
    return new Response(
      JSON.stringify({
        data: sale,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    return createErrorResponse(500, "Internal Server Error");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
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
        "Only master API keys can create service accounts",
      );
    }

    if (req.method === "POST") {
      return createServiceAccount(req);
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
  const currentUserSale = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("user_id", data.user.id)
    .single();

  if (!currentUserSale?.data) {
    return createErrorResponse(401, "Unauthorized");
  }
  if (req.method === "POST") {
    return inviteUser(req, currentUserSale.data);
  }

  if (req.method === "PATCH") {
    return patchUser(req, currentUserSale.data);
  }

  return createErrorResponse(405, "Method Not Allowed");
});
