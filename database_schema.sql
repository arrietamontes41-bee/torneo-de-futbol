-- ============================================================
-- ESQUEMA DE BASE DE DATOS
-- Torneo de Fútbol – Montería, Córdoba
-- Ejecuta este SQL en: Supabase → SQL Editor → New Query
-- ============================================================

-- 1. USUARIOS (administradores y equipos)
CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  rol         TEXT NOT NULL DEFAULT 'equipo'  CHECK (rol IN ('admin','equipo')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. EQUIPOS
CREATE TABLE IF NOT EXISTS equipos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  municipio   TEXT NOT NULL DEFAULT 'Montería',
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. PARTIDOS
CREATE TABLE IF NOT EXISTS partidos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_local_id  UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  equipo_visit_id  UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  fecha            DATE NOT NULL,
  hora             TIME NOT NULL,
  goles_local      INT,
  goles_visit      INT,
  estado           TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','finalizado')),
  created_at       TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT equipos_distintos CHECK (equipo_local_id <> equipo_visit_id)
);

-- ============================================================
-- ADMINISTRADOR POR DEFECTO
-- (cambia el password si deseas)
-- ============================================================
INSERT INTO usuarios (email, password, nombre, rol)
VALUES ('admin@torneo.com', 'admin123', 'Administrador', 'admin')
ON CONFLICT (email) DO NOTHING;

-- 4. JUGADORES
CREATE TABLE IF NOT EXISTS jugadores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id       UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  documento       TEXT NOT NULL,
  posicion        TEXT NOT NULL CHECK (posicion IN ('Portero','Defensa','Mediocampista','Delantero')),
  dorsal          INT NOT NULL CHECK (dorsal BETWEEN 1 AND 99),
  fecha_nac       DATE,
  foto            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (equipo_id, dorsal),
  UNIQUE (equipo_id, documento)
);

-- ============================================================
-- SEGURIDAD: Row Level Security (RLS)
-- Permite acceso público para leer y que el front maneje auth
-- ============================================================
ALTER TABLE usuarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidos   ENABLE ROW LEVEL SECURITY;

-- Políticas: lectura y escritura pública (el frontend controla la auth)
CREATE POLICY "public_read_users"    ON usuarios  FOR SELECT USING (true);
CREATE POLICY "public_insert_users"  ON usuarios  FOR INSERT WITH CHECK (true);

CREATE POLICY "public_read_equipos"  ON equipos   FOR SELECT USING (true);
CREATE POLICY "public_insert_equipos"ON equipos   FOR INSERT WITH CHECK (true);
CREATE POLICY "public_delete_equipos"ON equipos   FOR DELETE USING (true);

CREATE POLICY "public_read_partidos" ON partidos  FOR SELECT USING (true);
CREATE POLICY "public_insert_partidos" ON partidos FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_partidos" ON partidos FOR UPDATE USING (true);
CREATE POLICY "public_delete_partidos" ON partidos FOR DELETE USING (true);

ALTER TABLE jugadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_jugadores"   ON jugadores FOR SELECT USING (true);
CREATE POLICY "public_insert_jugadores" ON jugadores FOR INSERT WITH CHECK (true);
CREATE POLICY "public_delete_jugadores" ON jugadores FOR DELETE USING (true);

-- 5. EVENTOS DE PARTIDO (goles y tarjetas por jugador)
CREATE TABLE IF NOT EXISTS eventos_partido (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partido_id  UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  jugador_id  UUID NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
  equipo_id   UUID NOT NULL REFERENCES equipos(id)  ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('gol','amarilla','roja')),
  cantidad    INT  NOT NULL DEFAULT 1 CHECK (cantidad >= 0),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (partido_id, jugador_id, tipo)
);
ALTER TABLE eventos_partido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_eventos" ON eventos_partido FOR ALL USING (true) WITH CHECK (true);

-- Columna foto (ejecutar si la tabla jugadores ya existe)
ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS foto TEXT;
