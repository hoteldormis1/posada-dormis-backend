import { Router } from "express";
import {
	getAllUsuarios,
	deleteUsuario,
	getCurrentUsuario,
} from "../controllers/usuario.controller.js";
import { inviteUsuario } from "../controllers/usuarioInvite.controller.js";
import { auditLogger } from "../middlewares/auditLogger.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";
import { authorize } from "../middlewares/authorize.js";
import { DELETE_USUARIO } from "../constants/index.js";

const router = Router();

// Aseguramos que req.user esté poblado antes de auditar
router.use(verifyJWT);

const tipoModelo = "usuario";

router.get("/", authorize(tipoModelo, "read"), getAllUsuarios);

router.get("/me", authorize(tipoModelo, "read"), getCurrentUsuario);

// Invitar usuario (crea o regenera token y envía mail)
router.post("/invite", authorize(tipoModelo, "create"), inviteUsuario);

// Eliminar usuario → registra auditoría DELETE_USUARIO
router.delete("/:id", authorize(tipoModelo, "delete"), auditLogger(DELETE_USUARIO), deleteUsuario);

export default router;
