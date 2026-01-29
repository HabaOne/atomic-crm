import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, createErrorResponse } from "../_shared/utils.ts";

interface ApiKeyValidation {
  isValid: boolean;
  type: "master" | "organization" | null;
  organizationId: number | null;
  scopes: string[];
  keyHash?: string;
}

const RATE_LIMIT = 100;
const rateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkRateLimit(keyHash: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(keyHash);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(keyHash, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateApiKey(apiKey: string): Promise<ApiKeyValidation> {
  const key = apiKey.replace(/^Bearer\s+/i, "");

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
    keyHash,
  };
}

async function executeQuery(
  validation: ApiKeyValidation,
  resource: string,
  operation: string,
  body: any,
  params: URLSearchParams,
) {
  const requiredScope = ["POST", "PATCH", "DELETE"].includes(operation)
    ? "write"
    : "read";
  if (!validation.scopes.includes(requiredScope)) {
    return createErrorResponse(403, `API key lacks ${requiredScope} scope`);
  }

  if (validation.type === "master") {
    return await supabaseAdmin.rpc("api_gateway_query_master", {
      p_resource: resource,
      p_operation: operation,
      p_body: body,
      p_filters: Object.fromEntries(params.entries()),
    });
  } else {
    return await supabaseAdmin.rpc("api_gateway_query_org", {
      p_resource: resource,
      p_operation: operation,
      p_body: body,
      p_filters: Object.fromEntries(params.entries()),
      p_organization_id: validation.organizationId,
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return createErrorResponse(401, "Missing Authorization header");
  }

  const validation = await validateApiKey(authHeader);
  if (!validation.isValid) {
    return createErrorResponse(401, "Invalid or expired API key");
  }

  if (!checkRateLimit(validation.keyHash!)) {
    return new Response(
      JSON.stringify({
        status: 429,
        message: "Rate limit exceeded. Maximum 100 requests per minute.",
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  if (!resource) {
    return createErrorResponse(400, "Missing resource parameter");
  }

  const operation = req.method;
  let body = null;
  if (["POST", "PATCH", "PUT"].includes(operation)) {
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(400, "Invalid JSON body");
    }
  }

  url.searchParams.delete("resource");

  try {
    let result;

    if (validation.type === "master") {
      if (operation === "GET") {
        const { data, error } = await supabaseAdmin
          .from(resource)
          .select("*");
        if (error) throw error;
        result = { data };
      } else if (operation === "POST") {
        const { data, error } = await supabaseAdmin
          .from(resource)
          .insert(body)
          .select();
        if (error) throw error;
        result = { data };
      } else if (operation === "PATCH") {
        const id = url.searchParams.get("id");
        if (!id) {
          return createErrorResponse(400, "Missing id parameter for PATCH");
        }
        const { data, error } = await supabaseAdmin
          .from(resource)
          .update(body)
          .eq("id", id)
          .select();
        if (error) throw error;
        result = { data };
      } else if (operation === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) {
          return createErrorResponse(400, "Missing id parameter for DELETE");
        }
        const { data, error } = await supabaseAdmin
          .from(resource)
          .delete()
          .eq("id", id);
        if (error) throw error;
        result = { data };
      }
    } else {
      if (operation === "GET") {
        const { data, error } = await supabaseAdmin
          .from(resource)
          .select("*")
          .eq("organization_id", validation.organizationId!);
        if (error) throw error;
        result = { data };
      } else if (operation === "POST") {
        const bodyWithOrg = {
          ...body,
          organization_id: validation.organizationId,
        };
        const { data, error } = await supabaseAdmin
          .from(resource)
          .insert(bodyWithOrg)
          .select();
        if (error) throw error;
        result = { data };
      } else if (operation === "PATCH") {
        const id = url.searchParams.get("id");
        if (!id) {
          return createErrorResponse(400, "Missing id parameter for PATCH");
        }
        const { data, error } = await supabaseAdmin
          .from(resource)
          .update(body)
          .eq("id", id)
          .eq("organization_id", validation.organizationId!)
          .select();
        if (error) throw error;
        result = { data };
      } else if (operation === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) {
          return createErrorResponse(400, "Missing id parameter for DELETE");
        }
        const { data, error } = await supabaseAdmin
          .from(resource)
          .delete()
          .eq("id", id)
          .eq("organization_id", validation.organizationId!);
        if (error) throw error;
        result = { data };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("API Gateway error:", error);
    return createErrorResponse(500, error.message);
  }
});
