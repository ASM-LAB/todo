import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Verificar si las credenciales son las por defecto o están vacías
export const isSupabaseConfigured =
  supabaseUrl &&
  supabaseUrl !== 'https://your-supabase-url.supabase.co' &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'your-supabase-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Esto guarda la sesión en localStorage automáticamente
    autoRefreshToken: true,
  }
});
