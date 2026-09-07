import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MERCADOPAGO_ACCESS_TOKEN =
    Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
};

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
);

const admin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
);

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

function isUuid(value: unknown): value is string {
    return (
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            value,
        )
    );
}

function parseDate(value: unknown): Date | null {
    if (typeof value !== "string" || !value) {
        return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

async function getMercadoPagoSubscription(
    subscriptionId: string,
) {
    const response = await fetch(
        `https://api.mercadopago.com/preapproval/${encodeURIComponent(
            subscriptionId,
        )}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
        },
    );

    const text = await response.text();

    let data: Record<string, unknown> = {};

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
                "Não foi possível consultar a assinatura no Mercado Pago.",
            ),
        );
    }

    return data;
}

async function cancelMercadoPagoSubscription(
    subscriptionId: string,
) {
    const response = await fetch(
        `https://api.mercadopago.com/preapproval/${encodeURIComponent(
            subscriptionId,
        )}`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                status: "canceled",
            }),
        },
    );

    const text = await response.text();

    let data: Record<string, unknown> = {};

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
                "O Mercado Pago não permitiu o cancelamento da assinatura.",
            ),
        );
    }

    return data;
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
        if (!SUPABASE_URL) {
            throw new Error(
                "SUPABASE_URL não configurada.",
            );
        }

        if (!SUPABASE_ANON_KEY) {
            throw new Error(
                "SUPABASE_ANON_KEY não configurada.",
            );
        }

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error(
                "SUPABASE_SERVICE_ROLE_KEY não configurada.",
            );
        }

        if (!MERCADOPAGO_ACCESS_TOKEN) {
            throw new Error(
                "MERCADOPAGO_ACCESS_TOKEN não configurado.",
            );
        }

        const authorization =
            req.headers.get("Authorization") ??
            req.headers.get("authorization");

        if (!authorization?.startsWith("Bearer ")) {
            return jsonResponse(
                {
                    success: false,
                    error: "Sessão não autenticada.",
                },
                401,
            );
        }

        const accessToken =
            authorization.substring("Bearer ".length);

        const userClient = createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                global: {
                    headers: {
                        Authorization: authorization,
                    },
                },
            },
        );

        const {
            data: userData,
            error: userError,
        } = await userClient.auth.getUser(
            accessToken,
        );

        if (userError || !userData.user) {
            return jsonResponse(
                {
                    success: false,
                    error: "Sessão inválida ou expirada.",
                },
                401,
            );
        }

        const user = userData.user;

        let body: Record<string, unknown> = {};

        try {
            body = await req.json();
        } catch {
            body = {};
        }

        const workspaceId =
            typeof body.workspace_id === "string"
                ? body.workspace_id
                : "";

        if (!isUuid(workspaceId)) {
            return jsonResponse(
                {
                    success: false,
                    error: "workspace_id inválido.",
                },
                400,
            );
        }

        /*
         * ============================================================
         * MEMBRO DO WORKSPACE
         * ============================================================
         */

        const {
            data: membership,
            error: membershipError,
        } = await admin
            .from("workspace_members")
            .select("workspace_id, user_id, role")
            .eq("workspace_id", workspaceId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (
            membershipError ||
            !membership
        ) {
            return jsonResponse(
                {
                    success: false,
                    error:
                        "Você não possui acesso a este workspace.",
                },
                403,
            );
        }

        const role = String(
            membership.role ?? "",
        ).toLowerCase();

        if (
            role !== "owner" &&
            role !== "admin"
        ) {
            return jsonResponse(
                {
                    success: false,
                    error:
                        "Somente o proprietário ou administrador pode cancelar a assinatura.",
                },
                403,
            );
        }

        /*
         * ============================================================
         * WORKSPACE
         * ============================================================
         */

        const {
            data: workspace,
            error: workspaceError,
        } = await admin
            .from("workspaces")
            .select(
                "id, name, plan, plan_billing, currency",
            )
            .eq("id", workspaceId)
            .maybeSingle();

        if (
            workspaceError ||
            !workspace
        ) {
            return jsonResponse(
                {
                    success: false,
                    error: "Workspace não encontrado.",
                },
                404,
            );
        }

        /*
         * ============================================================
         * ASSINATURA LOCAL
         * ============================================================
         */

        const {
            data: subscription,
            error: subscriptionError,
        } = await admin
            .from("subscriptions")
            .select(
                `
          id,
          workspace_id,
          plan,
          status,
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
            .eq("workspace_id", workspaceId)
            .eq("provider", "mercado_pago")
            .not(
                "provider_subscription_id",
                "is",
                null,
            )
            .order("created_at", {
                ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (
            subscriptionError
        ) {
            throw new Error(
                `Erro ao localizar a assinatura: ${subscriptionError.message}`,
            );
        }

        if (!subscription) {
            return jsonResponse(
                {
                    success: false,
                    error:
                        "Nenhuma assinatura Mercado Pago encontrada para este workspace.",
                },
                404,
            );
        }

        const providerSubscriptionId =
            String(
                subscription.provider_subscription_id ??
                "",
            ).trim();

        if (!providerSubscriptionId) {
            return jsonResponse(
                {
                    success: false,
                    error:
                        "A assinatura não possui ID do Mercado Pago.",
                },
                409,
            );
        }

        /*
         * ============================================================
         * JÁ CANCELADA
         * ============================================================
         */

        if (
            subscription.cancel_at_period_end === true ||
            subscription.status === "cancelled"
        ) {
            return jsonResponse({
                success: true,
                already_cancelled: true,
                message:
                    "A assinatura já está cancelada.",
                subscription_id: subscription.id,
                provider_subscription_id:
                    providerSubscriptionId,
                current_period_end:
                    subscription.current_period_end ??
                    null,
            });
        }

        /*
         * ============================================================
         * CONSULTAR MERCADO PAGO
         * ============================================================
         */

        const providerBefore =
            await getMercadoPagoSubscription(
                providerSubscriptionId,
            );

        const providerStatus = String(
            providerBefore.status ?? "",
        ).toLowerCase();

        if (
            providerStatus === "canceled" ||
            providerStatus === "cancelled"
        ) {
            const currentPeriodEnd =
                parseDate(
                    subscription.current_period_end,
                );

            const now = new Date();

            const periodStillActive =
                currentPeriodEnd &&
                currentPeriodEnd.getTime() > now.getTime();

            await admin
                .from("subscriptions")
                .update({
                    cancel_at_period_end:
                        Boolean(periodStillActive),
                    cancelled_at:
                        new Date().toISOString(),
                    cancellation_reason:
                        "Cancelada pelo cliente no Mercado Pago.",
                    status:
                        periodStillActive
                            ? "active"
                            : "cancelled",
                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    subscription.id,
                );

            if (!periodStillActive) {
                await admin
                    .from("workspaces")
                    .update({
                        plan: "free",
                        plan_billing: "monthly",
                        updated_at:
                            new Date().toISOString(),
                    })
                    .eq(
                        "id",
                        workspaceId,
                    );
            }

            return jsonResponse({
                success: true,
                already_cancelled: true,
                subscription_id:
                    subscription.id,
                provider_subscription_id:
                    providerSubscriptionId,
                access_until:
                    currentPeriodEnd?.toISOString() ??
                    null,
            });
        }

        /*
         * ============================================================
         * CANCELAR NO MERCADO PAGO
         * ============================================================
         */

        const providerAfter =
            await cancelMercadoPagoSubscription(
                providerSubscriptionId,
            );

        /*
         * ============================================================
         * MANTER ACESSO ATÉ O FINAL DO PERÍODO PAGO
         * ============================================================
         */

        const currentPeriodEnd =
            parseDate(
                subscription.current_period_end,
            );

        const now = new Date();

        const periodStillActive =
            currentPeriodEnd &&
            currentPeriodEnd.getTime() > now.getTime();

        const cancellationDate =
            new Date().toISOString();

        const localStatus =
            periodStillActive
                ? "active"
                : "cancelled";

        const {
            error: localUpdateError,
        } = await admin
            .from("subscriptions")
            .update({
                cancel_at_period_end:
                    Boolean(periodStillActive),
                cancelled_at:
                    cancellationDate,
                cancellation_reason:
                    "Cancelada pelo cliente.",
                status:
                    localStatus,
                updated_at:
                    cancellationDate,
            })
            .eq(
                "id",
                subscription.id,
            );

        if (localUpdateError) {
            throw new Error(
                `Mercado Pago cancelado, mas houve erro ao atualizar a assinatura local: ${localUpdateError.message}`,
            );
        }

        /*
         * ============================================================
         * SE O PERÍODO JÁ TERMINOU → FREE
         * ============================================================
         */

        if (!periodStillActive) {
            const {
                error: workspaceUpdateError,
            } = await admin
                .from("workspaces")
                .update({
                    plan: "free",
                    plan_billing: "monthly",
                    updated_at:
                        cancellationDate,
                })
                .eq(
                    "id",
                    workspaceId,
                );

            if (workspaceUpdateError) {
                throw new Error(
                    `Assinatura cancelada, mas não foi possível retornar o workspace para Free: ${workspaceUpdateError.message}`,
                );
            }
        }

        return jsonResponse({
            success: true,
            message:
                "Assinatura Mercado Pago cancelada com sucesso.",
            subscription_id:
                subscription.id,
            provider_subscription_id:
                providerSubscriptionId,
            provider_status:
                providerAfter.status ??
                "canceled",
            cancelled_at:
                cancellationDate,
            cancel_at_period_end:
                Boolean(periodStillActive),
            access_until:
                currentPeriodEnd?.toISOString() ??
                null,
            plan:
                periodStillActive
                    ? workspace.plan
                    : "free",
        });
    } catch (error) {
        console.error(
            "[cancel-mercadopago-subscription]",
            error,
        );

        return jsonResponse(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Erro interno ao cancelar a assinatura.",
            },
            500,
        );
    }
});