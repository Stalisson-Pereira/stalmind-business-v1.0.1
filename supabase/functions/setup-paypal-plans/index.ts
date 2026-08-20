import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-setup-key",
    "Access-Control-Allow-Methods":
        "POST, OPTIONS",
};

/**
 * Planos comerciais do STALMIND.
 *
 * O banco suporta BRL, EUR e USD.
 */
const PLANS = [
    {
        plan: "pro",
        currency: "BRL",
        amount: "69.99",
        name: "STALMIND Pro BRL",
    },
    {
        plan: "pro",
        currency: "EUR",
        amount: "16.99",
        name: "STALMIND Pro EUR",
    },
    {
        plan: "pro",
        currency: "USD",
        amount: "17.99",
        name: "STALMIND Pro USD",
    },
    {
        plan: "enterprise",
        currency: "BRL",
        amount: "499.99",
        name: "STALMIND Enterprise BRL",
    },
    {
        plan: "enterprise",
        currency: "EUR",
        amount: "69.99",
        name: "STALMIND Enterprise EUR",
    },
    {
        plan: "enterprise",
        currency: "USD",
        amount: "73.99",
        name: "STALMIND Enterprise USD",
    },
] as const;

function json(
    data: unknown,
    status = 200,
): Response {
    return new Response(
        JSON.stringify(
            data,
            null,
            2,
        ),
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

/**
 * Cliente administrativo do Supabase.
 */
function getSupabaseAdmin() {
    const url =
        Deno.env.get(
            "SUPABASE_URL",
        );

    const secretKeysRaw =
        Deno.env.get(
            "SUPABASE_SECRET_KEYS",
        );

    const serviceRoleKey =
        Deno.env.get(
            "SUPABASE_SERVICE_ROLE_KEY",
        );

    if (!url) {
        throw new Error(
            "SUPABASE_URL não configurado.",
        );
    }

    let secretKey =
        serviceRoleKey;

    /**
     * Compatibilidade com o novo formato
     * SUPABASE_SECRET_KEYS.
     */
    if (secretKeysRaw) {
        try {
            const parsed =
                JSON.parse(
                    secretKeysRaw,
                );

            if (
                parsed &&
                typeof parsed ===
                "object" &&
                typeof parsed.default ===
                "string"
            ) {
                secretKey =
                    parsed.default;
            }
        } catch (error) {
            console.error(
                "Erro ao interpretar SUPABASE_SECRET_KEYS:",
                error,
            );
        }
    }

    if (!secretKey) {
        throw new Error(
            "Nenhuma chave secreta do Supabase foi encontrada.",
        );
    }

    return createClient(
        url,
        secretKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        },
    );
}

/**
 * URL da API PayPal.
 */
function getPayPalBaseUrl(): string {
    const mode =
        (
            Deno.env.get(
                "PAYPAL_MODE",
            ) ?? "sandbox"
        ).toLowerCase();

    return mode === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
}

/**
 * OAuth PayPal.
 */
async function getPayPalAccessToken(): Promise<string> {
    const clientId =
        Deno.env.get(
            "PAYPAL_CLIENT_ID",
        );

    const clientSecret =
        Deno.env.get(
            "PAYPAL_CLIENT_SECRET",
        );

    if (
        !clientId ||
        !clientSecret
    ) {
        throw new Error(
            "PAYPAL_CLIENT_ID ou PAYPAL_CLIENT_SECRET não configurado.",
        );
    }

    const credentials =
        btoa(
            `${clientId}:${clientSecret}`,
        );

    const response =
        await fetch(
            `${getPayPalBaseUrl()}/v1/oauth2/token`,
            {
                method: "POST",

                headers: {
                    Authorization:
                        `Basic ${credentials}`,

                    "Content-Type":
                        "application/x-www-form-urlencoded",

                    Accept:
                        "application/json",
                },

                body:
                    "grant_type=client_credentials",
            },
        );

    const data =
        await response.json();

    if (!response.ok) {
        console.error(
            "PayPal OAuth error:",
            data,
        );

        throw new Error(
            "Falha ao autenticar no PayPal.",
        );
    }

    if (
        !data ||
        typeof data.access_token !==
        "string"
    ) {
        throw new Error(
            "PayPal não retornou access_token.",
        );
    }

    return data.access_token;
}

/**
 * Request genérico para API PayPal.
 */
async function paypalRequest(
    path: string,
    options: {
        method: string;
        accessToken: string;
        body?: unknown;
        requestId?: string;
    },
): Promise<any> {
    const headers: Record<
        string,
        string
    > = {
        Authorization:
            `Bearer ${options.accessToken}`,

        Accept:
            "application/json",

        "Content-Type":
            "application/json",
    };

    if (
        options.requestId
    ) {
        headers[
            "PayPal-Request-Id"
        ] =
            options.requestId;
    }

    const response =
        await fetch(
            `${getPayPalBaseUrl()}${path}`,
            {
                method:
                    options.method,

                headers,

                body:
                    options.body !==
                        undefined
                        ? JSON.stringify(
                            options.body,
                        )
                        : undefined,
            },
        );

    const text =
        await response.text();

    let data: unknown =
        null;

    try {
        data = text
            ? JSON.parse(text)
            : null;
    } catch {
        data = text;
    }

    if (!response.ok) {
        console.error(
            `PayPal API error ${response.status}:`,
            data,
        );

        throw new Error(
            `PayPal API error ${response.status}: ${JSON.stringify(data)}`,
        );
    }

    return data;
}

/**
 * Criar produto.
 */
async function createProduct(
    accessToken: string,
) {
    return paypalRequest(
        "/v1/catalogs/products",
        {
            method: "POST",

            accessToken,

            requestId:
                `STALMIND-PRODUCT-${crypto.randomUUID()}`,

            body: {
                name:
                    "STALMIND SaaS",

                description:
                    "Software as a Service - STALMIND Business OS",

                type:
                    "SERVICE",

                category:
                    "SOFTWARE",

                home_url:
                    Deno.env.get(
                        "APP_URL",
                    ) ??
                    "https://stalmind.netlify.app",
            },
        },
    );
}

/**
 * Criar plano PayPal.
 */
async function createPlan(
    accessToken: string,
    productId: string,
    config: (typeof PLANS)[number],
) {
    const payload = {
        product_id:
            productId,

        name:
            config.name,

        description:
            `${config.plan ===
                "pro"
                ? "STALMIND Pro"
                : "STALMIND Enterprise"
            } - ${config.currency}`,

        billing_cycles: [
            {
                frequency: {
                    interval_unit:
                        "MONTH",

                    interval_count:
                        1,
                },

                tenure_type:
                    "REGULAR",

                sequence:
                    1,

                total_cycles:
                    0,

                pricing_scheme: {
                    fixed_price: {
                        value:
                            config.amount,

                        currency_code:
                            config.currency,
                    },
                },
            },
        ],

        payment_preferences: {
            auto_bill_outstanding:
                true,

            setup_fee_failure_action:
                "CONTINUE",

            payment_failure_threshold:
                1,
        },
    };

    return paypalRequest(
        "/v1/billing/plans",
        {
            method: "POST",

            accessToken,

            requestId:
                `STALMIND-PLAN-${config.plan}-${config.currency}-${crypto.randomUUID()}`,

            body: payload,
        },
    );
}

Deno.serve(
    async (req: Request) => {
        /**
         * CORS
         */
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

        /**
         * Método
         */
        if (
            req.method !==
            "POST"
        ) {
            return json(
                {
                    success: false,
                    error:
                        "Method not allowed",
                },
                405,
            );
        }

        try {
            /**
             * ------------------------------------------------
             * PROTEÇÃO ADMINISTRATIVA
             * ------------------------------------------------
             *
             * Esta função não deve ser chamada pelo
             * frontend normalmente.
             */
            const setupKey =
                Deno.env.get(
                    "PAYPAL_SETUP_KEY",
                );

            const providedKey =
                req.headers.get(
                    "x-setup-key",
                );

            if (
                !setupKey ||
                !providedKey ||
                providedKey !==
                setupKey
            ) {
                return json(
                    {
                        success: false,
                        error:
                            "Unauthorized",
                    },
                    401,
                );
            }

            const supabase =
                getSupabaseAdmin();

            /**
             * ------------------------------------------------
             * VERIFICAR PLANOS EXISTENTES
             * ------------------------------------------------
             */
            const {
                data:
                existingPlans,
                error:
                existingError,
            } =
                await supabase
                    .from(
                        "subscription_payment_plans",
                    )
                    .select(
                        "id, plan, provider, currency, amount, billing_interval, provider_product_id, provider_plan_id, is_active",
                    )
                    .eq(
                        "provider",
                        "paypal",
                    );

            if (
                existingError
            ) {
                throw existingError;
            }

            const existingActivePlans =
                (
                    existingPlans ??
                    []
                ).filter(
                    (item) =>
                        item.is_active ===
                        true &&
                        !!item.provider_plan_id,
                );

            /**
             * Não criar produtos/planos duplicados.
             */
            if (
                existingActivePlans.length >
                0
            ) {
                return json(
                    {
                        success: false,

                        message:
                            "Já existem planos PayPal configurados. Nenhum novo plano foi criado.",

                        plans:
                            existingActivePlans,
                    },
                    409,
                );
            }

            /**
             * ------------------------------------------------
             * PAYPAL AUTH
             * ------------------------------------------------
             */

            const accessToken =
                await getPayPalAccessToken();

            /**
             * ------------------------------------------------
             * CRIAR PRODUTO
             * ------------------------------------------------
             */

            const product =
                await createProduct(
                    accessToken,
                );

            const productId =
                typeof product?.id ===
                    "string"
                    ? product.id
                    : null;

            if (!productId) {
                throw new Error(
                    "PayPal não retornou o Product ID.",
                );
            }

            /**
             * ------------------------------------------------
             * CRIAR PLANOS
             * ------------------------------------------------
             */

            const results: Array<
                Record<string, unknown>
            > = [];

            for (
                const config of PLANS
            ) {
                console.log(
                    `Criando plano ${config.plan}/${config.currency}...`,
                );

                const paypalPlan =
                    await createPlan(
                        accessToken,
                        productId,
                        config,
                    );

                const planId =
                    typeof paypalPlan?.id ===
                        "string"
                        ? paypalPlan.id
                        : null;

                if (!planId) {
                    throw new Error(
                        `PayPal não retornou Plan ID para ${config.plan}/${config.currency}.`,
                    );
                }

                const paypalStatus =
                    typeof paypalPlan?.status ===
                        "string"
                        ? paypalPlan.status
                        : null;

                const isActive =
                    paypalStatus ===
                    "ACTIVE";

                /**
                 * ------------------------------------------------
                 * GRAVAR NO SUPABASE
                 * ------------------------------------------------
                 */
                const {
                    data:
                    dbPlan,
                    error:
                    dbError,
                } =
                    await supabase
                        .from(
                            "subscription_payment_plans",
                        )
                        .upsert(
                            {
                                plan:
                                    config.plan,

                                provider:
                                    "paypal",

                                currency:
                                    config.currency,

                                amount:
                                    Number(
                                        config.amount,
                                    ),

                                billing_interval:
                                    "month",

                                provider_product_id:
                                    productId,

                                provider_plan_id:
                                    planId,

                                is_active:
                                    isActive,

                                updated_at:
                                    new Date().toISOString(),
                            },
                            {
                                onConflict:
                                    "plan,provider,currency,billing_interval",
                            },
                        )
                        .select()
                        .single();

                if (
                    dbError
                ) {
                    throw dbError;
                }

                results.push(
                    {
                        plan:
                            config.plan,

                        currency:
                            config.currency,

                        amount:
                            config.amount,

                        paypal_status:
                            paypalStatus,

                        provider_product_id:
                            productId,

                        provider_plan_id:
                            planId,

                        database_id:
                            dbPlan.id,

                        is_active:
                            isActive,
                    },
                );
            }

            return json({
                success: true,

                product: {
                    id:
                        productId,

                    name:
                        "STALMIND SaaS",
                },

                plans:
                    results,
            });
        } catch (error) {
            console.error(
                "setup-paypal-plans error:",
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
    },
);