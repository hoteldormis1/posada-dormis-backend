// routes/public.routes.js
import { Router } from "express";
import {
	getHabitacionesDisponiblesPublico
} from "../controllers/habitacion.controller.js";
import {
	createReservaPublica,
	confirmarReservaPublica,
	cancelarPendientePublica,
} from "../controllers/reserva.controller.js";
import {
	buscarHuespedPorDni,
	verificarTelefonoHuesped,
} from "../controllers/huesped.controller.js";

const router = Router();

// Buscar habitaciones disponibles por rango de fechas (público)
router.get("/habitaciones/disponibles", getHabitacionesDisponiblesPublico);

// Crear reserva pública → valida, guarda pendiente y envía email de confirmación de identidad
router.post("/reservas", createReservaPublica);

// Confirmar identidad → crea la reserva real y notifica a la posada
router.get("/reservas/confirmar", confirmarReservaPublica);

// Cancelar solicitud pendiente (enlace "No fui yo" del email)
router.get("/reservas/cancelar-pendiente", cancelarPendientePublica);

// ── Lookup de huésped para pre-llenar formulario ──────────────────────────────

// Paso 1: verificar si existe un huésped con ese DNI (solo retorna true/false)
router.post("/huespedes/buscar-dni", buscarHuespedPorDni);

// Paso 2: confirmar identidad con DNI + teléfono → devuelve datos si coinciden
router.post("/huespedes/verificar-telefono", verificarTelefonoHuesped);

export default router;

