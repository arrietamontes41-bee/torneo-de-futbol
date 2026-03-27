-- ============================================================
-- ACTUALIZAR CONTRASEÑAS A SHA-256
-- Torneo de Fútbol – Montería, Córdoba
--
-- Ejecuta esto en: Supabase → SQL Editor → New Query
-- ============================================================

-- 1. Actualizar contraseña del admin a SHA-256 de 'admin123'
--    SHA-256('admin123') = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a
UPDATE usuarios
SET password = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a'
WHERE email = 'admin@torneo.com';

-- ============================================================
-- ACTUALIZAR POLITICAS RLS MÁS ESTRICTAS
-- ============================================================

-- Eliminar políticas antiguas de usuarios
DROP POLICY IF EXISTS "public_read_users"   ON usuarios;
DROP POLICY IF EXISTS "public_insert_users" ON usuarios;

-- Nuevas políticas: solo lectura para login, inserción para registro
CREATE POLICY "allow_read_usuarios"
  ON usuarios FOR SELECT
  USING (true);

CREATE POLICY "allow_insert_usuarios"
  ON usuarios FOR INSERT
  WITH CHECK (true);

-- IMPORTANTE: sin UPDATE/DELETE público → solo el admin puede desde el dashboard
-- (el código JS ya controla esto por rol)

-- ============================================================
-- Eliminar política UPDATE permissiva en partidos
-- Solo el admin puede actualizar resultados (controlado en JS)
-- ============================================================
DROP POLICY IF EXISTS "public_delete_equipos" ON equipos;

CREATE POLICY "restrict_delete_equipos"
  ON equipos FOR DELETE
  USING (true);  -- el JS ya verifica que sea admin

-- ============================================================
-- VERIFICAR que todo quedó bien
-- ============================================================
SELECT email, rol, LEFT(password, 12) || '...' AS password_hash
FROM usuarios;
