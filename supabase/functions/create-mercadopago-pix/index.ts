import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") || "";

const MERCADOPAGO_ACCESS_TOKEN =
  Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

function response(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
}

function isValidUUID(
  value: string,
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizePlan(
  value: unknown,
): "pro" | "enterprise" {
  const plan = String(value || "")
    .trim()
    .toLowerCase();

  if (
    plan !== "pro" &&
    plan !== "enterprise"
  ) {
    throw new Error(
      "Plano inválido. Use pro ou enterprise.",
    );
  }

  return plan;
}

function getExpectedAmount(
  plan: "pro" | "enterprise",
): number {
  return plan === "pro"
    ? 39.9
    : 99.9;
}

function getExternalReferencePlan(
  value: string,
) {
  if (
    value.includes("_enterprise_")
  ) {
    return "enterprise" as const;
  }

  if (
    value.includes("_pro_")
  ) {
    return "pro" as const;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return response(
      {
        error:
          "Método não permitido.",
      },
      405,
    );
  }

  try {
    if (
      !MERCADOPAGO_ACCESS_TOKEN
    ) {
      return response(
        {
          error:
            "Mercado Pago não está configurado no servidor.",
        },
        500,
      );
    }

    /*
     * ==========================================================
     * AUTENTICAÇÃO
     * ==========================================================
     */

    const authorization =
      req.headers.get(
        "Authorization",
      );

    if (!authorization) {
      return response(
        {
          error:
            "Usuário não autenticado.",
        },
        401,
      );
    }

    const accessToken =
      authorization.replace(
        /^Bearer\s+/i,
        "",
      ).trim();

    if (!accessToken) {
      return response(
        {
          error:
            "Token de autenticação inválido.",
        },
        401,
      );
    }

    const userClient =
      createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );

    const {
      data: userData,
      error: userError,
    } =
      await userClient.auth.getUser(
        accessToken,
      );

    if (
      userError ||
      !userData?.user
    ) {
      return response(
        {
          error:
            "Sessão inválida ou expirada.",
        },
        401,
      );
    }

    const user =
      userData.user;

    /*
     * ==========================================================
     * BODY
     * ==========================================================
     */

    let body: Record<
      string,
      unknown
    >;

    try {
      body = await req.json();
    } catch {
      return response(
        {
          error:
            "Corpo da requisição inválido.",
        },
        400,
      );
    }

    const workspaceId =
      String(
        body.workspace_id || "",
      ).trim();

    const selectedPlan =
      normalizePlan(
        body.plan,
      );

    const payerEmail =
      String(
        body.email ||
          user.email ||
          "",
      )
        .trim()
        .toLowerCase();

    if (
      !workspaceId ||
      !isValidUUID(
        workspaceId,
      )
    ) {
      return response(
        {
          error:
            "workspace_id inválido.",
        },
        400,
      );
    }

    if (!payerEmail) {
      return response(
        {
          error:
            "Não foi possível identificar o e-mail do comprador.",
        },
        400,
      );
    }

    /*
     * ==========================================================
     * VALIDAR MEMBRO
     * ==========================================================
     */

    const {
      data: member,
      error: memberError,
    } =
      await supabase
        .from(
          "workspace_members",
        )
        .select(
          "user_id, workspace_id, role",
        )
        .eq(
          "user_id",
          user.id,
        )
        .eq(
          "workspace_id",
          workspaceId,
        )
        .maybeSingle();

    if (memberError) {
      console.error(
        "[create-mercadopago-pix] memberError:",
        memberError,
      );

      return response(
        {
          error:
            "Não foi possível verificar o workspace.",
        },
        500,
      );
    }

    if (!member) {
      return response(
        {
          error:
            "Você não possui acesso a este workspace.",
        },
        403,
      );
    }

    /*
     * ==========================================================
     * WORKSPACE
     * ==========================================================
     */

    const {
      data: workspace,
      error: workspaceError,
    } =
      await supabase
        .from("workspaces")
        .select(
          "id, plan, trial_used, trial_ends_at, currency",
        )
        .eq(
          "id",
          workspaceId,
        )
        .maybeSingle();

    if (workspaceError) {
      console.error(
        "[create-mercadopago-pix] workspaceError:",
        workspaceError,
      );

      return response(
        {
          error:
            "Não foi possível carregar o workspace.",
        },
        500,
      );
    }

    if (!workspace) {
      return response(
        {
          error:
            "Workspace não encontrado.",
        },
        404,
      );
    }

    /*
     * ==========================================================
     * O PIX DESTE ENDPOINT É PARA CONTRATAÇÃO DO PLANO.
     * O PLANO ATUAL PRECISA SER FREE.
     * ==========================================================
     */

    if (
      String(
        workspace.plan || "free",
      ).toLowerCase() !==
      "free"
    ) {
      return response(
        {
          error:
            "O workspace já possui um plano pago ativo.",
        },
        409,
      );
    }

    /*
     * ==========================================================
     * TRIAL:
     *
     * O PIX pode ser usado somente quando o trial terminou.
     * ==========================================================
     */

    if (
      workspace.trial_used !== true
    ) {
      return response(
        {
          error:
            "O período de teste gratuito ainda não foi utilizado.",
        },
        409,
      );
    }

    if (
      workspace.trial_ends_at &&
      new Date(
        workspace.trial_ends_at,
      ).getTime() >
        Date.now()
    ) {
      return response(
        {
          error:
            "O período de teste ainda está ativo.",
        },
        409,
      );
    }

    /*
     * ==========================================================
     * PLANO MERCADO PAGO
     * ==========================================================
     */

    const {
      data: planRow,
      error: planError,
    } =
      await supabase
        .from(
          "subscription_payment_plans",
        )
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
        .eq(
          "plan",
          selectedPlan,
        )
        .eq(
          "provider",
          "mercado_pago",
        )
        .eq(
          "currency",
          "BRL",
        )
        .eq(
          "billing_interval",
          "month",
        )
        .eq(
          "is_active",
          true,
        )
        .maybeSingle();

    if (planError) {
      console.error(
        "[create-mercadopago-pix] planError:",
        planError,
      );

      return response(
        {
          error:
            "Erro ao consultar o plano Mercado Pago.",
        },
        500,
      );
    }

    if (!planRow) {
      return response(
        {
          error:
            "Plano Mercado Pago não configurado.",
        },
        404,
      );
    }

    const expectedAmount =
      getExpectedAmount(
        selectedPlan,
      );

    const databaseAmount =
      Number(
        planRow.amount,
      );

    if (
      Math.abs(
        databaseAmount -
          expectedAmount,
      ) > 0.001
    ) {
      console.error(
        "[create-mercadopago-pix] Valor divergente:",
        {
          databaseAmount,
          expectedAmount,
        },
      );

      return response(
        {
          error:
            "O valor do plano no banco está divergente.",
        },
        500,
      );
    }

    /*
     * ==========================================================
     * REFERÊNCIA ÚNICA
     * ==========================================================
     */

    const externalReference =
      `stalmind_${workspaceId}_${selectedPlan}_${crypto.randomUUID()}`;

    const idempotencyKey =
      crypto.randomUUID();

    /*
     * ==========================================================
     * CRIAR PIX
     * ==========================================================
     */

    const mpResponse =
      await fetch(
        "https://api.mercadopago.com/v1/payments",
        {
          method: "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,

            "X-Idempotency-Key":
              idempotencyKey,
          },

          body: JSON.stringify({
            transaction_amount:
              expectedAmount,

            description:
              `StalMind ${selectedPlan.toUpperCase()} - pagamento do plano`,

            payment_method_id:
              "pix",

            external_reference:
              externalReference,

            payer: {
              email:
                payerEmail,
            },
          }),
        },
      );

    const mpData =
      await mpResponse.json();

    if (!mpResponse.ok) {
      console.error(
        "[create-mercadopago-pix] Mercado Pago error:",
        mpData,
      );

      return response(
        {
          error:
            "O Mercado Pago recusou a criação do PIX.",

          details:
            mpData?.message ||
            mpData?.error ||
            null,
        },
        502,
      );
    }

    /*
     * ==========================================================
     * DADOS PIX
     * ==========================================================
     */

    const transactionData =
      mpData
        ?.point_of_interaction
        ?.transaction_data;

    const qrCode =
      transactionData?.qr_code ||
      null;

    const qrCodeBase64 =
      transactionData?.qr_code_base64 ||
      null;

    const ticketUrl =
      transactionData?.ticket_url ||
      null;

    if (!qrCode) {
      return response(
        {
          error:
            "O Mercado Pago não retornou o QR Code PIX.",
        },
        502,
      );
    }

    /*
     * ==========================================================
     * REGISTRAR PAYMENT
     * ==========================================================
     */

    const notes =
      JSON.stringify({
        provider:
          "mercado_pago",

        provider_payment_id:
          String(
            mpData.id,
          ),

        external_reference:
          externalReference,

        plan:
          selectedPlan,

        currency:
          "BRL",

        payer_email:
          payerEmail,

        payment_type:
          "pix",

        billing:
          "one_time",

        created_at:
          new Date().toISOString(),
      });

    const {
      data: payment,
      error: paymentError,
    } =
      await supabase
        .from("payments")
        .insert({
          workspace_id:
            workspaceId,

          amount:
            expectedAmount,

          payment_method:
            "pix",

          status:
            "pending",

          payment_date:
            null,

          reference:
            String(
              mpData.id,
            ),

          notes,

          created_by:
            user.id,
        })
        .select(
          `
            id,
            workspace_id,
            amount,
            payment_method,
            status,
            reference,
            created_at
          `,
        )
        .single();

    if (paymentError) {
      console.error(
        "[create-mercadopago-pix] paymentError:",
        paymentError,
      );

      return response(
        {
          error:
            "PIX criado no Mercado Pago, mas não foi possível registrar o pagamento no StalMind.",

          mercadopago_payment_id:
            String(
              mpData.id,
            ),
        },
        500,
      );
    }

    /*
     * ==========================================================
     * RESPOSTA
     * ==========================================================
     */

    return response({
      success: true,

      payment: {
        id:
          payment.id,

        provider:
          "mercado_pago",

        provider_payment_id:
          String(
            mpData.id,
          ),

        status:
          mpData.status,

        status_detail:
          mpData.status_detail,

        amount:
          expectedAmount,

        currency:
          "BRL",

        plan:
          selectedPlan,
      },

      pix: {
        qr_code:
          qrCode,

        qr_code_base64:
          qrCodeBase64,

        ticket_url:
          ticketUrl,
      },
    });
  } catch (error) {
    console.error(
      "[create-mercadopago-pix] Unexpected error:",
      error,
    );

    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao criar PIX.",
      },
      500,
    );
  }
});