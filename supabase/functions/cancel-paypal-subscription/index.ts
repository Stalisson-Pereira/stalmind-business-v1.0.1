import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function paypalBaseUrl() {
  return (Deno.env.get("PAYPAL_MODE") || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal não está configurado no servidor.");

  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok || !data?.access_token) throw new Error("Não foi possível autenticar no PayPal.");
  return String(data.access_token);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase não está configurado no servidor.");

    const authorization = req.headers.get("Authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Usuário não autenticado." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "");
    const { data: authData, error: authError } = await anon.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

    const body = await req.json();
    const workspaceId = String(body?.workspace_id || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) {
      return json({ error: "workspace_id inválido." }, 400);
    }

    const { data: member, error: memberError } = await admin
      .from("workspace_members")
      .select("workspace_id, user_id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) return json({ error: "Você não possui acesso a este workspace." }, 403);

    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .select("id, workspace_id, plan, status, provider, provider_subscription_id")
      .eq("workspace_id", workspaceId)
      .eq("provider", "paypal")
      .not("provider_subscription_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription?.provider_subscription_id) {
      return json({ success: true, cancelled: false, message: "Nenhuma assinatura PayPal local encontrada." });
    }

    const paypalSubscriptionId = String(subscription.provider_subscription_id);
    const paypalToken = await getPayPalToken();

    const detailsResponse = await fetch(
      `${paypalBaseUrl()}/v1/billing/subscriptions/${encodeURIComponent(paypalSubscriptionId)}`,
      {
        headers: {
          Authorization: `Bearer ${paypalToken}`,
          Accept: "application/json",
        },
      },
    );
    const details = await detailsResponse.json();

    if (!detailsResponse.ok && detailsResponse.status !== 404) {
      console.error("[cancel-paypal-subscription] GET PayPal:", details);
      return json({ error: "Não foi possível consultar a assinatura PayPal.", details }, 502);
    }

    const remoteStatus = String(details?.status || "NOT_FOUND").toUpperCase();

    if (detailsResponse.ok && !["CANCELLED", "EXPIRED"].includes(remoteStatus)) {
      const cancelResponse = await fetch(
        `${paypalBaseUrl()}/v1/billing/subscriptions/${encodeURIComponent(paypalSubscriptionId)}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paypalToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            cancel_option: "IMMEDIATE",
          }),
        },
      );

      if (!cancelResponse.ok && cancelResponse.status !== 404) {
        const cancelData = await cancelResponse.json().catch(() => null);
        console.error("[cancel-paypal-subscription] Cancel PayPal:", cancelData);
        return json({ error: "O PayPal não permitiu cancelar a assinatura.", details: cancelData }, 502);
      }
    }

    const { error: localError } = await admin
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancel_at_period_end: false,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: "Cancelamento manual para reiniciar o fluxo de assinatura.",
        provider_subscription_id: null,
        provider_customer_id: null,
        provider_plan_id: null,
        provider_product_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (localError) throw localError;

    return json({
      success: true,
      cancelled: true,
      workspace_id: workspaceId,
      previous_subscription_id: paypalSubscriptionId,
      previous_remote_status: remoteStatus,
    });
  } catch (error) {
    console.error("[cancel-paypal-subscription] Error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno ao cancelar assinatura." }, 500);
  }
});
