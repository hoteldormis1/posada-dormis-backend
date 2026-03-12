# Backend - Posada Dormis API

API REST para autenticacion, gestion de usuarios, huespedes, habitaciones y reservas.

## Responsabilidad del modulo

- Exponer endpoints HTTP bajo `/api`.
- Aplicar reglas de negocio del dominio.
- Persistir datos en PostgreSQL.
- Emitir eventos y notificaciones (WebSocket + email).

## Tecnologias

- Node.js + Express
- Sequelize
- PostgreSQL
- JWT (access/refresh)
- WebSocket (`ws`)

## Requisitos

- Node.js 18 o superior
- Base PostgreSQL disponible
- Variables de entorno completas

## Configuracion de entorno

Crear `backend/.env`:

```env
PORT=4000
URL=http://localhost:4000
DATABASE_URL=postgresql://usuario:password@localhost:5432/tu_db
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET_ACCESS=replace_me
JWT_SECRET_REFRESH=replace_me
JWT_EXPIRATION_ACCESS=15m
JWT_EXPIRATION_REFRESH=1d
```

## Ejecucion

```bash
cd backend
npm install
npm run dev
```

Al iniciar, el servidor ejecuta sincronizacion de esquema y datos base (roles/estados por defecto).

## Scripts disponibles

- `npm run dev`: desarrollo con nodemon.
- `npm start`: arranque equivalente con nodemon.

## Estructura recomendada para lectura

- `models/`: estructura de datos y asociaciones.
- `controllers/`: logica de negocio y validaciones.
- `routes/`: contrato HTTP por recurso.
- `middlewares/`: auth, permisos, auditoria, rate limit.
- `helpers/`: funciones reutilizables (emails, contable, dashboard, etc.).

## Endpoints principales

### Publicos

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/public/habitaciones/disponibles`
- `POST /api/public/reservas`
- `GET /api/public/reservas/confirmar`
- `GET /api/public/reservas/cancelar-pendiente`
- `POST /api/public/huespedes/buscar-dni`
- `POST /api/public/huespedes/verificar-telefono`

### Protegidos por JWT

- `GET /api/usuarios`, `GET /api/usuarios/me`, `POST /api/usuarios/invite`, `DELETE /api/usuarios/:id`
- `GET /api/tipoUsuarios`
- `GET/POST/PUT/DELETE /api/huespedes`
- `GET/POST/PUT/DELETE /api/habitaciones`
- `GET/POST/PUT/DELETE /api/tipoHabitacion`
- `GET/POST /api/estadoReserva`
- `GET/POST/PUT/DELETE /api/reservas` y acciones de estado (`confirmar`, `checkin`, `checkout`, `cancelar`, `rechazar`)
- `GET /api/dashboards/summary`
- `GET /api/contable/resumen`, `GET /api/contable/exportar`, `GET /api/contable/ocupacion`

## Reglas de negocio relevantes

- No se admiten reservas solapadas por habitacion.
- `fechaHasta` debe ser posterior a `fechaDesde`.
- Validacion de DNI en lista de huespedes no deseados.
- Manejo de estados de reserva y transiciones segun flujo operativo.
- Auditoria de acciones relevantes.

## Nota de documentacion

Actualmente no se incluye `swagger.json` en el repositorio. Este README actua como referencia funcional de la API.
