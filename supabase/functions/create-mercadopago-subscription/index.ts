import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
        "POST, OPTIONS",
};

const SUPABASE_URL =
    Deno.env.get("SUPABASE_URL")!;

const SERVICE_ROLE_KEY =
    Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
    )!;

const ANON_KEY =
    Deno.env.get(
        "SUPABASE_ANON_KEY",
    ) || "";

const MERCADOPAGO_ACCESS_TOKEN =
    Deno.env.get(
        "MERCADOPAGO_ACCESS_TOKEN",
    );

const APP_URL =
    (
        Deno.env.get(
            "APP_URL",
        ) ||
        "http://localhost:3000"
    ).replace(/\/$/, "");

const supabase =
    createClient(
        SUPABASE_URL,
        SERVICE_ROLE_KEY,
    );

function json(
    body: unknown,
    status = 200,
) {
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

function isValidUuid(
    value: string,
) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
    );
}

function normalizePlan(
    value: unknown,
):
    | "pro"
    | "enterprise" {
    const plan =
        String(value || "")
            .trim()
            .toLowerCase();

    if (
        plan !== "pro" &&
        plan !== "enterprise"
    ) {
        throw new Error(
            "Plano inválido.",
        );
    }

    return plan;
}

function getAmount(
    plan:
        | "pro"
        | "enterprise",
) {
    return plan === "pro"
        ? 39.9
        : 99.9;
}

Deno.serve(
    async (req) => {
        if (
            req.method ===
            "OPTIONS"
        ) {
            return new Response(
                "ok",
                {
                    headers:
                        corsHeaders,
                },
            );
        }

        if (
            req.method !==
            "POST"
        ) {
            return json(
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
                return json(
                    {
                        error:
                            "Mercado Pago não configurado.",
                    },
                    500,
                );
            }

            /*
             * ========================================================
             * AUTH
             * ========================================================
             */

            const authorization =
                req.headers.get(
                    "Authorization",
                );

            if (!authorization) {
                return json(
                    {
                        error:
                            "Usuário não autenticado.",
                    },
                    401,
                );
            }

            const token =
                authorization
                    .replace(
                        /^Bearer\s+/i,
                        "",
                    )
                    .trim();

            const authClient =
                createClient(
                    SUPABASE_URL,
                    ANON_KEY,
                    {
                        auth: {
                            autoRefreshToken:
                                false,
                            persistSession:
                                false,
                        },
                    },
                );

            const {
                data: authData,
                error: authError,
            } =
                await authClient.auth.getUser(
                    token,
                );

            if (
                authError ||
                !authData?.user
            ) {
                return json(
                    {
                        error:
                            "Sessão inválida ou expirada.",
                    },
                    401,
                );
            }

            const user =
                authData.user;

            /*
             * ========================================================
             * BODY
             * ========================================================
             */

            const body =
                await req.json();

            const workspaceId =
                String(
                    body.workspace_id ||
                    "",
                ).trim();

            const plan =
                normalizePlan(
                    body.plan,
                );

            const email =
                String(
                    body.email ||
                    user.email ||
                    "",
                )
                    .trim()
                    .toLowerCase();

            if (
                !isValidUuid(
                    workspaceId,
                )
            ) {
                return json(
                    {
                        error:
                            "workspace_id inválido.",
                    },
                    400,
                );
            }

            if (!email) {
                return json(
                    {
                        error:
                            "E-mail do comprador não informado.",
                    },
                    400,
                );
            }

            /*
             * ========================================================
             * MEMBER
             * ========================================================
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

            if (
                memberError
            ) {
                return json(
                    {
                        error:
                            "Erro verificando workspace.",
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
             * ========================================================
             * WORKSPACE
             * ========================================================
             */

            const {
                data: workspace,
                error:
                workspaceError,
            } =
                await supabase
                    .from(
                        "workspaces",
                    )
                    .select(
                        "id, plan, trial_used, trial_ends_at",
                    )
                    .eq(
                        "id",
                        workspaceId,
                    )
                    .maybeSingle();

            if (
                workspaceError
            ) {
                return json(
                    {
                        error:
                            "Erro carregando workspace.",
                    },
                    500,
                );
            }

            if (!workspace) {
                return json(
                    {
                        error:
                            "Workspace não encontrado.",
                    },
                    404,
                );
            }

            /*
             * ========================================================
             * SOMENTE FREE
             * ========================================================
             */

            if (
                String(
                    workspace.plan ||
                    "free",
                ).toLowerCase() !==
                "free"
            ) {
                return json(
                    {
                        error:
                            "O workspace já possui um plano pago.",
                    },
                    409,
                );
            }

            /*
             * ========================================================
             * TRIAL ENCERRADO
             * ========================================================
             */

            if (
                workspace.trial_used !==
                true
            ) {
                return json(
                    {
                        error:
                            "O trial gratuito ainda não foi utilizado.",
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
                return json(
                    {
                        error:
                            "O trial ainda está ativo.",
                    },
                    409,
                );
            }

            /*
             * ========================================================
             * EVITAR DUPLICAÇÃO
             * ========================================================
             */

            const {
                data: existing,
                error:
                existingError,
            } =
                await supabase
                    .from(
                        "subscriptions",
                    )
                    .select(
                        "id, status, provider_subscription_id",
                    )
                    .eq(
                        "workspace_id",
                        workspaceId,
                    )
                    .eq(
                        "provider",
                        "mercado_pago",
                    )
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
                    .order(
                        "created_at",
                        {
                            ascending:
                                false,
                        },
                    )
                    .limit(1)
                    .maybeSingle();

            if (
                existingError
            ) {
                return json(
                    {
                        error:
                            "Erro verificando assinatura existente.",
                    },
                    500,
                );
            }

            if (
                existing?.provider_subscription_id
            ) {
                return json(
                    {
                        error:
                            "Já existe uma assinatura Mercado Pago em processamento ou ativa.",
                        subscription_id:
                            existing.provider_subscription_id,
                    },
                    409,
                );
            }

            /*
             * ========================================================
             * PLANO MERCADO PAGO
             * ========================================================
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
              provider_plan_id,
              provider_product_id,
              is_active
            `,
                    )
                    .eq(
                        "plan",
                        plan,
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

            if (
                planError
            ) {
                return json(
                    {
                        error:
                            "Erro consultando plano Mercado Pago.",
                    },
                    500,
                );
            }

            const amount =
                getAmount(plan);

            /*
             * ========================================================
             * REFERÊNCIA
             * ========================================================
             */

            const externalReference =
                `stalmind_${workspaceId}_${plan}_${crypto.randomUUID()}`;

            /*
             * ========================================================
             * CRIAR PREAPPROVAL
             *
             * Mercado Pago usa /preapproval para assinaturas.
             * ========================================================
             */

            const mpResponse =
                await fetch(
                    "https://api.mercadopago.com/preapproval",
                    {
                        method: "POST",

                        headers: {
                            Authorization:
                                `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,

                            "Content-Type":
                                "application/json",

                            Accept:
                                "application/json",
                        },

                        body: JSON.stringify({
                            ...(planRow
                                ?.provider_plan_id
                                ? {
                                    preapproval_plan_id:
                                        planRow.provider_plan_id,
                                }
                                : {}),

                            reason:
                                `StalMind ${plan.toUpperCase()}`,

                            external_reference:
                                externalReference,

                            payer_email:
                                email,

                            auto_recurring: {
                                frequency:
                                    1,

                                frequency_type:
                                    "months",

                                transaction_amount:
                                    amount,

                                currency_id:
                                    "BRL",
                            },

                            back_url:
                                `${APP_URL}/plans?payment=success&provider=mercado_pago`,

                            status:
                                "pending",
                        }),
                    },
                );

            const mpData =
                await mpResponse.json();

            if (
                !mpResponse.ok
            ) {
                console.error(
                    "[create-mercadopago-subscription] Mercado Pago:",
                    mpData,
                );

                return json(
                    {
                        error:
                            "O Mercado Pago recusou a criação da assinatura.",

                        details:
                            mpData?.message ||
                            mpData?.error ||
                            null,
                    },
                    502,
                );
            }

            const subscriptionId =
                String(
                    mpData.id ||
                    "",
                );

            const initPoint =
                mpData.init_point ||
                mpData.sandbox_init_point ||
                null;

            if (
                !subscriptionId ||
                !initPoint
            ) {
                return json(
                    {
                        error:
                            "Mercado Pago não retornou o link da assinatura.",
                    },
                    502,
                );
            }

            /*
             * ========================================================
             * REGISTRAR LOCALMENTE
             * ========================================================
             */

            const {
                data: localSubscription,
                error:
                localSubscriptionError,
            } =
                await supabase
                    .from(
                        "subscriptions",
                    )
                    .insert({
                        workspace_id:
                            workspaceId,

                        plan,

                        status:
                            "trialing",

                        trial_ends_at:
                            null,

                        current_period_start:
                            null,

                        current_period_end:
                            null,

                        provider:
                            "mercado_pago",

                        provider_customer_id:
                            null,

                        provider_subscription_id:
                            subscriptionId,

                        provider_plan_id:
                            planRow?.provider_plan_id ||
                            null,

                        provider_product_id:
                            planRow?.provider_product_id ||
                            null,

                        cancel_at_period_end:
                            false,
                    })
                    .select(
                        "id",
                    )
                    .single();

            if (
                localSubscriptionError
            ) {
                console.error(
                    "[create-mercadopago-subscription] local subscription error:",
                    localSubscriptionError,
                );

                /*
                 * Cancelar assinatura remota.
                 */

                try {
                    await fetch(
                        `https://api.mercadopago.com/preapproval/${encodeURIComponent(
                            subscriptionId,
                        )}`,
                        {
                            method: "PUT",

                            headers: {
                                Authorization:
                                    `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,

                                "Content-Type":
                                    "application/json",
                            },

                            body: JSON.stringify({
                                status:
                                    "cancelled",
                            }),
                        },
                    );
                } catch (
                cancelError
                ) {
                    console.error(
                        "[create-mercadopago-subscription] cancel error:",
                        cancelError,
                    );
                }

                return json(
                    {
                        error:
                            "Não foi possível registrar a assinatura local. A assinatura Mercado Pago foi cancelada.",
                    },
                    500,
                );
            }

            /*
             * ========================================================
             * RETORNO
             * ========================================================
             */

            return json({
                success:
                    true,

                provider:
                    "mercado_pago",

                subscription_id:
                    subscriptionId,

                local_subscription_id:
                    localSubscription.id,

                approval_url:
                    initPoint,

                plan,

                currency:
                    "BRL",

                amount,
            });
        } catch (error) {
            console.error(
                "[create-mercadopago-subscription] Unexpected error:",
                error,
            );

            return json(
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Erro interno ao criar assinatura Mercado Pago.",
                },
                500,
            );
        }
    },
);