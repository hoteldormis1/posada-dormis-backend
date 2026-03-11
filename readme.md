# Backend - Sistema de Reservas

API REST para gestion de reservas, habitaciones, huespedes, autenticacion y auditoria.

## Stack

- Node.js + Express
- PostgreSQL + Sequelize
- JWT (access + refresh token)
- WebSocket (`ws`) para eventos de reservas

## Requisitos

- Node.js 18+
- PostgreSQL en ejecución
- Variables de entorno configuradas

## Variables de entorno

Crear `backend/.env` con valores similares a:

```env
PORT=4000
URL=http://localhost:4000
DATABASE_URL=postgresql://usuario:password@localhost:5432/tu_db
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET_ACCESS=...
JWT_SECRET_REFRESH=...
JWT_EXPIRATION_ACCESS=15m
JWT_EXPIRATION_REFRESH=1d
```

## Instalación y ejecución

```bash
cd backend
npm install
npm run dev
```

Al iniciar, el servidor sincroniza el esquema y asegura datos base:

- roles por defecto
- estados de reserva por defecto
- columnas de habitación necesarias

## Módulos principales

- `auth`: login, refresh, logout, registro
- `usuarios` y `tipoUsuario`
- `huespedes` y `huespedes no deseados`
- `habitaciones` y `tipoHabitacion`
- `reservas` (admin y públicas)
- `auditoria`

## Reglas de negocio relevantes

- No se permite crear reservas solapadas para una misma habitación.
- Se valida lista de huéspedes no deseados por DNI.
- Una habitación puede deshabilitarse con rango:
  - `deshabilitadaDesde`
  - `deshabilitadaHasta`
  - `observacionDeshabilitacion`
- La API de reservas valida disponibilidad y estado de habitación antes de confirmar.

## Scripts utiles

- `npm run dev`: inicia backend con nodemon.
- `npm start`: inicia backend con nodemon.

## Endpoints de referencia

### Públicos

- `GET /api/public/habitaciones/disponibles`
- `POST /api/public/reservas`
- `GET /api/public/reservas/confirmar`
- `GET /api/public/reservas/cancelar-pendiente`
- `POST /api/public/huespedes/buscar-dni`
- `POST /api/public/huespedes/verificar-telefono`

### Privados (JWT)

- `GET /api/reservas`
- `POST /api/reservas`
- `PUT /api/reservas/:id`
- `PUT /api/reservas/:id/confirmar`
- `PUT /api/reservas/:id/checkin`
- `PUT /api/reservas/:id/checkout`
- `PUT /api/reservas/:id/cancelar`
- `PUT /api/reservas/:id/rechazar`
- `GET /api/habitaciones`
- `POST /api/habitaciones`
- `PUT /api/habitaciones/:id`
- `DELETE /api/habitaciones/:id`

## Evidencia para presentación de tesis

- Validaciones de negocio centralizadas en controladores.
- Persistencia transaccional en base relacional.
- Manejo de errores y códigos HTTP consistentes.
- Integración con notificaciones email y eventos en tiempo real.
