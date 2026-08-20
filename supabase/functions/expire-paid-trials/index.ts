import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-cron-key",
    "Access-Control-Allow-Methods":
        "POST, OPTIONS",
};

function json(
    data: unknown,
    status = 200,
): Response {
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

/**
 * ============================================================
 * SUPABASE ADMIN
 * ============================================================
 *
 * Usa a secret key do projeto.
 *
 * Prioridade:
 * 1. SUPABASE_SECRET_KEYS
 * 2. SUPABASE_SERVICE_ROLE_KEY
 */
function getSupabaseAdmin() {
    const url = Deno.env.get("SUPABASE_URL");

    if (!url) {
        throw new Error(
            "SUPABASE_URL não configurado.",
        );
    }

    let secretKey: string | undefined;

    /**
     * Novo formato de secrets
     */
    const secretKeysRaw =
        Deno.env.get("SUPABASE_SECRET_KEYS");

    if (secretKeysRaw) {
        try {
            const parsed =
                JSON.parse(secretKeysRaw);

            if (
                parsed &&
                typeof parsed === "object"
            ) {
                /**
                 * Formato:
                 * {
                 *   "default": "sb_secret_..."
                 * }
                 */
                if (
                    typeof parsed.default ===
                    "string"
                ) {
                    secretKey =
                        parsed.default;
                }
            }
        } catch (error) {
            console.error(
                "[expire-paid-trials] Erro ao interpretar SUPABASE_SECRET_KEYS:",
                error,
            );
        }
    }

    /**
     * Compatibilidade com projetos antigos
     */
    if (!secretKey) {
        secretKey =
            Deno.env.get(
                "SUPABASE_SERVICE_ROLE_KEY",
            );
    }

    if (!secretKey) {
        throw new Error(
            "Nenhuma chave administrativa do Supabase foi encontrada.",
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
 * ============================================================
 * SERVIDOR
 * ============================================================
 */

Deno.serve(
    async (req: Request) => {
        /**
         * ======================================================
         * CORS
         * ======================================================
         */

        if (req.method === "OPTIONS") {
            return new Response(
                "ok",
                {
                    headers:
                        corsHeaders,
                },
            );
        }

        /**
         * ======================================================
         * MÉTODO
         * ======================================================
         */

        if (req.method !== "POST") {
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
             * ==================================================
             * SEGURANÇA
             * ==================================================
             *
             * Esta função NÃO deve ser chamada pelo frontend.
             *
             * Ela deve ser executada somente pelo cron/job
             * autorizado através de X-Cron-Key.
             */

            const cronKey =
                Deno.env.get(
                    "TRIAL_CRON_KEY",
                );

            const providedKey =
                req.headers.get(
                    "x-cron-key",
                );

            if (!cronKey) {
                console.error(
                    "[expire-paid-trials] TRIAL_CRON_KEY não configurado.",
                );

                return json(
                    {
                        success: false,
                        error:
                            "Cron secret não configurado.",
                    },
                    500,
                );
            }

            if (
                !providedKey ||
                providedKey !== cronKey
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

            /**
             * ==================================================
             * SUPABASE ADMIN
             * ==================================================
             */

            const supabase =
                getSupabaseAdmin();

            /**
             * ==================================================
             * EXPIRAR TRIALS
             * ==================================================
             *
             * Toda a regra de negócio fica no PostgreSQL.
             *
             * A RPC deverá:
             *
             * 1. localizar trials expirados;
             * 2. verificar se ainda existe assinatura paga ativa;
             * 3. alterar o workspace para free quando necessário;
             * 4. atualizar a subscription correspondente;
             * 5. impedir duplicação;
             * 6. retornar a quantidade processada.
             */

            const {
                data,
                error,
            } = await supabase.rpc(
                "expire_paid_trials",
            );

            if (error) {
                console.error(
                    "[expire-paid-trials] RPC error:",
                    error,
                );

                throw error;
            }

            /**
             * PostgreSQL pode retornar:
             *
             * integer
             * bigint
             * array
             * objeto
             *
             * Normalmente esperamos integer.
             */

            let processed = 0;

            if (
                typeof data ===
                "number"
            ) {
                processed = data;
            } else if (
                typeof data ===
                "string"
            ) {
                const parsed =
                    Number(data);

                if (
                    Number.isFinite(
                        parsed,
                    )
                ) {
                    processed =
                        parsed;
                }
            }

            /**
             * ==================================================
             * RESULTADO
             * ==================================================
             */

            return json({
                success: true,

                executed_at:
                    new Date().toISOString(),

                expired_trials:
                    processed,

                message:
                    processed > 0
                        ? `${processed} trial(s) expirado(s) e revertido(s) para Free.`
                        : "Nenhum trial expirado.",
            });
        } catch (error) {
            console.error(
                "[expire-paid-trials] Erro:",
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