import { Router } from "express";
import {
	getAllReservas,
	getReservasCalendar,
	createReserva,
	updateReserva,
	deleteReserva,
	getReservasCalendar2,
	checkinReserva,
	checkoutReserva,
	confirmarReserva,
	cancelarReserva,
} from "../controllers/index.js";
import { auditLogger } from "../middlewares/auditLogger.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
import {
	CREATE_RESERVATION,
	DELETE_RESERVATION,
	UPDATE_RESERVATION,
} from "../constants/auditTypes.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

// Poblamos req.user antes de auditar
router.use(verifyJWT);

const tipoModelo = "reserva";

// Listar reservas
router.get("/", authorize(tipoModelo, "read"), getAllReservas);

// Calendario de días completamente ocupados
router.get("/calendar", authorize(tipoModelo, "read"), getReservasCalendar2);

// Crear reserva
router.post("/", authorize(tipoModelo, "create"), auditLogger(CREATE_RESERVATION), createReserva);

// Actualizar reserva
router.put("/:id", authorize(tipoModelo, "update"), auditLogger(UPDATE_RESERVATION), updateReserva);

// Confirmar reserva
router.put("/:id/confirmar", authorize(tipoModelo, "update"), auditLogger(UPDATE_RESERVATION), confirmarReserva);

// Check-in
router.put("/:id/checkin", authorize(tipoModelo, "update"), auditLogger(UPDATE_RESERVATION), checkinReserva);

// Check-out
router.put("/:id/checkout", authorize(tipoModelo, "update"), auditLogger(UPDATE_RESERVATION), checkoutReserva);

// Cancelar reserva
router.put("/:id/cancelar", authorize(tipoModelo, "update"), auditLogger(UPDATE_RESERVATION), cancelarReserva);

// Eliminar reserva
router.delete("/:id", authorize(tipoModelo, "delete"), auditLogger(DELETE_RESERVATION), deleteReserva);

export default router;
