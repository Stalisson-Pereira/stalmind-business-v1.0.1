import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
        "POST, OPTIONS",
};

/**
 * Eventos que o STALMIND processa.
 */
const ALLOWED_EVENTS =
    new Set([
        "BILLING.SUBSCRIPTION.CREATED",
        "BILLING.SUBSCRIPTION.ACTIVATED",
        "BILLING.SUBSCRIPTION.UPDATED",
        "BILLING.SUBSCRIPTION.CANCELLED",
        "BILLING.SUBSCRIPTION.SUSPENDED",
        "BILLING.SUBSCRIPTION.EXPIRED",
        "BILLING.SUBSCRIPTION.PAYMENT.FAILED",

        "PAYMENT.SALE.COMPLETED",
        "PAYMENT.SALE.REFUNDED",
        "PAYMENT.SALE.REVERSED",

        "CHECKOUT.ORDER.COMPLETED",
        "CHECKOUT.ORDER.DECLINED",
        "CHECKOUT.PAYMENT-RESOURCE.PAYMENT-COMPLETED",
        "CHECKOUT.PAYMENT-RESOURCE.PAYMENT-ON-HOLD",
        "CHECKOUT.PAYMENT-RESOURCE.UPDATED",
    ]);

/**
 * Resposta JSON.
 */
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
 * Cliente Supabase administrativo.
 *
 * SERVICE_ROLE_KEY só existe na Edge Function.
 */
function getSupabaseAdmin() {
    const supabaseUrl =
        Deno.env.get(
            "SUPABASE_URL",
        );

    const serviceRoleKey =
        Deno.env.get(
            "SUPABASE_SERVICE_ROLE_KEY",
        );

    if (
        !supabaseUrl ||
        !serviceRoleKey
    ) {
        throw new Error(
            "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurado.",
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

/**
 * URL PayPal.
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
 * Access Token PayPal.
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
            "Não foi possível autenticar no PayPal.",
        );
    }

    if (
        typeof data?.access_token !==
        "string"
    ) {
        throw new Error(
            "PayPal não retornou access_token.",
        );
    }

    return data.access_token;
}

/**
 * Validação criptográfica do webhook.
 *
 * O corpo bruto deve ser utilizado.
 */
async function verifyPayPalWebhook(
    rawBody: string,
    headers: Headers,
): Promise<boolean> {
    const webhookId =
        Deno.env.get(
            "PAYPAL_WEBHOOK_ID",
        );

    if (!webhookId) {
        throw new Error(
            "PAYPAL_WEBHOOK_ID não configurado.",
        );
    }

    const transmissionId =
        headers.get(
            "paypal-transmission-id",
        );

    const transmissionTime =
        headers.get(
            "paypal-transmission-time",
        );

    const certUrl =
        headers.get(
            "paypal-cert-url",
        );

    const authAlgo =
        headers.get(
            "paypal-auth-algo",
        );

    const transmissionSig =
        headers.get(
            "paypal-transmission-sig",
        );

    if (
        !transmissionId ||
        !transmissionTime ||
        !certUrl ||
        !authAlgo ||
        !transmissionSig
    ) {
        console.error(
            "Headers necessários do PayPal não encontrados.",
        );

        return false;
    }

    let webhookEvent: unknown;

    try {
        webhookEvent =
            JSON.parse(
                rawBody,
            );
    } catch {
        console.error(
            "Webhook PayPal não contém JSON válido.",
        );

        return false;
    }

    const accessToken =
        await getPayPalAccessToken();

    const verifyPayload = {
        auth_algo:
            authAlgo,

        cert_url:
            certUrl,

        transmission_id:
            transmissionId,

        transmission_sig:
            transmissionSig,

        transmission_time:
            transmissionTime,

        webhook_id:
            webhookId,

        webhook_event:
            webhookEvent,
    };

    const response =
        await fetch(
            `${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`,
            {
                method: "POST",

                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        "application/json",

                    Accept:
                        "application/json",
                },

                body:
                    JSON.stringify(
                        verifyPayload,
                    ),
            },
        );

    const result =
        await response.json();

    if (!response.ok) {
        console.error(
            "Erro na validação do webhook PayPal:",
            result,
        );

        return false;
    }

    return (
        result?.verification_status ===
        "SUCCESS"
    );
}

/**
 * Procura uma subscription local pelo ID PayPal.
 */
async function findSubscription(
    supabase: ReturnType<
        typeof createClient
    >,
    paypalSubscriptionId: string,
) {
    const {
        data,
        error,
    } =
        await supabase
            .from("subscriptions")
            .select(
                `
          id,
          workspace_id,
          plan,
          status,
          trial_ends_at,
          provider,
          provider_customer_id,
          provider_subscription_id,
          current_period_start,
          current_period_end
        `,
            )
            .eq(
                "provider_subscription_id",
                paypalSubscriptionId,
            )
            .maybeSingle();

    if (error) {
        console.error(
            "Erro ao procurar subscription:",
            error,
        );

        throw error;
    }

    return data;
}

/**
 * Atualiza o plano do workspace.
 */
async function setWorkspacePlan(
    supabase: ReturnType<
        typeof createClient
    >,
    workspaceId: string,
    plan: string,
) {
    const {
        error,
    } =
        await supabase
            .from("workspaces")
            .update({
                plan,

                updated_at:
                    new Date().toISOString(),
            })
            .eq(
                "id",
                workspaceId,
            );

    if (error) {
        throw error;
    }
}

/**
 * Atualiza subscription.
 */
async function updateSubscriptionById(
    supabase: ReturnType<
        typeof createClient
    >,
    subscriptionId: string,
    values: Record<
        string,
        unknown
    >,
) {
    const {
        error,
    } =
        await supabase
            .from("subscriptions")
            .update({
                ...values,

                updated_at:
                    new Date().toISOString(),
            })
            .eq(
                "id",
                subscriptionId,
            );

    if (error) {
        throw error;
    }
}

/**
 * Procura o último pagamento PayPal
 * relacionado à subscription.
 */
async function findLatestSubscriptionPayment(
    supabase: ReturnType<
        typeof createClient
    >,
    paypalSubscriptionId: string,
) {
    const {
        data,
        error,
    } =
        await supabase
            .from(
                "subscription_payments",
            )
            .select(
                "id, workspace_id, subscription_id, provider, payment_method, provider_payment_id, provider_subscription_id, status",
            )
            .eq(
                "provider",
                "paypal",
            )
            .eq(
                "provider_subscription_id",
                paypalSubscriptionId,
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

    if (error) {
        throw error;
    }

    return data;
}

/**
 * Atualiza o pagamento existente.
 *
 * Respeita os CHECK constraints atuais:
 *
 * provider:
 * paypal | mercado_pago | sumup
 *
 * payment_method:
 * paypal | pix | sumup
 *
 * status:
 * pending | processing | paid | failed |
 * cancelled | refunded | partially_refunded | expired
 */
async function updateSubscriptionPayment(
    supabase: ReturnType<
        typeof createClient
    >,
    paypalSubscriptionId: string,
    values: Record<
        string,
        unknown
    >,
) {
    const payment =
        await findLatestSubscriptionPayment(
            supabase,
            paypalSubscriptionId,
        );

    if (!payment) {
        console.warn(
            "Nenhum subscription_payment encontrado para:",
            paypalSubscriptionId,
        );

        return null;
    }

    const {
        error,
    } =
        await supabase
            .from(
                "subscription_payments",
            )
            .update({
                ...values,

                updated_at:
                    new Date().toISOString(),
            })
            .eq(
                "id",
                payment.id,
            );

    if (error) {
        throw error;
    }

    return payment.id;
}

/**
 * Processa eventos BILLING.SUBSCRIPTION.*
 */
async function handleSubscriptionEvent(
    supabase: ReturnType<
        typeof createClient
    >,
    eventType: string,
    resource: Record<
        string,
        unknown
    >,
) {
    const paypalSubscriptionId =
        typeof resource.id ===
            "string"
            ? resource.id
            : "";

    if (
        !paypalSubscriptionId
    ) {
        console.warn(
            "Subscription ID ausente:",
            eventType,
        );

        return;
    }

    const subscription =
        await findSubscription(
            supabase,
            paypalSubscriptionId,
        );

    if (!subscription) {
        console.warn(
            "Subscription local não encontrada:",
            paypalSubscriptionId,
        );

        /**
         * Não lançamos erro aqui.
         *
         * O evento continua registrado no payment_events
         * para auditoria.
         */
        return;
    }

    const startTime =
        typeof resource.start_time ===
            "string"
            ? resource.start_time
            : null;

    const billingInfo =
        typeof resource.billing_info ===
            "object" &&
            resource.billing_info !==
            null
            ? resource.billing_info as Record<
                string,
                unknown
            >
            : null;

    const cycleStart =
        billingInfo &&
            typeof billingInfo.cycle_execution_date ===
            "string"
            ? billingInfo.cycle_execution_date
            : null;

    switch (
    eventType
    ) {
        /**
         * ------------------------------------------------
         * CREATED
         * ------------------------------------------------
         */
        case "BILLING.SUBSCRIPTION.CREATED": {
            await updateSubscriptionById(
                supabase,
                subscription.id,
                {
                    provider:
                        "paypal",

                    provider_subscription_id:
                        paypalSubscriptionId,
                },
            );

            break;
        }

        /**
         * ------------------------------------------------
         * ACTIVATED
         * ------------------------------------------------
         */
        case "BILLING.SUBSCRIPTION.ACTIVATED": {
            await updateSubscriptionById(
                supabase,
                subscription.id,
                {
                    provider:
                        "paypal",

                    status:
                        "active",

                    current_period_start:
                        startTime
                            ? new Date(
                                startTime,
                            ).toISOString()
                            : null,

                    current_period_end:
                        cycleStart
                            ? new Date(
                                cycleStart,
                            ).toISOString()
                            : null,
                },
            );

            /**
             * O pagamento confirmado ativa o plano
             * no workspace.
             */
            await setWorkspacePlan(
                supabase,
                subscription.workspace_id,
                subscription.plan,
            );

            await updateSubscriptionPayment(
                supabase,
                paypalSubscriptionId,
                {
                    provider:
                        "paypal",

                    payment_method:
                        "paypal",

                    status:
                        "paid",

                    payment_date:
                        new Date().toISOString(),
                },
            );

            break;
        }

        /**
         * ------------------------------------------------
         * UPDATED
         * ------------------------------------------------
         */
        case "BILLING.SUBSCRIPTION.UPDATED": {
            const status =
                typeof resource.status ===
                    "string"
                    ? resource.status.toLowerCase()
                    : "";

            /**
             * Só utilizamos valores válidos do enum.
             */
            if (
                status ===
                "active"
            ) {
                await updateSubscriptionById(
                    supabase,
                    subscription.id,
                    {
                        provider:
                            "paypal",

                        status:
                            "active",

                        current_period_start:
                            startTime
                                ? new Date(
                                    startTime,
                                ).toISOString()
                                : subscription.current_period_start,

                        current_period_end:
                            cycleStart
                                ? new Date(
                                    cycleStart,
                                ).toISOString()
                                : subscription.current_period_end,
                    },
                );

                await setWorkspacePlan(
                    supabase,
                    subscription.workspace_id,
                    subscription.plan,
                );
            } else if (
                status ===
                "suspended"
            ) {
                /**
                 * O enum possui "paused", não "suspended".
                 */
                await updateSubscriptionById(
                    supabase,
                    subscription.id,
                    {
                        provider:
                            "paypal",

                        status:
                            "paused",
                    },
                );
            } else {
                await updateSubscriptionById(
                    supabase,
                    subscription.id,
                    {
                        provider:
                            "paypal",
                    },
                );
            }

            break;
        }

        /**
         * ------------------------------------------------
         * CANCELLED / EXPIRED
         * ------------------------------------------------
         */
        case "BILLING.SUBSCRIPTION.CANCELLED":
        case "BILLING.SUBSCRIPTION.EXPIRED": {
            await updateSubscriptionById(
                supabase,
                subscription.id,
                {
                    provider:
                        "paypal",

                    status:
                        "cancelled",
                },
            );

            /**
             * Quando a subscription termina,
             * o workspace volta para Free.
             */
            await setWorkspacePlan(
                supabase,
                subscription.workspace_id,
                "free",
            );

            await updateSubscriptionPayment(
                supabase,
                paypalSubscriptionId,
                {
                    provider:
                        "paypal",

                    payment_method:
                        "paypal",

                    status:
                        "cancelled",
                },
            );

            break;
        }

        /**
         * ------------------------------------------------
         * SUSPENDED
         * ------------------------------------------------
         */
        case "BILLING.SUBSCRIPTION.SUSPENDED": {
            /**
             * PostgreSQL enum:
             *
             * trialing
             * active
             * past_due
             * cancelled
             * paused
             *
             * Portanto NÃO gravamos "suspended".
             */
            await updateSubscriptionById(
                supabase,
                subscription.id,
                {
                    provider:
                        "paypal",

                    status:
                        "paused",
                },
            );

            console.warn(
                "Subscription PayPal pausada:",
                paypalSubscriptionId,
            );

            break;
        }

        /**
         * ------------------------------------------------
         * PAYMENT FAILED
         * ------------------------------------------------
         */
        case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
            await updateSubscriptionById(
                supabase,
                subscription.id,
                {
                    provider:
                        "paypal",

                    status:
                        "past_due",
                },
            );

            await updateSubscriptionPayment(
                supabase,
                paypalSubscriptionId,
                {
                    provider:
                        "paypal",

                    payment_method:
                        "paypal",

                    status:
                        "failed",

                    failure_message:
                        "Pagamento da subscrição PayPal falhou.",
                },
            );

            break;
        }

        default:
            console.log(
                "Evento de subscription ignorado:",
                eventType,
            );
    }
}

/**
 * Processa pagamentos PayPal.
 */
async function handlePaymentEvent(
    supabase: ReturnType<
        typeof createClient
    >,
    eventType: string,
    resource: Record<
        string,
        unknown
    >,
) {
    /**
     * Eventos PAYMENT.SALE antigos
     * utilizam billing_agreement_id.
     */
    const paypalSubscriptionId =
        typeof resource.billing_agreement_id ===
            "string"
            ? resource.billing_agreement_id
            : null;

    const paymentId =
        typeof resource.id ===
            "string"
            ? resource.id
            : null;

    /**
     * Eventos de Checkout podem utilizar
     * outros identificadores.
     *
     * Não tentamos alterar subscription_payments
     * sem uma subscription identificável.
     */
    if (
        !paypalSubscriptionId
    ) {
        console.warn(
            "Subscription PayPal não encontrada diretamente no evento:",
            {
                eventType,
                paymentId,
            },
        );

        return;
    }

    switch (
    eventType
    ) {
        /**
         * ------------------------------------------------
         * PAYMENT COMPLETED
         * ------------------------------------------------
         */
        case "PAYMENT.SALE.COMPLETED": {
            await updateSubscriptionPayment(
                supabase,
                paypalSubscriptionId,
                {
                    provider:
                        "paypal",

                    payment_method:
                        "paypal",

                    status:
                        "paid",

                    provider_payment_id:
                        paymentId,

                    payment_date:
                        new Date().toISOString(),

                    failure_message:
                        null,
                },
            );

            break;
        }

        /**
         * ------------------------------------------------
         * REFUND
         * ------------------------------------------------
         */
        case "PAYMENT.SALE.REFUNDED": {
            await updateSubscriptionPayment(
                supabase,
                paypalSubscriptionId,
                {
                    provider:
                        "paypal",

                    payment_method:
                        "paypal",

                    status:
                        "refunded",

                    provider_payment_id:
                        paymentId,
                },
            );

            break;
        }

        /**
         * ------------------------------------------------
         * REVERSED
         * ------------------------------------------------
         */
        case "PAYMENT.SALE.REVERSED": {
            await updateSubscriptionPayment(
                supabase,
                paypalSubscriptionId,
                {
                    provider:
                        "paypal",

                    payment_method:
                        "paypal",

                    status:
                        "failed",

                    provider_payment_id:
                        paymentId,

                    failure_message:
                        "Pagamento PayPal revertido.",
                },
            );

            break;
        }

        default:
            console.log(
                "Evento de pagamento ignorado:",
                eventType,
            );
    }
}

/**
 * ======================================================
 * WEBHOOK
 * ======================================================
 */
Deno.serve(
    async (req: Request) => {
        /**
         * --------------------------------------------------
         * CORS
         * --------------------------------------------------
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
         * --------------------------------------------------
         * MÉTODO
         * --------------------------------------------------
         */

        if (
            req.method !==
            "POST"
        ) {
            return json(
                {
                    error:
                        "Method not allowed",
                },
                405,
            );
        }

        try {
            /**
             * ------------------------------------------------
             * 1. CORPO BRUTO
             * ------------------------------------------------
             *
             * Necessário para validação PayPal.
             */
            const rawBody =
                await req.text();

            if (!rawBody) {
                return json(
                    {
                        error:
                            "Empty request body",
                    },
                    400,
                );
            }

            /**
             * ------------------------------------------------
             * 2. VALIDAR ASSINATURA
             * ------------------------------------------------
             */
            const verified =
                await verifyPayPalWebhook(
                    rawBody,
                    req.headers,
                );

            if (!verified) {
                console.error(
                    "Webhook PayPal rejeitado: assinatura inválida.",
                );

                return json(
                    {
                        error:
                            "Invalid PayPal webhook signature",
                    },
                    401,
                );
            }

            /**
             * ------------------------------------------------
             * 3. PARSE
             * ------------------------------------------------
             */
            const event =
                JSON.parse(
                    rawBody,
                ) as Record<
                    string,
                    unknown
                >;

            const eventId =
                typeof event.id ===
                    "string"
                    ? event.id
                    : "";

            const eventType =
                typeof event.event_type ===
                    "string"
                    ? event.event_type
                    : "";

            const resource =
                typeof event.resource ===
                    "object" &&
                    event.resource !==
                    null
                    ? event.resource as Record<
                        string,
                        unknown
                    >
                    : {};

            if (
                !eventId ||
                !eventType
            ) {
                return json(
                    {
                        error:
                            "Invalid PayPal event payload",
                    },
                    400,
                );
            }

            /**
             * ------------------------------------------------
             * 4. IGNORAR EVENTOS NÃO UTILIZADOS
             * ------------------------------------------------
             *
             * Retornamos 200 para o PayPal.
             */
            if (
                !ALLOWED_EVENTS.has(
                    eventType,
                )
            ) {
                console.log(
                    "Evento PayPal ignorado:",
                    eventType,
                );

                return json({
                    received: true,
                    ignored: true,
                    event_id:
                        eventId,
                    event_type:
                        eventType,
                });
            }

            /**
             * ------------------------------------------------
             * 5. SUPABASE ADMIN
             * ------------------------------------------------
             */
            const supabase =
                getSupabaseAdmin();

            /**
             * ------------------------------------------------
             * 6. DESCOBRIR WORKSPACE
             * ------------------------------------------------
             *
             * Primeiro tentamos custom_id.
             */
            let workspaceId:
                | string
                | null =
                null;

            if (
                typeof resource.custom_id ===
                "string"
            ) {
                workspaceId =
                    resource.custom_id;
            }

            /**
             * Em eventos de subscription,
             * se custom_id não vier, tentamos encontrar
             * pela subscription local.
             */
            const paypalSubscriptionId =
                typeof resource.id ===
                    "string" &&
                    eventType.startsWith(
                        "BILLING.SUBSCRIPTION.",
                    )
                    ? resource.id
                    : typeof resource.billing_agreement_id ===
                        "string"
                        ? resource.billing_agreement_id
                        : null;

            if (
                !workspaceId &&
                paypalSubscriptionId
            ) {
                const subscription =
                    await findSubscription(
                        supabase,
                        paypalSubscriptionId,
                    );

                if (
                    subscription
                ) {
                    workspaceId =
                        subscription.workspace_id;
                }
            }

            /**
             * ------------------------------------------------
             * 7. IDEMPOTÊNCIA
             * ------------------------------------------------
             */
            const {
                data:
                existingEvent,
                error:
                lookupError,
            } =
                await supabase
                    .from(
                        "payment_events",
                    )
                    .select(
                        "id, processed, processing_error",
                    )
                    .eq(
                        "provider",
                        "paypal",
                    )
                    .eq(
                        "event_id",
                        eventId,
                    )
                    .maybeSingle();

            if (
                lookupError
            ) {
                throw lookupError;
            }

            if (
                existingEvent
            ) {
                return json({
                    received: true,

                    duplicate:
                        true,

                    processed:
                        existingEvent.processed,

                    event_id:
                        eventId,
                });
            }

            /**
             * ------------------------------------------------
             * 8. REGISTRAR EVENTO
             * ------------------------------------------------
             */
            const {
                data:
                insertedEvent,
                error:
                insertError,
            } =
                await supabase
                    .from(
                        "payment_events",
                    )
                    .insert({
                        workspace_id:
                            workspaceId,

                        provider:
                            "paypal",

                        event_id:
                            eventId,

                        event_type:
                            eventType,

                        resource_id:
                            typeof resource.id ===
                                "string"
                                ? resource.id
                                : null,

                        payload:
                            event,

                        processed:
                            false,
                    })
                    .select(
                        "id",
                    )
                    .single();

            if (
                insertError
            ) {
                /**
                 * UNIQUE(provider,event_id)
                 * protege contra concorrência.
                 */
                if (
                    insertError.code ===
                    "23505"
                ) {
                    return json({
                        received:
                            true,

                        duplicate:
                            true,

                        event_id:
                            eventId,
                    });
                }

                throw insertError;
            }

            /**
             * ------------------------------------------------
             * 9. PROCESSAR EVENTO
             * ------------------------------------------------
             */
            try {
                if (
                    eventType.startsWith(
                        "BILLING.SUBSCRIPTION.",
                    )
                ) {
                    await handleSubscriptionEvent(
                        supabase,
                        eventType,
                        resource,
                    );
                } else {
                    await handlePaymentEvent(
                        supabase,
                        eventType,
                        resource,
                    );
                }

                /**
                 * ------------------------------------------------
                 * 10. MARCAR PROCESSADO
                 * ------------------------------------------------
                 */
                const {
                    error:
                    processedError,
                } =
                    await supabase
                        .from(
                            "payment_events",
                        )
                        .update({
                            processed:
                                true,

                            processed_at:
                                new Date().toISOString(),

                            processing_error:
                                null,
                        })
                        .eq(
                            "id",
                            insertedEvent.id,
                        );

                if (
                    processedError
                ) {
                    throw processedError;
                }

                /**
                 * PayPal recebe HTTP 200.
                 */
                return json({
                    received:
                        true,

                    processed:
                        true,

                    event_id:
                        eventId,

                    event_type:
                        eventType,

                    workspace_id:
                        workspaceId,
                });
            } catch (
            processingError
            ) {
                /**
                 * ------------------------------------------------
                 * 11. REGISTRAR ERRO
                 * ------------------------------------------------
                 */
                const message =
                    processingError instanceof
                        Error
                        ? processingError.message
                        : "Unknown processing error";

                const {
                    error:
                    updateError,
                } =
                    await supabase
                        .from(
                            "payment_events",
                        )
                        .update({
                            processed:
                                false,

                            processing_error:
                                message,
                        })
                        .eq(
                            "id",
                            insertedEvent.id,
                        );

                if (
                    updateError
                ) {
                    console.error(
                        "Erro ao registrar processing_error:",
                        updateError,
                    );
                }

                throw processingError;
            }
        } catch (error) {
            console.error(
                "paypal-webhook error:",
                error,
            );

            return json(
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Internal server error",
                },
                500,
            );
        }
    },
);