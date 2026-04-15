-- ============================================================
-- CONTROL DE CARGA — Schema Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Perfiles (extiende auth.users de Supabase)
CREATE TABLE perfiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  rol         TEXT NOT NULL CHECK (rol IN ('controlador', 'clarkista', 'admin')),
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Turnos
CREATE TABLE turnos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controlador_id  UUID NOT NULL REFERENCES perfiles(id),
  fecha_inicio    TIMESTAMPTZ DEFAULT NOW(),
  fecha_fin       TIMESTAMPTZ,
  activo          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Solo puede haber un turno activo a la vez
CREATE UNIQUE INDEX idx_turnos_activo ON turnos (activo) WHERE activo = TRUE;

-- 3. Cargas
CREATE TABLE cargas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id             UUID NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
  chofer               TEXT NOT NULL,
  transporte           TEXT NOT NULL,
  numero_remito        TEXT,
  clarkista_id         UUID REFERENCES perfiles(id),
  clarkista_nombre     TEXT NOT NULL DEFAULT '',
  estado               TEXT NOT NULL DEFAULT 'en_piso'
                         CHECK (estado IN ('en_piso','controlado','en_carga','finalizado')),
  hora_llegada_camion  TIMESTAMPTZ,
  hora_inicio_carga    TIMESTAMPTZ,
  hora_fin_carga       TIMESTAMPTZ,
  notas                TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Clientes por carga
CREATE TABLE clientes_carga (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carga_id  UUID NOT NULL REFERENCES cargas(id) ON DELETE CASCADE,
  nombre    TEXT NOT NULL,
  orden     INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Pallets
CREATE TABLE pallets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_carga_id  UUID NOT NULL REFERENCES clientes_carga(id) ON DELETE CASCADE,
  cantidad_cajas    INT NOT NULL CHECK (cantidad_cajas > 0),
  estado            TEXT NOT NULL DEFAULT 'en_piso' CHECK (estado IN ('en_piso', 'cargado')),
  hora_carga        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Incidencias
CREATE TABLE incidencias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carga_id   UUID NOT NULL REFERENCES cargas(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  hora       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCIÓN ATÓMICA: marcar pallet como cargado
-- ============================================================
CREATE OR REPLACE FUNCTION check_pallet(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE pallets
  SET    estado = 'cargado',
         hora_carga = NOW()
  WHERE  id = p_id
    AND  estado = 'en_piso';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pallet no encontrado o ya fue cargado';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VISTA: resumen de cargas
-- ============================================================
CREATE OR REPLACE VIEW vista_resumen_carga AS
SELECT
  c.id,
  c.turno_id,
  c.chofer,
  c.transporte,
  c.estado,
  c.clarkista_nombre,
  c.numero_remito,
  c.hora_llegada_camion,
  c.hora_inicio_carga,
  c.hora_fin_carga,
  c.notas,
  c.created_at,
  COUNT(DISTINCT cc.id)                         AS total_clientes,
  COUNT(p.id)                                   AS total_pallets,
  COUNT(p.id) FILTER (WHERE p.estado = 'cargado') AS pallets_cargados,
  COALESCE(SUM(p.cantidad_cajas), 0)            AS total_cajas,
  COUNT(DISTINCT i.id)                          AS total_incidencias
FROM  cargas c
LEFT JOIN clientes_carga cc ON cc.carga_id = c.id
LEFT JOIN pallets p          ON p.cliente_carga_id = cc.id
LEFT JOIN incidencias i      ON i.carga_id = c.id
GROUP BY c.id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE perfiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_carga ENABLE ROW LEVEL SECURITY;
ALTER TABLE pallets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidencias  ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios autenticados pueden leer y escribir todo
CREATE POLICY "auth_all" ON perfiles      FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_all" ON turnos        FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_all" ON cargas        FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_all" ON clientes_carga FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_all" ON pallets       FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_all" ON incidencias   FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- TRIGGER: crear perfil automáticamente al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'controlador')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX idx_cargas_turno_id    ON cargas(turno_id);
CREATE INDEX idx_cargas_estado      ON cargas(estado);
CREATE INDEX idx_cargas_created_at  ON cargas(created_at DESC);
CREATE INDEX idx_pallets_cliente    ON pallets(cliente_carga_id);
CREATE INDEX idx_pallets_estado     ON pallets(estado);
CREATE INDEX idx_cc_carga_id        ON clientes_carga(carga_id);
