import { Router } from "express";
import {
	getAllEstadosDeReserva,
	createEstadoDeReserva,
} from "../controllers/index.js";
import { CREATE_ROOM_TYPE } from "../constants/auditTypes.js";
import { auditLogger } from "../middlewares/auditLogger.js";
import { authorize } from "../middlewares/authorize.js";

const tipoModelo = "estadoReserva";

const router = Router();
router.get("/", authorize(tipoModelo, "read"), getAllEstadosDeReserva);
router.post("/", authorize(tipoModelo, "create"), auditLogger(CREATE_ROOM_TYPE), createEstadoDeReserva);

export default router;
