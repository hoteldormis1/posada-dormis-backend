// src/routes/habitacion.routes.js
import { Router } from "express";
import {
	getAllHabitaciones,
	createHabitacion,
	updateHabitacion,
	deleteHabitacion,
	getHabitacionesDisponiblesPorDia,
} from "../controllers/index.js";
import { auditLogger } from "../middlewares/auditLogger.js";
import { CREATE_ROOM, DELETE_ROOM, UPDATE_ROOM } from "../constants/index.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

const tipoModelo = "habitacion";

router.get("/", authorize(tipoModelo, "read"), getAllHabitaciones);

// Crear habitación
router.post("/", authorize(tipoModelo, "create"), auditLogger(CREATE_ROOM), createHabitacion);

// Actualizar habitación →
router.put("/:id", authorize(tipoModelo, "update"), auditLogger(UPDATE_ROOM), updateHabitacion);

router.get("/disponibles", authorize(tipoModelo, "read"), getHabitacionesDisponiblesPorDia);

// Eliminar habitación
router.delete("/:id", authorize(tipoModelo, "delete"), auditLogger(DELETE_ROOM), deleteHabitacion);

export default router;
