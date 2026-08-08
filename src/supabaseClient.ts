import { createClient } from '@supabase/supabase-js';

// Intentar leer de las variables de entorno, o de lo contrario de localStorage si se configuraron dinámicamente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('temp_supabase_url') || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('temp_supabase_key') || '';

// Verificar si las credenciales son válidas y no son los placeholders por defecto
export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  supabaseUrl !== 'https://your-supabase-url.supabase.co' &&
  supabaseUrl !== 'https://tu-proyecto.supabase.co' &&
  Boolean(supabaseAnonKey) &&
  supabaseAnonKey !== 'your-supabase-anon-key' &&
  supabaseAnonKey !== 'tu-anon-key-de-supabase';

// Usar credenciales seguras o un fallback válido temporal para evitar errores fatales durante la importación inicial
const activeUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co';
const activeKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(activeUrl, activeKey, {
  auth: {
    persistSession: true, // Esto guarda la sesión en localStorage de forma totalmente segura
    autoRefreshToken: true,
  }
});
