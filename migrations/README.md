# Migraciones de Base de Datos

Este directorio contiene scripts SQL para migraciones de la base de datos.

## Cómo aplicar las migraciones

### Opción 1: Ejecución manual de SQL

1. Conectate a tu base de datos MySQL/MariaDB
2. Ejecutá el script SQL correspondiente:

```bash
mysql -u tu_usuario -p tu_base_de_datos < add_password_reset_fields.sql
```

### Opción 2: Desde un cliente de base de datos

1. Abrí tu cliente de MySQL (MySQL Workbench, phpMyAdmin, DBeaver, etc.)
2. Abrí el archivo SQL
3. Ejecutá el script

### Opción 3: Usando Sequelize (Automático)

Si estás usando Sequelize con `sync()`, los campos se crearán automáticamente cuando inicies el servidor:

```javascript
// En tu archivo principal o configuración de DB
await sequelize.sync({ alter: true }); // Solo en desarrollo
```

⚠️ **Nota**: En producción, es recomendable ejecutar las migraciones manualmente y no usar `sync({ alter: true })`.

## Migraciones disponibles

### add_password_reset_fields.sql

**Fecha**: 2026-11-27

**Descripción**: Agrega los campos necesarios para la funcionalidad de "Olvidé mi contraseña"

**Campos agregados**:
- `resetToken`: Token único para restablecer contraseña
- `resetTokenExpires`: Fecha de expiración del token

**Índices creados**:
- `idx_usuario_reset_token`: Índice en el campo resetToken para búsquedas rápidas

## Verificar la migración

Después de ejecutar la migración, verificá que los campos se hayan creado correctamente:

```sql
DESCRIBE Usuario;
```

Deberías ver los campos `resetToken` y `resetTokenExpires` en la tabla Usuario.

