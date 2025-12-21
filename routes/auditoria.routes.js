import express from "express";
import { getAllAuditorias } from "../controllers/Auditoria.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

const tipoModelo = "auditoria";

router.get("/", authorize(tipoModelo, "read"), getAllAuditorias);

export default router;
