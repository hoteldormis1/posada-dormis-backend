# 📘 Documentación de la API

---

## 🔐 Auth (sin JWT)

| Método | Ruta                 | Descripción                                        |
|--------|----------------------|----------------------------------------------------|
| POST   | `/api/auth/login`    | Iniciar sesión, devuelve `accessToken` y cookie de `refreshToken` |
| POST   | `/api/auth/refresh`  | Refrescar `accessToken` usando cookie             |
| POST   | `/api/auth/logout`   | Cerrar sesión (elimina cookie)                    |
| POST   | `/api/auth/register` | Registrar nuevo usuario                           |

---

## 👤 Usuarios

| Método | Ruta                    | Descripción                 |
|--------|-------------------------|-----------------------------|
| GET    | `/api/usuarios`         | Listar todos los usuarios   |
| DELETE | `/api/usuarios/:id`     | Eliminar usuario por id     |

---

## 👥 Tipos de Usuario

| Método | Ruta                      | Descripción                   |
|--------|---------------------------|-------------------------------|
| GET    | `/api/tipoUsuarios`       | Listar todos los tipos de usuario |

---

## 🏨 Habitaciones

| Método | Ruta                         | Descripción                           |
|--------|------------------------------|---------------------------------------|
| GET    | `/api/habitaciones`          | Listar todas las habitaciones         |
| GET    | `/api/habitaciones/:id`      | Obtener detalle de una habitación     |
| POST   | `/api/habitaciones`          | Crear nueva habitación                |
| PUT    | `/api/habitaciones/:id`      | Actualizar habitación existente       |
| DELETE | `/api/habitaciones/:id`      | Eliminar habitación por id            |

---

## 🚪 Estados de Habitación

| Método | Ruta                             | Descripción                         |
|--------|----------------------------------|-------------------------------------|
| GET    | `/api/estadoReservas`        | Listar todos los estados de habitación |

---

## 🛏️ Tipos de Habitación

| Método | Ruta                              | Descripción                         |
|--------|-----------------------------------|-------------------------------------|
| GET    | `/api/tipoHabitaciones`           | Listar todos los tipos de habitación |
| GET    | `/api/tipoHabitaciones/:id`       | Obtener detalle de un tipo          |

---

## 🧳 Huéspedes

| Método | Ruta                     | Descripción                        |
|--------|--------------------------|------------------------------------|
| GET    | `/api/huespedes`         | Listar todos los huéspedes         |
| GET    | `/api/huespedes/:id`     | Obtener un huésped por id          |
| POST   | `/api/huespedes`         | Crear nuevo huésped                |

---

## 📅 Reservas

| Método | Ruta                           | Descripción                            |
|--------|--------------------------------|----------------------------------------|
| GET    | `/api/reservas`               | Listar todas las reservas              |
| GET    | `/api/reservas/calendar`      | Obtener fechas totalmente ocupadas     |
| POST   | `/api/reservas`               | Crear nueva reserva                    |
| PUT    | `/api/reservas/:id`           | Actualizar reserva por id              |
| DELETE | `/api/reservas/:id`           | Eliminar reserva por id                |
