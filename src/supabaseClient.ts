import { createClient } from '@supabase/supabase-js';

// Verificar si una cadena es un valor vacío o una clave dummy por defecto
const isPlaceholder = (val: string | undefined): boolean => {
  if (!val) return true;
  const lower = val.toLowerCase();
  return (
    lower === 'https://your-supabase-url.supabase.co' ||
    lower === 'https://tu-proyecto.supabase.co' ||
    lower === 'your-supabase-anon-key' ||
    lower === 'tu-anon-key-de-supabase' ||
    lower.trim() === ''
  );
};

// Resolver las claves prioritarias: variables de entorno reales primero, luego localStorage
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const finalUrl = !isPlaceholder(envUrl)
  ? (envUrl || '')
  : (localStorage.getItem('temp_supabase_url') || '');

const finalKey = !isPlaceholder(envKey)
  ? (envKey || '')
  : (localStorage.getItem('temp_supabase_key') || '');

// Exportar la bandera de si la app está correctamente configurada
export const isSupabaseConfigured = !isPlaceholder(finalUrl) && !isPlaceholder(finalKey);

// Usar credenciales seguras o un fallback válido temporal para evitar errores fatales durante la importación inicial
const activeUrl = isSupabaseConfigured ? finalUrl : 'https://placeholder-project.supabase.co';
const activeKey = isSupabaseConfigured ? finalKey : 'placeholder-anon-key';

export const supabase = createClient(activeUrl, activeKey, {
  auth: {
    persistSession: true, // Esto guarda la sesión en localStorage de forma totalmente segura
    autoRefreshToken: true,
  }
});
