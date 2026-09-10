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

function baseUrl() {
  return (Deno.env.get("APP_URL") || "http://localhost:3000").replace(/\/$/, "");
}

function paypalBaseUrl() {
  return (Deno.env.get("PAYPAL_MODE") || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  if (!response.ok || !data?.access_token) {
    console.error("[create-paypal-subscription] OAuth:", data);
    throw new Error("Não foi possível autenticar no PayPal.");
  }
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
    const plan = String(body?.plan || "").trim().toLowerCase();
    const currency = String(body?.currency || "EUR").trim().toUpperCase();

    if (!validUuid(workspaceId)) return json({ error: "workspace_id inválido." }, 400);
    if (plan !== "pro" && plan !== "enterprise") return json({ error: "Plano inválido." }, 400);
    if (!["BRL", "EUR", "USD"].includes(currency)) return json({ error: "Moeda não suportada pelo PayPal." }, 400);

    const { data: member, error: memberError } = await admin
      .from("workspace_members")
      .select("user_id, workspace_id, role")
      .eq("user_id", authData.user.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) return json({ error: "Você não possui acesso a este workspace." }, 403);

    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .select("id, plan, trial_used, trial_ends_at, currency")
      .eq("id", workspaceId)
      .maybeSingle();
    if (workspaceError) throw workspaceError;
    if (!workspace) return json({ error: "Workspace não encontrado." }, 404);

    if (workspace.plan !== "free") {
      return json({ error: "O workspace já possui um plano pago ativo." }, 409);
    }
    if (workspace.trial_used !== true) {
      return json({ error: "O período de teste ainda não foi utilizado. Use primeiro os 14 dias grátis." }, 409);
    }
    if (workspace.trial_ends_at && new Date(workspace.trial_ends_at).getTime() > Date.now()) {
      return json({ error: "O período de teste ainda está ativo." }, 409);
    }

    const { data: price, error: priceError } = await admin
      .from("subscription_payment_plans")
      .select("id, plan, provider, currency, amount, billing_interval, provider_product_id, provider_plan_id, is_active")
      .eq("plan", plan)
      .eq("provider", "paypal")
      .eq("currency", currency)
      .eq("billing_interval", "month")
      .eq("is_active", true)
      .maybeSingle();
    if (priceError) throw priceError;
    if (!price?.provider_plan_id) {
      return json({ error: `Plano PayPal ${plan}/${currency} não está configurado.` }, 409);
    }

    const tokenPayPal = await getPayPalToken();
    const returnUrl = `${baseUrl()}/plans?payment=success&provider=paypal`;
    const cancelUrl = `${baseUrl()}/plans?payment=cancelled&provider=paypal`;

    const paypalResponse = await fetch(`${paypalBaseUrl()}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenPayPal}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        plan_id: price.provider_plan_id,
        custom_id: workspaceId,
        application_context: {
          brand_name: "StalMind Business OS",
          locale: currency === "BRL" ? "pt-BR" : "pt-PT",
          user_action: "SUBSCRIBE_NOW",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    const paypal = await paypalResponse.json();
    if (!paypalResponse.ok) {
      console.error("[create-paypal-subscription] PayPal create:", paypal);
      return json({ error: "O PayPal recusou a criação da assinatura.", details: paypal?.details || null }, 502);
    }

    const subscriptionId = String(paypal?.id || "");
    const approvalLink = Array.isArray(paypal?.links)
      ? paypal.links.find((link: any) => link?.rel === "approve")?.href
      : null;

    if (!subscriptionId || !approvalLink) {
      return json({ error: "O PayPal não retornou o link de aprovação da assinatura." }, 502);
    }

    const { data: existingSubscription } = await admin
      .from("subscriptions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const subscriptionValues = {
      plan,
      status: "trialing",
      trial_ends_at: null,
      current_period_start: null,
      current_period_end: null,
      provider: "paypal",
      provider_customer_id: null,
      provider_subscription_id: subscriptionId,
      provider_plan_id: price.provider_plan_id,
      provider_product_id: price.provider_product_id,
      cancel_at_period_end: false,
      cancelled_at: null,
      cancellation_reason: null,
      updated_at: new Date().toISOString(),
    };

    let subscriptionError = null;
    if (existingSubscription?.id) {
      const result = await admin
        .from("subscriptions")
        .update(subscriptionValues)
        .eq("id", existingSubscription.id);
      subscriptionError = result.error;
    } else {
      const result = await admin
        .from("subscriptions")
        .insert({ workspace_id: workspaceId, ...subscriptionValues });
      subscriptionError = result.error;
    }

    if (subscriptionError) {
      console.error("[create-paypal-subscription] Subscription local:", subscriptionError);
      return json({ error: "Assinatura PayPal criada, mas não foi possível registrar o estado local." }, 500);
    }

    // Registra a intenção de cobrança no ledger real de pagamentos.
    // O webhook do PayPal fará a transição para paid/cancelled conforme os eventos reais.
    const { error: paymentError } = await admin
      .from("payments")
      .insert({
        workspace_id: workspaceId,
        amount: Number(price.amount),
        payment_method: "paypal",
        status: "pending",
        payment_date: new Date().toISOString(),
        reference: `paypal_subscription:${subscriptionId}`,
        notes: `Assinatura PayPal ${plan}/${currency} — ${subscriptionId}`,
        created_by: authData.user.id,
      });

    if (paymentError) {
      console.error("[create-paypal-subscription] Payment local:", paymentError);
      // A subscription remota continua sob aprovação do cliente. Não ativamos o plano local.
      // O webhook continuará sendo a fonte de verdade para a ativação.
      return json({ error: "Assinatura criada, mas não foi possível registrar o pagamento local." }, 500);
    }

    return json({
      success: true,
      provider: "paypal",
      subscription_id: subscriptionId,
      approval_url: approvalLink,
      plan,
      currency,
      amount: Number(price.amount),
    });
  } catch (error) {
    console.error("[create-paypal-subscription] Error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno ao iniciar assinatura." }, 500);
  }
});
