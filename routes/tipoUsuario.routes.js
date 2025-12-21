import { Router } from "express";
import { getAllTiposUsuario } from "../controllers/index.js";
import { verifyJWT } from "../middlewares/verifyJWT.js";

const router = Router();

router.use(verifyJWT);

router.get("/",  getAllTiposUsuario);

export default router;
