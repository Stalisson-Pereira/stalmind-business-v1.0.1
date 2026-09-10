import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
)!;

const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get(
  "MERCADOPAGO_ACCESS_TOKEN"
);

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

function response(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

function normalizePlan(
  value: unknown
): "pro" | "enterprise" {
  const plan = String(value || "")
    .trim()
    .toLowerCase();

  if (plan !== "pro" && plan !== "enterprise") {
    throw new Error(
      "Plano inválido. Use pro ou enterprise."
    );
  }

  return plan;
}

function getExpectedAmount(
  plan: "pro" | "enterprise"
) {
  if (plan === "pro") {
    return 39.90;
  }

  return 99.90;
}

function isValidUUID(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
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
        error: "Método não permitido.",
      },
      405
    );
  }

  try {
    if (!MERCADOPAGO_ACCESS_TOKEN) {
      console.error(
        "[create-mercadopago-pix] MERCADOPAGO_ACCESS_TOKEN não configurado."
      );

      return response(
        {
          error:
            "Mercado Pago não está configurado no servidor.",
        },
        500
      );
    }

    // ========================================================
    // AUTENTICAÇÃO
    // ========================================================

    const authorization =
      req.headers.get("Authorization");

    if (!authorization) {
      return response(
        {
          error: "Usuário não autenticado.",
        },
        401
      );
    }

    const accessToken =
      authorization.replace(
        /^Bearer\s+/i,
        ""
      );

    if (!accessToken) {
      return response(
        {
          error: "Token de autenticação inválido.",
        },
        401
      );
    }

    const userClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY") || ""
    );

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await userClient.auth.getUser(
        accessToken
      );

    if (
      userError ||
      !user
    ) {
      return response(
        {
          error:
            "Sessão inválida ou expirada.",
        },
        401
      );
    }

    // ========================================================
    // BODY
    // ========================================================

    const body = await req.json();

    const workspaceId =
      String(
        body.workspace_id || ""
      ).trim();

    const selectedPlan =
      normalizePlan(
        body.plan
      );

    const payerEmail =
      String(
        body.email ||
          user.email ||
          ""
      )
        .trim()
        .toLowerCase();

    if (
      !workspaceId ||
      !isValidUUID(workspaceId)
    ) {
      return response(
        {
          error:
            "workspace_id inválido.",
        },
        400
      );
    }

    if (!payerEmail) {
      return response(
        {
          error:
            "Não foi possível identificar o e-mail do comprador.",
        },
        400
      );
    }

    // ========================================================
    // VERIFICAR MEMBRO DO WORKSPACE
    // ========================================================

    const {
      data: member,
      error: memberError,
    } =
      await supabase
        .from("workspace_members")
        .select(
          "user_id, workspace_id, role"
        )
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "workspace_id",
          workspaceId
        )
        .maybeSingle();

    if (memberError) {
      console.error(
        "[create-mercadopago-pix] Erro workspace_members:",
        memberError
      );

      return response(
        {
          error:
            "Não foi possível verificar o workspace.",
        },
        500
      );
    }

    if (!member) {
      return response(
        {
          error:
            "Você não possui acesso a este workspace.",
        },
        403
      );
    }

    // ========================================================
    // BUSCAR PLANO NO BANCO
    // ========================================================

    const {
      data: planRow,
      error: planError,
    } =
      await supabase
        .from(
          "subscription_payment_plans"
        )
        .select(
          "id, plan, provider, currency, amount, billing_interval"
        )
        .eq(
          "plan",
          selectedPlan
        )
        .eq(
          "provider",
          "mercado_pago"
        )
        .eq(
          "currency",
          "BRL"
        )
        .eq(
          "billing_interval",
          "month"
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

    if (planError) {
      console.error(
        "[create-mercadopago-pix] Erro plano:",
        planError
      );

      return response(
        {
          error:
            "Erro ao consultar o plano.",
        },
        500
      );
    }

    if (!planRow) {
      return response(
        {
          error:
            "Plano Mercado Pago não configurado.",
        },
        404
      );
    }

    const expectedAmount =
      getExpectedAmount(
        selectedPlan
      );

    const databaseAmount =
      Number(
        planRow.amount
      );

    if (
      databaseAmount !==
      expectedAmount
    ) {
      console.error(
        "[create-mercadopago-pix] Valor divergente:",
        {
          databaseAmount,
          expectedAmount,
        }
      );

      return response(
        {
          error:
            "O valor do plano no banco está divergente da configuração.",
        },
        500
      );
    }

    // ========================================================
    // REFERÊNCIA ÚNICA
    // ========================================================

    const externalReference =
      `stalmind_${workspaceId}_${selectedPlan}_${crypto.randomUUID()}`;

    const idempotencyKey =
      crypto.randomUUID();

    // ========================================================
    // CRIAR PAGAMENTO MERCADO PAGO
    // ========================================================

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
              `StalMind ${selectedPlan.toUpperCase()} - assinatura mensal`,

            payment_method_id:
              "pix",

            external_reference:
              externalReference,

            payer: {
              email:
                payerEmail,
            },
          }),
        }
      );

    const mpData =
      await mpResponse.json();

    if (!mpResponse.ok) {
      console.error(
        "[create-mercadopago-pix] Mercado Pago:",
        mpData
      );

      return response(
        {
          error:
            "O Mercado Pago recusou a criação do pagamento.",
          details:
            mpData?.message ||
            mpData?.error ||
            null,
        },
        502
      );
    }

    // ========================================================
    // PIX
    // ========================================================

    const transactionDetails =
      mpData?.point_of_interaction
        ?.transaction_data;

    const qrCode =
      transactionDetails?.qr_code ||
      null;

    const qrCodeBase64 =
      transactionDetails?.qr_code_base64 ||
      null;

    const ticketUrl =
      transactionDetails?.ticket_url ||
      null;

    if (!qrCode) {
      console.error(
        "[create-mercadopago-pix] Mercado Pago não retornou QR Code:",
        mpData
      );

      return response(
        {
          error:
            "O Mercado Pago não retornou os dados do PIX.",
        },
        502
      );
    }

    // ========================================================
    // REGISTRAR PAGAMENTO PENDENTE
    // ========================================================

    let payment: any = null;
    let paymentError: any = null;

    const paymentPayload = {
      workspace_id: workspaceId,
      amount: expectedAmount,
      payment_method: "pix",
      status: "pending",
      payment_date: new Date().toISOString(),
      reference: String(mpData.id),
      notes: JSON.stringify({
        provider: "mercado_pago",
        provider_payment_id: mpData.id,
        external_reference: externalReference,
        plan: selectedPlan,
        currency: "BRL",
        payer_email: payerEmail,
      }),
    };

    // Primeiro tentamos o registro completo. created_by é opcional no banco,
    // então não o enviamos: isso evita falhas de FK/permissão desnecessárias.
    const firstInsert = await supabase
      .from("payments")
      .insert({ ...paymentPayload, created_by: user.id })
      .select("id, workspace_id, amount, payment_method, status, reference, created_at")
      .single();

    payment = firstInsert.data;
    paymentError = firstInsert.error;

    // Fallback: se created_by ou algum trigger legado causar erro, tenta
    // registrar o mesmo pagamento sem created_by. O pagamento do Mercado Pago
    // já existe e não deve ser perdido por uma falha de ledger local.
    if (paymentError) {
      console.warn(
        "[create-mercadopago-pix] Primeiro registro local falhou; tentando fallback:",
        paymentError
      );

      const fallbackInsert = await supabase
        .from("payments")
        .insert(paymentPayload)
        .select("id, workspace_id, amount, payment_method, status, reference, created_at")
        .single();

      payment = fallbackInsert.data;
      paymentError = fallbackInsert.error;
    }

    // Mesmo que o ledger local falhe, devolvemos o QR/PIX criado pelo Mercado
    // Pago. O webhook também consegue reconstruir o registro quando o cliente
    // pagar, usando external_reference + payment ID.
    if (paymentError) {
      console.error(
        "[create-mercadopago-pix] Registro local falhou após fallback:",
        paymentError
      );
    }

    // ========================================================
    // RESPOSTA
    // ========================================================

    return response({
      success: true,

      payment: {
        id:
          payment?.id || null,

        provider:
          "mercado_pago",

        provider_payment_id:
          mpData.id,

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

      local_payment_registered: Boolean(payment?.id),

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
      "[create-mercadopago-pix] Erro inesperado:",
      error
    );

    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao criar PIX.",
      },
      500
    );
  }
});