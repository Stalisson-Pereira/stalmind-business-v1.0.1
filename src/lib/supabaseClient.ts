import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Verifica se as credenciais do Supabase estão configuradas.
 */
export const isSupabaseConfigured =
    Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Cliente Supabase.
 *
 * Mantemos um cliente sempre disponível para que os serviços
 * possam importar `supabase` sem quebrar o build.
 */
export const supabase: SupabaseClient = isSupabaseConfigured
    ? createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        }
    )
    : createClient(
        'https://placeholder.supabase.co',
        'placeholder-anon-key',
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        }
    );

/**
 * Informações úteis para debug.
 */
if (!isSupabaseConfigured) {
    console.warn(
        '[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas.'
    );
}