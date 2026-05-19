-- ============================================================
-- ACTUALIZACIÓN DE BASE DE DATOS: TABLA DE TORNEO
--
-- Ejecuta este SQL en el SQL Editor de Supabase para habilitar
-- la persistencia y personalización del nombre del torneo.
-- ============================================================

-- 1. Crear tabla de torneo
CREATE TABLE IF NOT EXISTS public.torneo (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL DEFAULT 'Torneo de Fútbol',
  descripcion  TEXT,
  municipio    TEXT DEFAULT 'Montería',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Activar Seguridad de Fila (RLS)
ALTER TABLE public.torneo ENABLE ROW LEVEL SECURITY;

-- 3. Habilitar lectura pública (anónimos y autenticados)
DROP POLICY IF EXISTS "torneo_select_public" ON public.torneo;
CREATE POLICY "torneo_select_public" ON public.torneo
  FOR SELECT USING (true);

-- 4. Habilitar inserción (requerido durante registro de administrador inicial)
DROP POLICY IF EXISTS "torneo_insert_public" ON public.torneo;
CREATE POLICY "torneo_insert_public" ON public.torneo
  FOR INSERT WITH CHECK (true);

-- 5. Habilitar actualización (organizador/administrador)
DROP POLICY IF EXISTS "torneo_update_public" ON public.torneo;
CREATE POLICY "torneo_update_public" ON public.torneo
  FOR UPDATE USING (true) WITH CHECK (true);
