import { Router } from "express";
import {
	getAllHuespedNoDeseado,
	createHuespedNoDeseado,
	updateHuespedNoDeseado,
	deleteHuespedNoDeseado,
} from "../controllers/huespedNoDeseado.controller.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

router.use(verifyJWT);

const tipoModelo = "huespedNoDeseado";

router.get("/", authorize(tipoModelo, "read"), getAllHuespedNoDeseado);
router.post("/", authorize(tipoModelo, "create"), createHuespedNoDeseado);
router.put("/:id", authorize(tipoModelo, "update"), updateHuespedNoDeseado);
router.delete("/:id", authorize(tipoModelo, "delete"), deleteHuespedNoDeseado);

export default router;
