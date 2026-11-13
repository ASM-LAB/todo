import { createClient } from '@supabase/supabase-js';

// Verificar si una cadena es un valor vacío o una clave dummy por defecto
const isPlaceholder = (val: string | null | undefined): boolean => {
  if (!val) return true;
  const lower = val.toLowerCase();
  return (
    lower === 'https://your-supabase-url.supabase.co' ||
    lower === 'https://tu-proyecto.supabase.co' ||
    lower === 'https://placeholder.supabase.co' ||
    lower === 'your-supabase-anon-key' ||
    lower === 'tu-anon-key-de-supabase' ||
    lower === 'placeholder-anon-key' ||
    lower.trim() === ''
  );
};

// Resolver las credenciales desde variables de entorno o la configuración temporal del navegador.
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const storedUrl = localStorage.getItem('temp_supabase_url');
const storedKey = localStorage.getItem('temp_supabase_key');
const hasEnvCredentials = !isPlaceholder(envUrl) && !isPlaceholder(envKey);
const hasStoredCredentials = !isPlaceholder(storedUrl) && !isPlaceholder(storedKey);
const finalUrl = (hasEnvCredentials ? envUrl : hasStoredCredentials ? storedUrl : null) || 'https://placeholder.supabase.co';
const finalKey = (hasEnvCredentials ? envKey : hasStoredCredentials ? storedKey : null) || 'placeholder-anon-key';

// Exportar la bandera de si la app está correctamente configurada
export const isSupabaseConfigured = hasEnvCredentials || hasStoredCredentials;

// Usar las credenciales activas resueltas
const activeUrl = finalUrl;
const activeKey = finalKey;

export const supabase = createClient(activeUrl, activeKey, {
  auth: {
    persistSession: true, // Esto guarda la sesión en localStorage de forma totalmente segura
    autoRefreshToken: true,
  }
});
