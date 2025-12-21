// src/routes/huesped.routes.js
import { Router } from "express";
import {
	getAllHuespedes,
	getHuespedById,
	createHuesped,
} from "../controllers/index.js";
import { auditLogger } from "../middlewares/auditLogger.js";
import { CREATE_HUESPED } from "../constants/index.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

const tipoModelo = "huesped";

router.get("/", authorize(tipoModelo, "read"), getAllHuespedes);
router.get("/:id", authorize(tipoModelo, "read"), getHuespedById);

// Crear huésped → registra auditoría "crear huésped"
router.post("/", authorize(tipoModelo, "create"), auditLogger(CREATE_HUESPED), createHuesped);

export default router;
