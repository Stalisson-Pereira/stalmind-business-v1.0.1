import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
        "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
    return new Response(
        JSON.stringify(data, null, 2),
        {
            status,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
            },
        },
    );
}

function getAdminClient() {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (!supabaseUrl) {
        throw new Error(
            "SUPABASE_URL não configurado.",
        );
    }

    if (!serviceRoleKey) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY não configurado.",
        );
    }

    return createClient(
        supabaseUrl,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        },
    );
}

Deno.serve(async (req: Request) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: corsHeaders,
        });
    }

    if (req.method !== "POST") {
        return json(
            {
                success: false,
                error: "Method not allowed",
            },
            405,
        );
    }

    try {

        // =====================================================
        // AUTENTICAÇÃO
        // =====================================================

        const authHeader =
            req.headers.get("Authorization");

        if (!authHeader) {
            return json(
                {
                    success: false,
                    error: "Usuário não autenticado.",
                },
                401,
            );
        }

        const supabaseUrl =
            Deno.env.get("SUPABASE_URL");

        const anonKey =
            Deno.env.get("SUPABASE_ANON_KEY");

        if (!supabaseUrl || !anonKey) {
            throw new Error(
                "Configuração do Supabase incompleta.",
            );
        }

        const supabaseAuth =
            createClient(
                supabaseUrl,
                anonKey,
                {
                    global: {
                        headers: {
                            Authorization: authHeader,
                        },
                    },
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false,
                    },
                },
            );

        const {
            data: {
                user,
            },
            error: userError,
        } =
            await supabaseAuth.auth.getUser();

        if (userError || !user) {
            return json(
                {
                    success: false,
                    error:
                        "Sessão inválida ou expirada.",
                },
                401,
            );
        }

        // =====================================================
        // BODY
        // =====================================================

        const body = await req.json();

        const {
            workspace_id,
            plan,
            billing_cycle,
            currency,
            provider,
            amount,
            provider_product_id,
            provider_plan_id,
        } = body;

        // =====================================================
        // VALIDAÇÕES
        // =====================================================

        if (!workspace_id) {
            return json(
                {
                    success: false,
                    error:
                        "workspace_id é obrigatório.",
                },
                400,
            );
        }

        if (
            !["pro", "enterprise"].includes(plan)
        ) {
            return json(
                {
                    success: false,
                    error:
                        "O trial está disponível somente para Pro ou Enterprise.",
                },
                400,
            );
        }

        if (
            !["BRL", "EUR", "USD"].includes(currency)
        ) {
            return json(
                {
                    success: false,
                    error: "Moeda inválida.",
                },
                400,
            );
        }

        if (provider !== "paypal") {
            return json(
                {
                    success: false,
                    error: "Provider inválido.",
                },
                400,
            );
        }

        if (billing_cycle !== "monthly") {
            return json(
                {
                    success: false,
                    error:
                        "Somente cobrança mensal está disponível.",
                },
                400,
            );
        }

        if (
            typeof amount !== "number" ||
            amount <= 0
        ) {
            return json(
                {
                    success: false,
                    error: "Valor inválido.",
                },
                400,
            );
        }

        if (!provider_product_id) {
            return json(
                {
                    success: false,
                    error:
                        "provider_product_id é obrigatório.",
                },
                400,
            );
        }

        if (!provider_plan_id) {
            return json(
                {
                    success: false,
                    error:
                        "provider_plan_id é obrigatório.",
                },
                400,
            );
        }

        // =====================================================
        // CLIENTE ADMIN
        // =====================================================

        const supabase = getAdminClient();

        // =====================================================
        // VERIFICAR WORKSPACE
        // =====================================================

        const {
            data: workspace,
            error: workspaceError,
        } =
            await supabase
                .from("workspaces")
                .select(`
                    id,
                    plan,
                    trial_used,
                    trial_started_at,
                    trial_ends_at,
                    plan_billing
                `)
                .eq("id", workspace_id)
                .maybeSingle();

        if (workspaceError) {
            throw workspaceError;
        }

        if (!workspace) {
            return json(
                {
                    success: false,
                    error:
                        "Workspace não encontrado.",
                },
                404,
            );
        }

        // =====================================================
        // VERIFICAR MEMBRO
        // =====================================================

        const {
            data: membership,
            error: membershipError,
        } =
            await supabase
                .from("workspace_members")
                .select("id")
                .eq(
                    "workspace_id",
                    workspace_id,
                )
                .eq(
                    "user_id",
                    user.id,
                )
                .maybeSingle();

        if (membershipError) {
            throw membershipError;
        }

        if (!membership) {
            return json(
                {
                    success: false,
                    error:
                        "Você não possui acesso a este workspace.",
                },
                403,
            );
        }

        // =====================================================
        // PRIMEIRO TRIAL
        // =====================================================

        if (workspace.trial_used === true) {
            return json(
                {
                    success: false,
                    error:
                        "Este workspace já utilizou o período de teste gratuito.",
                },
                409,
            );
        }

        // =====================================================
        // WORKSPACE PRECISA ESTAR NO FREE
        // =====================================================

        if (workspace.plan !== "free") {
            return json(
                {
                    success: false,
                    error:
                        "O workspace precisa estar no plano Free para iniciar o trial.",
                },
                409,
            );
        }

        // =====================================================
        // TRIAL ATIVO
        // =====================================================

        if (
            workspace.trial_ends_at &&
            new Date(
                workspace.trial_ends_at,
            ) > new Date()
        ) {
            return json(
                {
                    success: false,
                    error:
                        "Este workspace já possui um trial ativo.",
                },
                409,
            );
        }

        // =====================================================
        // BUSCAR SUBSCRIPTION
        // =====================================================

        const {
            data: subscription,
            error: subscriptionError,
        } =
            await supabase
                .from("subscriptions")
                .select(`
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
                    cancel_at_period_end,
                    cancelled_at,
                    cancellation_reason,
                    provider_plan_id,
                    provider_product_id
                `)
                .eq(
                    "workspace_id",
                    workspace_id,
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    },
                )
                .limit(1)
                .maybeSingle();

        if (subscriptionError) {
            throw subscriptionError;
        }

        if (!subscription) {
            return json(
                {
                    success: false,
                    error:
                        "Subscription do workspace não encontrada.",
                },
                500,
            );
        }

        // =====================================================
        // DATAS
        // =====================================================

        const startedAt =
            new Date();

        const endsAt =
            new Date(
                startedAt.getTime() +
                    14 *
                        24 *
                        60 *
                        60 *
                        1000,
            );

        const startedAtISO =
            startedAt.toISOString();

        const endsAtISO =
            endsAt.toISOString();

        // =====================================================
        // ATUALIZAR WORKSPACE
        //
        // IMPORTANTE:
        // FREE -> PRO / ENTERPRISE
        // =====================================================

        const {
            data: updatedWorkspace,
            error:
                updateWorkspaceError,
        } =
            await supabase
                .from("workspaces")
                .update({
                    plan: plan,

                    trial_used: true,

                    trial_started_at:
                        startedAtISO,

                    trial_ends_at:
                        endsAtISO,

                    plan_billing:
                        "monthly",

                    updated_at:
                        startedAtISO,
                })
                .eq(
                    "id",
                    workspace_id,
                )
                .eq(
                    "plan",
                    "free",
                )
                .eq(
                    "trial_used",
                    false,
                )
                .select()
                .single();

        if (updateWorkspaceError) {
            throw updateWorkspaceError;
        }

        if (!updatedWorkspace) {
            throw new Error(
                "Não foi possível atualizar o plano do workspace.",
            );
        }

        // =====================================================
        // ATUALIZAR SUBSCRIPTION
        //
        // IMPORTANTE:
        // deve ficar exatamente igual ao workspace
        // =====================================================

        const {
            data: updatedSubscription,
            error:
                updateSubscriptionError,
        } =
            await supabase
                .from("subscriptions")
                .update({
                    plan: plan,

                    status:
                        "trialing",

                    trial_ends_at:
                        endsAtISO,

                    current_period_start:
                        startedAtISO,

                    current_period_end:
                        endsAtISO,

                    provider:
                        provider,

                    provider_plan_id:
                        provider_plan_id,

                    provider_product_id:
                        provider_product_id,

                    cancel_at_period_end:
                        false,

                    cancelled_at:
                        null,

                    cancellation_reason:
                        null,

                    updated_at:
                        startedAtISO,
                })
                .eq(
                    "id",
                    subscription.id,
                )
                .select()
                .single();

        if (updateSubscriptionError) {

            console.error(
                "[start-paid-trial] Erro ao atualizar subscription:",
                updateSubscriptionError,
            );

            // =================================================
            // ROLLBACK
            // =================================================

            await supabase
                .from("workspaces")
                .update({
                    plan: "free",

                    trial_used: false,

                    trial_started_at:
                        null,

                    trial_ends_at:
                        null,

                    plan_billing:
                        "monthly",

                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    workspace_id,
                );

            throw updateSubscriptionError;
        }

        // =====================================================
        // SUCESSO
        // =====================================================

        return json({
            success: true,

            message:
                `Trial de 14 dias iniciado para o plano ${plan}.`,

            workspace:
                updatedWorkspace,

            subscription:
                updatedSubscription,

            trial: {
                plan,

                started_at:
                    startedAtISO,

                ends_at:
                    endsAtISO,

                days: 14,
            },

            pricing: {
                currency,
                amount,
                provider,
                provider_product_id,
                provider_plan_id,
            },
        });

    } catch (error) {

        console.error(
            "[start-paid-trial] error:",
            error,
        );

        return json(
            {
                success: false,

                error:
                    error instanceof Error
                        ? error.message
                        : "Erro interno.",
            },
            500,
        );
    }
});