-- ====================================================================
-- SCRIPT DE BASE DE DATOS PARA TO-DO LIST CON SUPABASE
-- Copia y pega este contenido en el Editor SQL (SQL Editor) de Supabase
-- ====================================================================

-- 1. Crear la tabla de tareas (tareas)
CREATE TABLE IF NOT EXISTS public.tareas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    titulo TEXT NOT NULL DEFAULT 'Sin título',
    concepto TEXT NOT NULL,
    concepto_superior TEXT NOT NULL,
    prioridad TEXT NOT NULL CHECK (prioridad IN ('alta', 'media', 'baja')),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en curso', 'rechazada', 'resuelta')),
    fecha_alta TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    fecha_resolucion TIMESTAMPTZ,
    fecha_limite DATE
);

-- NOTA DE MIGRACIÓN: Para bases de datos que ya existen, se pueden ejecutar las siguientes consultas en el Editor SQL de Supabase:
-- ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS titulo TEXT NOT NULL DEFAULT 'Sin título';
-- ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS fecha_limite DATE;

-- Indexar para mejorar el rendimiento de consultas por usuario
CREATE INDEX IF NOT EXISTS tareas_user_id_idx ON public.tareas(user_id);

-- 2. Habilitar la seguridad a nivel de fila (Row Level Security - RLS)
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

-- 3. Crear las políticas de seguridad para que cada usuario solo acceda a sus tareas

-- Política de lectura: Un usuario solo puede ver sus propias tareas
CREATE POLICY "Permitir lectura a usuarios de sus propias tareas"
ON public.tareas
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Política de inserción: Un usuario autenticado puede añadir tareas para sí mismo
CREATE POLICY "Permitir inserción a usuarios de sus propias tareas"
ON public.tareas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Política de actualización: Un usuario puede modificar sus propias tareas
CREATE POLICY "Permitir actualización a usuarios de sus propias tareas"
ON public.tareas
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política de borrado: Un usuario puede eliminar sus propias tareas
CREATE POLICY "Permitir borrado a usuarios de sus propias tareas"
ON public.tareas
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Habilitar tiempo real (Supabase Realtime) para la tabla tareas
-- Esto permite que la aplicación reciba cambios inmediatos (INSERT, UPDATE, DELETE)
-- de manera reactiva en todos los dispositivos conectados.
ALTER PUBLICATION supabase_realtime ADD TABLE public.tareas;
