-- ============================================================
-- MIGRACIÓN: AJUSTES DE UNICIDAD MULTI-TORNEO
--
-- Ejecuta este SQL en el SQL Editor de Supabase para permitir:
-- 1. Que el mismo nombre de equipo exista en diferentes torneos.
-- 2. Que el mismo jugador (cédula) juegue en diferentes torneos.
-- ============================================================

-- 1. Modificar restricción de equipos:
-- Eliminar la restricción de nombre único a nivel global de la tabla.
ALTER TABLE public.equipos DROP CONSTRAINT IF EXISTS equipos_nombre_key;

-- Añadir una restricción de unicidad compuesta: nombre de equipo único POR TORNEO.
ALTER TABLE public.equipos ADD CONSTRAINT equipos_nombre_torneo_unique UNIQUE (nombre, torneo_id);

-- 2. Modificar restricción de jugadores:
-- (Opcional, si tienes RLS o quieres que la base de datos lo valide estrictamente)
-- Nota: La validación ya se realiza en la aplicación en tiempo real al guardar.
-- Si deseas añadir torneo_id a jugadores para restricción a nivel DB:
-- ALTER TABLE public.jugadores ADD COLUMN IF NOT EXISTS torneo_id UUID REFERENCES public.torneo(id) ON DELETE CASCADE;
-- ALTER TABLE public.jugadores DROP CONSTRAINT IF EXISTS jugadores_equipo_id_documento_key;
-- ALTER TABLE public.jugadores ADD CONSTRAINT jugadores_documento_torneo_unique UNIQUE (documento, torneo_id);
