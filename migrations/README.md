# Migraciones de Base de Datos

Este directorio contiene scripts SQL para migraciones de la base de datos.

## Cómo aplicar las migraciones

### Opción 1: Ejecución manual de SQL

1. Conectate a tu base de datos PostgreSQL
2. Ejecutá el script SQL correspondiente:

```bash
psql -d tu_base_de_datos -U tu_usuario -f add_password_reset_fields.sql
```

### Opción 2: Desde un cliente de base de datos

1. Abrí tu cliente de PostgreSQL (DBeaver, pgAdmin, DataGrip, etc.)
2. Abrí el archivo SQL
3. Ejecutá el script

### Opción 3: Usando Sequelize (Automático)

Si estás usando Sequelize con `sync()`, los campos se crearán automáticamente cuando inicies el servidor:

```javascript
// En tu archivo principal o configuración de DB
await sequelize.sync({ alter: true }); // Solo en desarrollo
```

⚠️ **Nota**: En producción se recomienda ejecutar migraciones manuales y evitar `sync({ alter: true })`.

## Migraciones disponibles

### add_password_reset_fields.sql

**Fecha**: 2026-11-27

**Descripción**: Agrega los campos necesarios para la funcionalidad de "Olvidé mi contraseña"

**Campos agregados**:
- `resetToken`: Token único para restablecer contraseña
- `resetTokenExpires`: Fecha de expiración del token

**Índices creados**:
- `idx_usuario_reset_token`: Índice en el campo resetToken para búsquedas rápidas

## Verificar la migración (PostgreSQL)

Después de ejecutar la migración, verificá que los campos se hayan creado correctamente:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'Usuario'
ORDER BY ordinal_position;
```

Deberías ver los campos `resetToken` y `resetTokenExpires` en la tabla Usuario.

