import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MERCADOPAGO_ACCESS_TOKEN =
  Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";

const MERCADOPAGO_WEBHOOK_SECRET =
  Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") ?? "";

const admin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type":
    "application/json",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
    },
  );
}

function timingSafeEqual(
  a: string,
  b: string,
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const aBytes =
    new TextEncoder().encode(a);

  const bBytes =
    new TextEncoder().encode(b);

  let result = 0;

  for (
    let i = 0;
    i < aBytes.length;
    i++
  ) {
    result |=
      aBytes[i] ^ bBytes[i];
  }

  return result === 0;
}

async function hmacSha256(
  secret: string,
  message: string,
): Promise<string> {
  const encoder =
    new TextEncoder();

  const keyData =
    encoder.encode(secret);

  const cryptoKey =
    await crypto.subtle.importKey(
      "raw",
      keyData,
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(message),
    );

  return Array.from(
    new Uint8Array(signature),
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

async function validateSignature(
  req: Request,
  dataId: string,
): Promise<boolean> {
  if (!MERCADOPAGO_WEBHOOK_SECRET) {
    console.error(
      "[mercadopago-webhook] MERCADOPAGO_WEBHOOK_SECRET não configurado.",
    );

    return false;
  }

  const xSignature =
    req.headers.get(
      "x-signature",
    );

  const xRequestId =
    req.headers.get(
      "x-request-id",
    );

  if (!xSignature) {
    return false;
  }

  let ts = "";
  let v1 = "";

  for (
    const part of xSignature.split(",")
  ) {
    const [key, value] =
      part.split("=");

    if (key === "ts") {
      ts = value ?? "";
    }

    if (key === "v1") {
      v1 = value ?? "";
    }
  }

  if (!ts || !v1) {
    return false;
  }

  const manifest =
    `id:${dataId};request-id:${xRequestId ?? ""};ts:${ts};`;

  const generated =
    await hmacSha256(
      MERCADOPAGO_WEBHOOK_SECRET,
      manifest,
    );

  return timingSafeEqual(
    generated.toLowerCase(),
    v1.toLowerCase(),
  );
}

async function mercadoPagoGet(
  url: string,
) {
  const response =
    await fetch(url, {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type":
          "application/json",
      },
    });

  const text =
    await response.text();

  let data: any = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    throw new Error(
      String(
        data.message ??
          data.error ??
          "Mercado Pago retornou erro.",
      ),
    );
  }

  return data;
}

function normalizePlan(
  value: unknown,
): "pro" | "enterprise" | null {
  const plan =
    String(
      value ?? "",
    )
      .trim()
      .toLowerCase();

  if (
    plan === "pro" ||
    plan === "enterprise"
  ) {
    return plan;
  }

  return null;
}

function mapPaymentStatus(
  providerStatus: string,
): "pending" | "paid" | "overdue" | "cancelled" {
  const status =
    providerStatus
      .toLowerCase();

  if (
    status === "approved" ||
    status === "processed" ||
    status === "accredited"
  ) {
    return "paid";
  }

  if (
    status === "rejected" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "refunded"
  ) {
    return "cancelled";
  }

  if (
    status === "in_process" ||
    status === "pending" ||
    status === "waiting_for_gateway" ||
    status === "recycling"
  ) {
    return "pending";
  }

  return "pending";
}

function planFromText(
  ...values: unknown[]
): "pro" | "enterprise" | null {
  for (
    const value of values
  ) {
    const plan =
      normalizePlan(value);

    if (plan) {
      return plan;
    }

    const text =
      String(
        value ?? "",
      ).toLowerCase();

    if (
      text.includes("enterprise")
    ) {
      return "enterprise";
    }

    if (
      text.includes("pro")
    ) {
      return "pro";
    }
  }

  return null;
}

async function findSubscriptionByProviderId(
  providerSubscriptionId: string,
) {
  const {
    data,
    error,
  } = await admin
    .from("subscriptions")
    .select(
      `
        id,
        workspace_id,
        plan,
        status,
        trial_ends_at,
        current_period_start,
        current_period_end,
        provider,
        provider_customer_id,
        provider_subscription_id,
        provider_plan_id,
        provider_product_id,
        cancel_at_period_end,
        cancelled_at,
        cancellation_reason,
        created_at,
        updated_at
      `,
    )
    .eq(
      "provider",
      "mercado_pago",
    )
    .eq(
      "provider_subscription_id",
      providerSubscriptionId,
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Erro ao buscar assinatura: ${error.message}`,
    );
  }

  return data;
}

async function activateWorkspaceSubscription(
  subscription: any,
  providerSubscription: any,
) {
  const workspaceId =
    subscription.workspace_id;

  const plan =
    planFromText(
      subscription.plan,
      providerSubscription.reason,
      providerSubscription.external_reference,
    );

  if (!plan) {
    throw new Error(
      "Não foi possível identificar o plano da assinatura Mercado Pago.",
    );
  }

  const now =
    new Date().toISOString();

  const currentPeriodStart =
    providerSubscription?.auto_recurring
      ?.start_date ??
    providerSubscription?.date_created ??
    subscription.current_period_start ??
    now;

  const currentPeriodEnd =
    providerSubscription?.auto_recurring
      ?.end_date ??
    subscription.current_period_end ??
    null;

  await admin
    .from("subscriptions")
    .update({
      plan,
      status: "active",
      current_period_start:
        currentPeriodStart,
      current_period_end:
        currentPeriodEnd,
      provider:
        "mercado_pago",
      provider_subscription_id:
        String(
          providerSubscription.id ??
            subscription.provider_subscription_id,
        ),
      provider_plan_id:
        providerSubscription.preapproval_plan_id ??
        subscription.provider_plan_id ??
        null,
      cancel_at_period_end:
        String(
          providerSubscription.status ??
            "",
        ).toLowerCase() ===
        "canceled",
      cancelled_at:
        String(
          providerSubscription.status ??
            "",
        ).toLowerCase() ===
        "canceled"
          ? now
          : null,
      updated_at: now,
    })
    .eq(
      "id",
      subscription.id,
    );

  await admin
    .from("workspaces")
    .update({
      plan,
      plan_billing: "monthly",
      updated_at: now,
    })
    .eq(
      "id",
      workspaceId,
    );

  return plan;
}

async function handleSubscriptionPreapproval(
  subscriptionId: string,
) {
  const providerSubscription =
    await mercadoPagoGet(
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(
        subscriptionId,
      )}`,
    );

  const localSubscription =
    await findSubscriptionByProviderId(
      subscriptionId,
    );

  if (!localSubscription) {
    console.warn(
      "[mercadopago-webhook] Assinatura local não encontrada:",
      subscriptionId,
    );

    return {
      handled: true,
      local_subscription_found: false,
      provider_status:
        providerSubscription.status ??
        null,
    };
  }

  const providerStatus =
    String(
      providerSubscription.status ??
        "",
    ).toLowerCase();

  const now =
    new Date().toISOString();

  /*
   * ============================================================
   * ASSINATURA CANCELADA
   * ============================================================
   */

  if (
    providerStatus === "canceled" ||
    providerStatus === "cancelled"
  ) {
    const periodEnd =
      localSubscription.current_period_end
        ? new Date(
            localSubscription.current_period_end,
          )
        : null;

    const periodStillActive =
      periodEnd &&
      !Number.isNaN(
        periodEnd.getTime(),
      ) &&
      periodEnd.getTime() >
        Date.now();

    await admin
      .from("subscriptions")
      .update({
        status:
          periodStillActive
            ? "active"
            : "cancelled",
        cancel_at_period_end:
          Boolean(
            periodStillActive,
          ),
        cancelled_at:
          now,
        cancellation_reason:
          "Assinatura cancelada no Mercado Pago.",
        updated_at: now,
      })
      .eq(
        "id",
        localSubscription.id,
      );

    if (!periodStillActive) {
      await admin
        .from("workspaces")
        .update({
          plan: "free",
          plan_billing: "monthly",
          updated_at: now,
        })
        .eq(
          "id",
          localSubscription.workspace_id,
        );
    }

    return {
      handled: true,
      status: "cancelled",
      workspace_plan:
        periodStillActive
          ? localSubscription.plan
          : "free",
    };
  }

  /*
   * ============================================================
   * ASSINATURA ATIVA/AUTORIZADA
   * ============================================================
   */

  if (
    providerStatus === "authorized" ||
    providerStatus === "active"
  ) {
    const plan =
      await activateWorkspaceSubscription(
        localSubscription,
        providerSubscription,
      );

    return {
      handled: true,
      status: providerStatus,
      plan,
    };
  }

  /*
   * ============================================================
   * ASSINATURA PENDENTE
   * ============================================================
   */

  if (
    providerStatus === "pending"
  ) {
    await admin
      .from("subscriptions")
      .update({
        status: "trialing",
        updated_at: now,
      })
      .eq(
        "id",
        localSubscription.id,
      );

    return {
      handled: true,
      status: "pending",
    };
  }

  return {
    handled: true,
    status: providerStatus,
  };
}

async function handlePayment(
  paymentId: string,
) {
  const payment =
    await mercadoPagoGet(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
        paymentId,
      )}`,
    );

  const providerStatus =
    String(
      payment.status ??
        "",
    ).toLowerCase();

  const mappedStatus =
    mapPaymentStatus(
      providerStatus,
    );

  const externalReference =
    String(
      payment.external_reference ??
        "",
    );

  const metadata =
    payment.metadata ??
    {};

  const plan =
    planFromText(
      metadata.plan,
      externalReference,
      payment.description,
    );

  /*
   * ============================================================
   * LOCAL PAYMENT
   * ============================================================
   */

  const reference =
    `mercadopago_payment:${payment.id}`;

  const {
    data: existingPayment,
  } = await admin
    .from("payments")
    .select(
      "id, workspace_id, amount, status, reference, notes",
    )
    .eq(
      "reference",
      reference,
    )
    .maybeSingle();

  let workspaceId =
    existingPayment?.workspace_id ??
    null;

  /*
   * ============================================================
   * SE NÃO ACHOU PELO PAYMENT ID,
   * PROCURAR PELA REFERÊNCIA
   * ============================================================
   */

  if (!workspaceId) {
    const {
      data: paymentByExternalReference,
    } = await admin
      .from("payments")
      .select(
        "id, workspace_id, amount, status, reference, notes",
      )
      .or(
        `reference.eq.${externalReference},notes.ilike.%${externalReference}%`,
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    workspaceId =
      paymentByExternalReference?.workspace_id ??
      null;
  }

  /*
   * ============================================================
   * PAGAMENTO DE ASSINATURA
   * ============================================================
   */

  const preapprovalId =
    String(
      payment.preapproval_id ??
        payment.metadata?.preapproval_id ??
        "",
    ).trim();

  let subscription = null;

  if (preapprovalId) {
    subscription =
      await findSubscriptionByProviderId(
        preapprovalId,
      );

    if (
      subscription &&
      !workspaceId
    ) {
      workspaceId =
        subscription.workspace_id;
    }
  }

  /*
   * ============================================================
   * IDENTIFICAR WORKSPACE PELO EXTERNAL_REFERENCE
   * ============================================================
   */

  if (
    !workspaceId &&
    externalReference
  ) {
    const match =
      externalReference.match(
        /workspace[_:-]([0-9a-f-]{36})/i,
      );

    if (match?.[1]) {
      workspaceId =
        match[1];
    }
  }

  /*
   * ============================================================
   * SALVAR/ATUALIZAR PAYMENT
   * ============================================================
   */

  const amount =
    Number(
      payment.transaction_amount ??
        payment.transaction_details
          ?.total_paid_amount ??
        0,
    );

  const paymentDate =
    payment.date_approved ??
    payment.date_last_updated ??
    payment.date_created ??
    new Date().toISOString();

  const notesPayload = {
    provider:
      "mercado_pago",
    payment_id:
      String(payment.id),
    payment_type:
      preapprovalId
        ? "subscription"
        : "pix",
    billing:
      preapprovalId
        ? "recurring"
        : "one_time",
    plan:
      plan ??
      null,
    external_reference:
      externalReference ||
      null,
    preapproval_id:
      preapprovalId ||
      null,
    currency:
      payment.currency_id ??
      "BRL",
    status:
      providerStatus,
    status_detail:
      payment.status_detail ??
      null,
    description:
      payment.description ??
      null,
  };

  if (existingPayment?.id) {
    await admin
      .from("payments")
      .update({
        amount:
          amount > 0
            ? amount
            : existingPayment.amount,
        status:
          mappedStatus,
        payment_date:
          paymentDate,
        reference,
        notes:
          JSON.stringify(
            notesPayload,
          ),
      })
      .eq(
        "id",
        existingPayment.id,
      );
  } else if (workspaceId) {
    await admin
      .from("payments")
      .insert({
        workspace_id:
          workspaceId,
        amount,
        payment_method:
          "pix",
        status:
          mappedStatus,
        payment_date:
          paymentDate,
        reference,
        notes:
          JSON.stringify(
            notesPayload,
          ),
      });
  }

  /*
   * ============================================================
   * ASSINATURA
   * ============================================================
   */

  if (
    subscription &&
    plan
  ) {
    const now =
      new Date().toISOString();

    if (
      mappedStatus === "paid"
    ) {
      await admin
        .from("subscriptions")
        .update({
          plan,
          status: "active",
          current_period_start:
            subscription.current_period_start ??
            now,
          updated_at: now,
        })
        .eq(
          "id",
          subscription.id,
        );

      await admin
        .from("workspaces")
        .update({
          plan,
          plan_billing: "monthly",
          updated_at: now,
        })
        .eq(
          "id",
          subscription.workspace_id,
        );
    }

    if (
      mappedStatus === "pending"
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "past_due",
          updated_at: now,
        })
        .eq(
          "id",
          subscription.id,
        );
    }

    if (
      mappedStatus ===
        "cancelled"
    ) {
      await admin
        .from("subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: now,
          cancellation_reason:
            "Pagamento Mercado Pago cancelado.",
          updated_at: now,
        })
        .eq(
          "id",
          subscription.id,
        );
    }
  }

  return {
    handled: true,
    payment_id:
      String(payment.id),
    payment_status:
      providerStatus,
    local_status:
      mappedStatus,
    workspace_id:
      workspaceId,
    subscription_id:
      preapprovalId ||
      null,
  };
}

async function handleAuthorizedPayment(
  authorizedPaymentId: string,
) {
  const invoice =
    await mercadoPagoGet(
      `https://api.mercadopago.com/authorized_payments/${encodeURIComponent(
        authorizedPaymentId,
      )}`,
    );

  const paymentId =
    String(
      invoice?.payment?.id ??
        "",
    ).trim();

  if (paymentId) {
    return await handlePayment(
      paymentId,
    );
  }

  const preapprovalId =
    String(
      invoice.preapproval_id ??
        "",
    ).trim();

  if (preapprovalId) {
    return await handleSubscriptionPreapproval(
      preapprovalId,
    );
  }

  return {
    handled: true,
    invoice_id:
      authorizedPaymentId,
    message:
      "Fatura recebida sem payment_id/preapproval_id.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Método não permitido.",
      },
      405,
    );
  }

  try {
    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error(
        "Configuração do Supabase incompleta.",
      );
    }

    if (
      !MERCADOPAGO_ACCESS_TOKEN
    ) {
      throw new Error(
        "MERCADOPAGO_ACCESS_TOKEN não configurado.",
      );
    }

    if (
      !MERCADOPAGO_WEBHOOK_SECRET
    ) {
      throw new Error(
        "MERCADOPAGO_WEBHOOK_SECRET não configurado.",
      );
    }

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const type =
      String(
        body.type ??
          body.topic ??
          "",
      ).toLowerCase();

    const action =
      String(
        body.action ??
          "",
      ).toLowerCase();

    const dataId =
      String(
        body?.data?.id ??
          body?.id ??
          "",
      ).trim();

    /*
     * O Mercado Pago envia o x-signature
     * e o ID do recurso em data.id.
     */

    if (!dataId) {
      return jsonResponse({
        success: true,
        ignored: true,
        reason:
          "Notificação sem data.id.",
      });
    }

    const signatureValid =
      await validateSignature(
        req,
        dataId,
      );

    if (!signatureValid) {
      return jsonResponse(
        {
          success: false,
          error:
            "Assinatura do webhook inválida.",
        },
        401,
      );
    }

    console.log(
      "[mercadopago-webhook]",
      {
        type,
        action,
        dataId,
      },
    );

    /*
     * ============================================================
     * PAYMENT
     * ============================================================
     */

    if (
      type === "payment" ||
      type === "payments"
    ) {
      const result =
        await handlePayment(
          dataId,
        );

      return jsonResponse({
        success: true,
        type,
        ...result,
      });
    }

    /*
     * ============================================================
     * SUBSCRIPTION PREAPPROVAL
     * ============================================================
     */

    if (
      type ===
        "subscription_preapproval" ||
      type ===
        "subscription_preapproval_plan"
    ) {
      const result =
        await handleSubscriptionPreapproval(
          dataId,
        );

      return jsonResponse({
        success: true,
        type,
        ...result,
      });
    }

    /*
     * ============================================================
     * AUTHORIZED PAYMENT
     * ============================================================
     */

    if (
      type ===
        "subscription_authorized_payment"
    ) {
      const result =
        await handleAuthorizedPayment(
          dataId,
        );

      return jsonResponse({
        success: true,
        type,
        ...result,
      });
    }

    /*
     * ============================================================
     * EVENTO NÃO UTILIZADO
     * ============================================================
     */

    return jsonResponse({
      success: true,
      ignored: true,
      type,
      action,
      data_id: dataId,
    });
  } catch (error) {
    console.error(
      "[mercadopago-webhook] ERRO:",
      error,
    );

    /*
     * Retornamos 200 para evitar que um
     * evento malformado provoque uma cadeia
     * infinita de retries enquanto o problema
     * é analisado.
     */

    return jsonResponse({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro interno.",
    });
  }
});