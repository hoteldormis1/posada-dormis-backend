// routes/public.routes.js
import { Router } from "express";
import {
	getHabitacionesDisponiblesPublico
} from "../controllers/habitacion.controller.js";
import {
	createReservaPublica
} from "../controllers/reserva.controller.js";

const router = Router();

// Buscar habitaciones disponibles por rango de fechas (público)
router.get("/habitaciones/disponibles", getHabitacionesDisponiblesPublico);

// Crear reserva pública
router.post("/reservas", createReservaPublica);

export default router;

