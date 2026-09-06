import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get(
  "MERCADOPAGO_ACCESS_TOKEN",
);

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getPlanFromNotes(notes: unknown) {
  if (!notes) {
    return null;
  }

  try {
    const parsed =
      typeof notes === "string"
        ? JSON.parse(notes)
        : notes;

    if (
      parsed?.plan === "pro" ||
      parsed?.plan === "enterprise"
    ) {
      return parsed.plan;
    }
  } catch {
    // Ignora JSON inválido.
  }

  return null;
}

function getPlanFromExternalReference(
  externalReference: unknown,
) {
  const value = String(externalReference || "");

  if (value.includes("_enterprise_")) {
    return "enterprise" as const;
  }

  if (value.includes("_pro_")) {
    return "pro" as const;
  }

  return null;
}

function getLocalStatus(mpStatus: unknown):
  | "pending"
  | "paid"
  | "cancelled"
  | "overdue" {
  const status = String(mpStatus || "").toLowerCase();

  switch (status) {
    case "approved":
      return "paid";

    case "cancelled":
    case "rejected":
      return "cancelled";

    case "expired":
      return "overdue";

    default:
      return "pending";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    const body = await req.json();

    console.log(
      "[mercadopago-webhook] Evento:",
      JSON.stringify(body),
    );

    /*
     * =========================================================
     * TESTE MANUAL
     * =========================================================
     *
     * Permite testar o endpoint sem consultar o Mercado Pago.
     *
     * Exemplo:
     *
     * {
     *   "type": "payment",
     *   "action": "test",
     *   "data": {
     *     "id": "123456"
     *   }
     * }
     */

    if (body?.action === "test") {
      console.log(
        "[mercadopago-webhook] Teste manual recebido com sucesso.",
      );

      return json({
        received: true,
        test: true,
        message:
          "Webhook Mercado Pago funcionando corretamente.",
      });
    }

    /*
     * =========================================================
     * VALIDAR EVENTO
     * =========================================================
     */

    const eventType = body?.type;

    if (eventType !== "payment") {
      console.log(
        "[mercadopago-webhook] Evento ignorado:",
        eventType,
      );

      return json({
        received: true,
        ignored: true,
        reason: "Evento não é payment.",
      });
    }

    const paymentId = body?.data?.id;

    if (!paymentId) {
      console.error(
        "[mercadopago-webhook] Payment ID ausente.",
      );

      return json(
        {
          error: "Payment ID ausente.",
        },
        400,
      );
    }

    /*
     * =========================================================
     * ACCESS TOKEN
     * =========================================================
     */

    if (!MERCADOPAGO_ACCESS_TOKEN) {
      console.error(
        "[mercadopago-webhook] Access Token ausente.",
      );

      return json(
        {
          error:
            "Mercado Pago não configurado.",
        },
        500,
      );
    }

    /*
     * =========================================================
     * CONSULTAR PAGAMENTO NO MERCADO PAGO
     * =========================================================
     */

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
        String(paymentId),
      )}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization:
            `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        },
      },
    );

    const mpPayment = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error(
        "[mercadopago-webhook] Erro ao consultar pagamento:",
        mpPayment,
      );

      /*
       * Se o Mercado Pago mandou um ID inexistente,
       * não há nada para atualizar no StalMind.
       */
      if (mpResponse.status === 404) {
        return json({
          received: true,
          payment_found: false,
          mercadopago_payment_id: String(paymentId),
          reason:
            "Pagamento não encontrado no Mercado Pago.",
        });
      }

      return json(
        {
          error:
            "Não foi possível consultar o pagamento.",
          mercadopago_status:
            mpResponse.status,
        },
        502,
      );
    }

    console.log(
      "[mercadopago-webhook] Pagamento:",
      JSON.stringify(mpPayment),
    );

    /*
     * =========================================================
     * DADOS DO MERCADO PAGO
     * =========================================================
     */

    const providerId = String(mpPayment.id);

    const externalReference = String(
      mpPayment.external_reference || "",
    );

    /*
     * =========================================================
     * LOCALIZAR PAYMENT NO STALMIND
     * =========================================================
     */

    let payment = null;

    /*
     * Primeiro tentamos pelo ID do Mercado Pago.
     *
     * create-mercadopago-pix grava:
     *
     * reference = mpData.id
     */

    const {
      data: paymentByReference,
      error: paymentReferenceError,
    } = await supabase
      .from("payments")
      .select(
        "id, workspace_id, amount, status, notes, payment_method, reference",
      )
      .eq("reference", providerId)
      .eq("payment_method", "pix")
      .limit(1)
      .maybeSingle();

    if (paymentReferenceError) {
      console.error(
        "[mercadopago-webhook] Erro procurando payment por reference:",
        paymentReferenceError,
      );

      return json(
        {
          error:
            "Erro ao localizar pagamento.",
        },
        500,
      );
    }

    payment = paymentByReference;

    /*
     * =========================================================
     * FALLBACK PELO EXTERNAL_REFERENCE
     * =========================================================
     *
     * O external_reference tem este formato:
     *
     * stalmind_<workspace_id>_<plan>_<uuid>
     */

    if (!payment && externalReference) {
      const parts = externalReference.split("_");

      const workspaceId = parts[1] || null;

      if (workspaceId) {
        const {
          data: paymentByWorkspace,
          error: paymentWorkspaceError,
        } = await supabase
          .from("payments")
          .select(
            "id, workspace_id, amount, status, notes, payment_method, reference",
          )
          .eq(
            "workspace_id",
            workspaceId,
          )
          .eq(
            "payment_method",
            "pix",
          )
          .limit(20);

        if (paymentWorkspaceError) {
          console.error(
            "[mercadopago-webhook] Erro procurando payment por workspace:",
            paymentWorkspaceError,
          );

          return json(
            {
              error:
                "Erro ao localizar pagamento.",
            },
            500,
          );
        }

        /*
         * Preferimos o payment cujo reference
         * corresponda ao ID do Mercado Pago.
         *
         * Se não existir, usamos o mais recente.
         */
        payment =
          paymentByWorkspace?.find(
            (item) =>
              String(item.reference) ===
              providerId,
          ) ||
          paymentByWorkspace?.[0] ||
          null;
      }
    }

    if (!payment) {
      console.warn(
        "[mercadopago-webhook] Payment não encontrado:",
        {
          providerId,
          externalReference,
        },
      );

      /*
       * Retornamos 200 para impedir que o Mercado Pago
       * fique repetindo indefinidamente o evento.
       */
      return json({
        received: true,
        payment_found: false,
        mercadopago_payment_id:
          providerId,
        external_reference:
          externalReference || null,
      });
    }

    console.log(
      "[mercadopago-webhook] Payment encontrado:",
      JSON.stringify(payment),
    );

    /*
     * =========================================================
     * STATUS
     * =========================================================
     */

    const localStatus =
      getLocalStatus(mpPayment.status);

    /*
     * =========================================================
     * PRESERVAR NOTES EXISTENTES
     * =========================================================
     */

    let existingNotes: Record<
      string,
      unknown
    > = {};

    try {
      if (payment.notes) {
        const parsed =
          typeof payment.notes === "string"
            ? JSON.parse(payment.notes)
            : payment.notes;

        if (
          parsed &&
          typeof parsed === "object"
        ) {
          existingNotes = parsed;
        }
      }
    } catch {
      existingNotes = {};
    }

    const updatedNotes = {
      ...existingNotes,

      provider: "mercado_pago",

      provider_payment_id:
        mpPayment.id,

      external_reference:
        mpPayment.external_reference ||
        null,

      mp_status:
        mpPayment.status || null,

      mp_status_detail:
        mpPayment.status_detail || null,

      payer_email:
        mpPayment.payer?.email ||
        null,

      updated_at:
        new Date().toISOString(),
    };

    /*
     * =========================================================
     * ATUALIZAR PAYMENT
     * =========================================================
     */

    const {
      error: updatePaymentError,
    } = await supabase
      .from("payments")
      .update({
        status: localStatus,

        notes:
          JSON.stringify(updatedNotes),
      })
      .eq("id", payment.id);

    if (updatePaymentError) {
      console.error(
        "[mercadopago-webhook] Erro atualizando payment:",
        updatePaymentError,
      );

      return json(
        {
          error:
            "Erro ao atualizar pagamento.",
        },
        500,
      );
    }

    /*
     * =========================================================
     * PAGAMENTO NÃO APROVADO
     * =========================================================
     */

    if (localStatus !== "paid") {
      console.log(
        "[mercadopago-webhook] Pagamento ainda não aprovado:",
        {
          payment_id: payment.id,
          mercadopago_payment_id:
            providerId,
          status: localStatus,
          mp_status:
            mpPayment.status,
        },
      );

      return json({
        received: true,

        payment_id:
          payment.id,

        mercadopago_payment_id:
          providerId,

        status:
          localStatus,
      });
    }

    /*
     * =========================================================
     * DESCOBRIR PLANO
     * =========================================================
     */

    let selectedPlan =
      getPlanFromNotes(
        payment.notes,
      );

    if (!selectedPlan) {
      selectedPlan =
        getPlanFromExternalReference(
          externalReference,
        );
    }

    if (!selectedPlan) {
      console.error(
        "[mercadopago-webhook] Não foi possível identificar o plano.",
        {
          payment_id: payment.id,
          external_reference:
            externalReference,
        },
      );

      return json({
        received: true,

        payment_id:
          payment.id,

        mercadopago_payment_id:
          providerId,

        status: "paid",

        warning:
          "Pagamento aprovado, mas plano não identificado.",
      });
    }

    /*
     * =========================================================
     * ATIVAR SUBSCRIPTION
     * =========================================================
     */

    const workspaceId =
      payment.workspace_id;

    const now = new Date();

    const periodEnd =
      new Date(now);

    periodEnd.setMonth(
      periodEnd.getMonth() + 1,
    );

    const {
      data: existingSubscription,
      error:
        subscriptionSearchError,
    } = await supabase
      .from("subscriptions")
      .select("id")
      .eq(
        "workspace_id",
        workspaceId,
      )
      .maybeSingle();

    if (subscriptionSearchError) {
      console.error(
        "[mercadopago-webhook] Erro procurando subscription:",
        subscriptionSearchError,
      );

      return json(
        {
          error:
            "Erro procurando assinatura.",
        },
        500,
      );
    }

    /*
     * =========================================================
     * ATUALIZAR SUBSCRIPTION
     * =========================================================
     */

    if (existingSubscription) {
      const {
        error:
          subscriptionUpdateError,
      } = await supabase
        .from("subscriptions")
        .update({
          plan:
            selectedPlan,

          status:
            "active",

          current_period_start:
            now.toISOString(),

          current_period_end:
            periodEnd.toISOString(),

          provider:
            "mercado_pago",

          provider_customer_id:
            mpPayment.payer?.id
              ? String(
                  mpPayment.payer.id,
                )
              : null,

          provider_subscription_id:
            String(mpPayment.id),

          updated_at:
            now.toISOString(),
        })
        .eq(
          "id",
          existingSubscription.id,
        );

      if (subscriptionUpdateError) {
        console.error(
          "[mercadopago-webhook] Erro atualizando subscription:",
          subscriptionUpdateError,
        );

        return json(
          {
            error:
              "Erro atualizando assinatura.",
          },
          500,
        );
      }
    } else {
      /*
       * =======================================================
       * CRIAR SUBSCRIPTION
       * =======================================================
       */

      const {
        error:
          subscriptionInsertError,
      } = await supabase
        .from("subscriptions")
        .insert({
          workspace_id:
            workspaceId,

          plan:
            selectedPlan,

          status:
            "active",

          current_period_start:
            now.toISOString(),

          current_period_end:
            periodEnd.toISOString(),

          provider:
            "mercado_pago",

          provider_customer_id:
            mpPayment.payer?.id
              ? String(
                  mpPayment.payer.id,
                )
              : null,

          provider_subscription_id:
            String(mpPayment.id),
        });

      if (subscriptionInsertError) {
        console.error(
          "[mercadopago-webhook] Erro criando subscription:",
          subscriptionInsertError,
        );

        return json(
          {
            error:
              "Erro criando assinatura.",
          },
          500,
        );
      }
    }

    /*
     * =========================================================
     * ATUALIZAR WORKSPACE
     * =========================================================
     */

    const {
      error: workspaceUpdateError,
    } = await supabase
      .from("workspaces")
      .update({
        plan:
          selectedPlan,

        plan_billing:
          "monthly",

        trial_ends_at:
          null,
      })
      .eq(
        "id",
        workspaceId,
      );

    if (workspaceUpdateError) {
      console.error(
        "[mercadopago-webhook] Erro atualizando workspace:",
        workspaceUpdateError,
      );

      return json(
        {
          error:
            "Pagamento aprovado, mas não foi possível atualizar o workspace.",
        },
        500,
      );
    }

    /*
     * =========================================================
     * SUCESSO
     * =========================================================
     */

    console.log(
      "[mercadopago-webhook] Pagamento processado com sucesso:",
      {
        payment_id: payment.id,
        mercadopago_payment_id:
          providerId,
        workspace_id:
          workspaceId,
        plan:
          selectedPlan,
      },
    );

    return json({
      received: true,

      payment_id:
        payment.id,

      mercadopago_payment_id:
        providerId,

      status:
        "paid",

      plan:
        selectedPlan,

      workspace_id:
        workspaceId,
    });
  } catch (error) {
    console.error(
      "[mercadopago-webhook] Erro inesperado:",
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno.",
      },
      500,
    );
  }
});