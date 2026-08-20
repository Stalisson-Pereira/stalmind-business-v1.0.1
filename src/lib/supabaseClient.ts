import {
    createClient,
    type SupabaseClient,
} from "@supabase/supabase-js";

const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Verifica se o Supabase está configurado.
 *
 * IMPORTANTE:
 * Nunca coloque SUPABASE_SERVICE_ROLE_KEY
 * ou qualquer chave secreta aqui.
 *
 * O frontend deve utilizar somente:
 *
 * VITE_SUPABASE_URL
 * VITE_SUPABASE_ANON_KEY
 */
export const isSupabaseConfigured =
    Boolean(
        supabaseUrl &&
        supabaseAnonKey,
    );

/**
 * Cliente Supabase.
 *
 * O cliente é mantido disponível mesmo quando
 * as variáveis de ambiente ainda não foram configuradas,
 * evitando que imports que dependem de `supabase`
 * quebrem durante o build.
 */
export const supabase: SupabaseClient =
    isSupabaseConfigured
        ? createClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                },
            },
        )
        : createClient(
            "https://placeholder.supabase.co",
            "placeholder-anon-key",
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                },
            },
        );

/**
 * Aviso em desenvolvimento quando o Supabase
 * não estiver configurado.
 *
 * Não exibimos as chaves no console.
 */
if (!isSupabaseConfigured) {
    console.warn(
        "[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas.",
    );
}