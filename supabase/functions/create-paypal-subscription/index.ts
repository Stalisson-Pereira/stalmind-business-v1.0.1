import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Plan = "pro" | "enterprise";
type Currency = "BRL" | "EUR" | "USD";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBaseUrl(): string {
  return (
    Deno.env.get("APP_URL") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function getPayPalBaseUrl(): string {
  const mode = (Deno.env.get("PAYPAL_MODE") || "sandbox").toLowerCase();

  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isPlan(value: string): value is Plan {
  return value === "pro" || value === "enterprise";
}

function isCurrency(value: string): value is Currency {
  return value === "BRL" || value === "EUR" || value === "USD";
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal não está configurado corretamente no servidor.",
    );
  }

  const response = await fetch(
    `${getPayPalBaseUrl()}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    },
  );

  const data = await response.json();

  if (!response.ok || !data?.access_token) {
    console.error(
      "[create-paypal-subscription] PayPal OAuth error:",
      data,
    );

    throw new Error(
      "Não foi possível autenticar no PayPal.",
    );
  }

  return String(data.access_token);
}

async function cancelPayPalSubscription(
  accessToken: string,
  subscriptionId: string,
): Promise<void> {
  try {
    const response = await fetch(
      `${getPayPalBaseUrl()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          reason:
            "Falha ao registrar a assinatura no sistema StalMind.",
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();

      console.error(
        "[create-paypal-subscription] Falha ao cancelar assinatura órfã:",
        {
          status: response.status,
          body: text,
          subscriptionId,
        },
      );
    }
  } catch (error) {
    console.error(
      "[create-paypal-subscription] Erro ao cancelar assinatura órfã:",
      error,
    );
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        error: "Método não permitido.",
      },
      405,
    );
  }

  let paypalAccessToken: string | null = null;
  let remoteSubscriptionId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(
        {
          error:
            "Supabase não está configurado corretamente no servidor.",
        },
        500,
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return json(
        {
          error: "Usuário não autenticado.",
        },
        401,
      );
    }

    const token = authorization
      .replace(/^Bearer\s+/i, "")
      .trim();

    if (!token) {
      return json(
        {
          error: "Token de autenticação ausente.",
        },
        401,
      );
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const authClient = createClient(
      supabaseUrl,
      anonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: authData,
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !authData?.user) {
      return json(
        {
          error: "Sessão inválida ou expirada.",
        },
        401,
      );
    }

    const userId = authData.user.id;

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return json(
        {
          error: "Corpo da requisição inválido.",
        },
        400,
      );
    }

    const workspaceId = String(
      body?.workspace_id || "",
    ).trim();

    const planValue = String(
      body?.plan || "",
    )
      .trim()
      .toLowerCase();

    const currencyValue = String(
      body?.currency || "EUR",
    )
      .trim()
      .toUpperCase();

    if (!isValidUuid(workspaceId)) {
      return json(
        {
          error: "workspace_id inválido.",
        },
        400,
      );
    }

    if (!isPlan(planValue)) {
      return json(
        {
          error:
            "Plano inválido. Apenas Pro ou Enterprise podem ser contratados.",
        },
        400,
      );
    }

    if (!isCurrency(currencyValue)) {
      return json(
        {
          error:
            "Moeda não suportada pelo PayPal.",
        },
        400,
      );
    }

    const plan = planValue;
    const currency = currencyValue;

    /*
     * ============================================================
     * 1. VALIDAR MEMBRO DO WORKSPACE
     * ============================================================
     */

    const {
      data: member,
      error: memberError,
    } = await admin
      .from("workspace_members")
      .select(
        "user_id, workspace_id, role",
      )
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (memberError) {
      console.error(
        "[create-paypal-subscription] memberError:",
        memberError,
      );

      return json(
        {
          error:
            "Não foi possível validar o acesso ao workspace.",
        },
        500,
      );
    }

    if (!member) {
      return json(
        {
          error:
            "Você não possui acesso a este workspace.",
        },
        403,
      );
    }

    /*
     * ============================================================
     * 2. BUSCAR WORKSPACE
     * ============================================================
     */

    const {
      data: workspace,
      error: workspaceError,
    } = await admin
      .from("workspaces")
      .select(
        "id, plan, trial_used, trial_started_at, trial_ends_at, currency",
      )
      .eq("id", workspaceId)
      .maybeSingle();

    if (workspaceError) {
      console.error(
        "[create-paypal-subscription] workspaceError:",
        workspaceError,
      );

      return json(
        {
          error:
            "Não foi possível carregar o workspace.",
        },
        500,
      );
    }

    if (!workspace) {
      return json(
        {
          error: "Workspace não encontrado.",
        },
        404,
      );
    }

    /*
     * ============================================================
     * 3. VALIDAR ESTADO DO PLANO
     * ============================================================
     */

    const currentPlan = String(
      workspace.plan || "free",
    ).toLowerCase();

    if (currentPlan !== "free") {
      return json(
        {
          error:
            "O workspace já possui um plano pago ativo.",
        },
        409,
      );
    }

    /*
     * O usuário só pode chegar aqui depois de utilizar
     * o trial gratuito.
     */

    if (workspace.trial_used !== true) {
      return json(
        {
          error:
            "O período de teste gratuito ainda não foi utilizado.",
        },
        409,
      );
    }

    /*
     * O pagamento pós-trial só pode ser iniciado depois
     * do término do período de 14 dias.
     */

    if (
      workspace.trial_ends_at &&
      new Date(
        workspace.trial_ends_at,
      ).getTime() > Date.now()
    ) {
      return json(
        {
          error:
            "O período de teste ainda está ativo.",
        },
        409,
      );
    }

    /*
     * ============================================================
     * 4. BUSCAR PLANO PAYPAL
     * ============================================================
     */

    const {
      data: price,
      error: priceError,
    } = await admin
      .from("subscription_payment_plans")
      .select(
        `
          id,
          plan,
          provider,
          currency,
          amount,
          billing_interval,
          provider_product_id,
          provider_plan_id,
          is_active
        `,
      )
      .eq("plan", plan)
      .eq("provider", "paypal")
      .eq("currency", currency)
      .eq("billing_interval", "month")
      .eq("is_active", true)
      .maybeSingle();

    if (priceError) {
      console.error(
        "[create-paypal-subscription] priceError:",
        priceError,
      );

      return json(
        {
          error:
            "Não foi possível localizar a configuração do plano PayPal.",
        },
        500,
      );
    }

    if (!price?.provider_plan_id) {
      return json(
        {
          error:
            `O plano PayPal ${plan}/${currency} não está configurado.`,
        },
        409,
      );
    }

    /*
     * ============================================================
     * 5. EVITAR DUPLICAÇÃO
     * ============================================================
     */

    const {
      data: existingProviderSubscription,
      error:
        existingProviderSubscriptionError,
    } = await admin
      .from("subscriptions")
      .select(
        `
          id,
          plan,
          status,
          provider,
          provider_subscription_id,
          created_at
        `,
      )
      .eq("workspace_id", workspaceId)
      .eq("provider", "paypal")
      .not(
        "provider_subscription_id",
        "is",
        null,
      )
      .in(
        "status",
        [
          "trialing",
          "active",
          "past_due",
          "paused",
        ],
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (
      existingProviderSubscriptionError
    ) {
      console.error(
        "[create-paypal-subscription] existing subscription error:",
        existingProviderSubscriptionError,
      );

      return json(
        {
          error:
            "Não foi possível verificar assinaturas existentes.",
        },
        500,
      );
    }

    if (
      existingProviderSubscription
        ?.provider_subscription_id
    ) {
      return json(
        {
          error:
            "Já existe uma assinatura PayPal em processamento ou ativa para este workspace.",
          subscription_id:
            existingProviderSubscription.provider_subscription_id,
        },
        409,
      );
    }

    /*
     * ============================================================
     * 6. AUTENTICAR NO PAYPAL
     * ============================================================
     */

    paypalAccessToken =
      await getPayPalAccessToken();

    /*
     * ============================================================
     * 7. CRIAR ASSINATURA RECURRENTE
     * ============================================================
     */

    const returnUrl =
      `${getBaseUrl()}/plans?payment=success&provider=paypal`;

    const cancelUrl =
      `${getBaseUrl()}/plans?payment=cancelled&provider=paypal`;

    const paypalResponse = await fetch(
      `${getPayPalBaseUrl()}/v1/billing/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${paypalAccessToken}`,
          "Content-Type":
            "application/json",
          Accept: "application/json",
          Prefer:
            "return=representation",
        },
        body: JSON.stringify({
          plan_id:
            price.provider_plan_id,

          /*
           * O custom_id permite relacionar a assinatura
           * PayPal diretamente ao workspace.
           */
          custom_id: workspaceId,

          application_context: {
            brand_name:
              "StalMind Business OS",

            locale:
              currency === "BRL"
                ? "pt-BR"
                : "pt-PT",

            user_action:
              "SUBSCRIBE_NOW",

            shipping_preference:
              "NO_SHIPPING",

            return_url:
              returnUrl,

            cancel_url:
              cancelUrl,
          },
        }),
      },
    );

    let paypalData: any = null;

    try {
      paypalData =
        await paypalResponse.json();
    } catch {
      paypalData = null;
    }

    if (!paypalResponse.ok) {
      console.error(
        "[create-paypal-subscription] PayPal subscription error:",
        {
          status:
            paypalResponse.status,
          data: paypalData,
        },
      );

      return json(
        {
          error:
            "O PayPal recusou a criação da assinatura.",
          details:
            paypalData?.details || null,
        },
        502,
      );
    }

    remoteSubscriptionId =
      String(
        paypalData?.id || "",
      );

    const approvalUrl =
      Array.isArray(paypalData?.links)
        ? paypalData.links.find(
            (link: any) =>
              link?.rel === "approve",
          )?.href
        : null;

    if (
      !remoteSubscriptionId ||
      !approvalUrl
    ) {
      console.error(
        "[create-paypal-subscription] Resposta PayPal inválida:",
        paypalData,
      );

      return json(
        {
          error:
            "O PayPal não retornou uma assinatura válida ou um link de aprovação.",
        },
        502,
      );
    }

    /*
     * ============================================================
     * 8. REGISTRAR ASSINATURA LOCAL
     * ============================================================
     */

    const {
      data: latestSubscription,
      error:
        latestSubscriptionError,
    } = await admin
      .from("subscriptions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (latestSubscriptionError) {
      console.error(
        "[create-paypal-subscription] latestSubscriptionError:",
        latestSubscriptionError,
      );

      if (
        paypalAccessToken &&
        remoteSubscriptionId
      ) {
        await cancelPayPalSubscription(
          paypalAccessToken,
          remoteSubscriptionId,
        );
      }

      return json(
        {
          error:
            "A assinatura foi criada no PayPal, mas não foi possível preparar o registro local.",
        },
        500,
      );
    }

    const subscriptionValues = {
      plan,
      status: "trialing",
      trial_ends_at: null,
      current_period_start: null,
      current_period_end: null,
      provider: "paypal",
      provider_customer_id: null,
      provider_subscription_id:
        remoteSubscriptionId,
      provider_plan_id:
        price.provider_plan_id,
      provider_product_id:
        price.provider_product_id,
      cancel_at_period_end: false,
      cancelled_at: null,
      cancellation_reason: null,
      updated_at:
        new Date().toISOString(),
    };

    let subscriptionError: any =
      null;

    if (latestSubscription?.id) {
      const result =
        await admin
          .from("subscriptions")
          .update(subscriptionValues)
          .eq(
            "id",
            latestSubscription.id,
          );

      subscriptionError =
        result.error;
    } else {
      const result =
        await admin
          .from("subscriptions")
          .insert({
            workspace_id:
              workspaceId,
            ...subscriptionValues,
          });

      subscriptionError =
        result.error;
    }

    /*
     * ============================================================
     * 9. SE O REGISTRO LOCAL FALHAR, CANCELAR A ASSINATURA
     *    REMOTA PARA NÃO CRIAR ASSINATURA ÓRFÃ.
     * ============================================================
     */

    if (subscriptionError) {
      console.error(
        "[create-paypal-subscription] Local subscription error:",
        subscriptionError,
      );

      if (
        paypalAccessToken &&
        remoteSubscriptionId
      ) {
        await cancelPayPalSubscription(
          paypalAccessToken,
          remoteSubscriptionId,
        );
      }

      return json(
        {
          error:
            "Não foi possível registrar a assinatura local. A assinatura PayPal foi cancelada para evitar inconsistências.",
        },
        500,
      );
    }

    /*
     * ============================================================
     * 10. RETORNO
     * ============================================================
     */

    return json({
      success: true,
      provider: "paypal",
      subscription_id:
        remoteSubscriptionId,
      approval_url:
        approvalUrl,
      plan,
      currency,
      amount:
        Number(price.amount),
    });
  } catch (error) {
    console.error(
      "[create-paypal-subscription] Unexpected error:",
      error,
    );

    /*
     * Última proteção contra assinatura órfã.
     */
    if (
      paypalAccessToken &&
      remoteSubscriptionId
    ) {
      await cancelPayPalSubscription(
        paypalAccessToken,
        remoteSubscriptionId,
      );
    }

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao iniciar assinatura PayPal.",
      },
      500,
    );
  }
});