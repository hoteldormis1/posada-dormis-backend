-- Migración: Añadir campo direccion y hacer email opcional en Huesped


-- 1. Añadir columna direccion
ALTER TABLE "Huesped" 
ADD COLUMN IF NOT EXISTS "direccion" VARCHAR(255);

-- 2. Hacer email nullable (opcional)
ALTER TABLE "Huesped" 
ALTER COLUMN "email" DROP NOT NULL;

-- Comentarios:
-- - direccion es opcional (NULL permitido)
-- - email ahora es opcional (antes era obligatorio)
