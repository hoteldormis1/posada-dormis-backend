-- Migración: Agregar campos para reseteo de contraseña
-- Fecha: 2026-11-27
-- Descripción: Agrega los campos resetToken y resetTokenExpires a la tabla Usuario

ALTER TABLE Usuario
ADD COLUMN resetToken VARCHAR(255) NULL,
ADD COLUMN resetTokenExpires DATETIME NULL;

-- Crear índice para mejorar la búsqueda por resetToken
CREATE INDEX idx_usuario_reset_token ON Usuario(resetToken);

-- Comentarios
COMMENT ON COLUMN Usuario.resetToken IS 'Token para restablecer contraseña';
COMMENT ON COLUMN Usuario.resetTokenExpires IS 'Fecha de expiración del token de reseteo';

