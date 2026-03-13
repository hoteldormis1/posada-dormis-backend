import { Router } from "express";
import { getDashboardSummary } from "../controllers/index.js";

const router = Router();

/**
 * GET /api/dashboards/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&agruparPor=day|week|month|year
 */
router.get('/summary', getDashboardSummary);

export default router;