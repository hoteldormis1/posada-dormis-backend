import express from "express";
import usuarioRouter from "./usuario.routes.js";
import tipoUsuarioRouter from "./tipoUsuario.routes.js";
import huespedRouter from "./huesped.routes.js";
import reservaRouter from "./reserva.routes.js";
import habitacionRouter from "./habitacion.routes.js";
import tipoHabitacionRouter from "./tipoHabitacion.routes.js";
import estadoReservaRouter from "./estadoReserva.routes.js";
import authRouter from "./auth.routes.js";
import auditoriasRouter from "./auditoria.routes.js";
import dashboardRouter from "./dashboard.routes.js";
import publicRouter from "./public.routes.js";
import huespedNoDeseadoRouter from "./huespedNoDeseado.routes.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";

const router = express.Router();

// ⚠️ IMPORTANTE: Las rutas públicas DEBEN ir ANTES de verifyJWT
// Auth routes (login, register, password-reset, etc.)
router.use("/auth", authRouter);

// Public routes (reservas públicas, búsqueda de habitaciones)
router.use("/public", publicRouter);

// 🔒 Todas las rutas DESPUÉS de este middleware requieren autenticación
router.use(verifyJWT);

router.use("/usuarios", usuarioRouter);
router.use("/tipoUsuarios", tipoUsuarioRouter);
router.use("/huespedes", huespedRouter);
router.use("/reservas", reservaRouter);
router.use("/habitaciones", habitacionRouter);
router.use("/tipoHabitacion", tipoHabitacionRouter);
router.use("/estadoReserva", estadoReservaRouter);
router.use("/auditorias", auditoriasRouter);
router.use("/dashboards", dashboardRouter);
router.use("/huespedes-no-deseados", huespedNoDeseadoRouter);

export default router;
