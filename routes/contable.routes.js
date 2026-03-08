import { Router } from "express";
import { getContableResumen, getContableExportar, getContableOcupacion } from "../controllers/index.js";

const router = Router();

/**
 * GET /api/contable/resumen?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Resumen contable: totales por estado de reserva.
 */
router.get('/resumen', getContableResumen);

/**
 * GET /api/contable/exportar?from=YYYY-MM-DD&to=YYYY-MM-DD&estado=pendiente
 * Listado detallado de reservas para exportar.
 */
router.get('/exportar', getContableExportar);

/**
 * GET /api/contable/ocupacion?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Ocupación de habitaciones día a día.
 */
router.get('/ocupacion', getContableOcupacion);

export default router;
