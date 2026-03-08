// controllers/contable.controller.js (ESM)

/**
 * @file Endpoints de Contabilidad y Reportes
 */

import { normalizeRange } from '../helpers/index.js';
import { getResumenContable, getReservasParaExportar, getOcupacionPorFecha } from '../helpers/contable.helper.js';

const parseEstadosQuery = (query) => {
  const csv = String(query?.estados || "").trim();
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /contable/resumen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resumen contable: totales por estado de reserva y totales generales.
 *
 * @route GET /contable/resumen
 * @query {string} [from] ISO YYYY-MM-DD (inicio). Default: hoy - 29 días.
 * @query {string} [to]   ISO YYYY-MM-DD (fin).    Default: hoy.
 */
export async function getContableResumen(req, res, next) {
  try {
    const { from, to } = req.query;
    const { start, end } = normalizeRange(from, to);
    const estadoNombres = parseEstadosQuery(req.query);

    const resumen = await getResumenContable({ start, end, estadoNombres });

    return res.json({
      range: {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      },
      ...resumen,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /contable/exportar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Listado de reservas detallado para exportar a CSV/PDF.
 *
 * @route GET /contable/exportar
 * @query {string} [from] ISO YYYY-MM-DD (inicio). Default: hoy - 29 días.
 * @query {string} [to]   ISO YYYY-MM-DD (fin).    Default: hoy.
 * @query {string} [estado] Nombre del estado para filtrar (pendiente, confirmada, cancelada, etc.)
 */
/**
 * Ocupación de habitaciones por fecha.
 *
 * @route GET /contable/ocupacion
 * @query {string} [from] ISO YYYY-MM-DD
 * @query {string} [to]   ISO YYYY-MM-DD
 */
export async function getContableOcupacion(req, res, next) {
  try {
    const { from, to } = req.query;
    const { start, end } = normalizeRange(from, to);

    const serie = await getOcupacionPorFecha({ start, end });

    return res.json({
      range: {
        from: start.toISOString().slice(0, 10),
        to:   end.toISOString().slice(0, 10),
      },
      serie,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getContableExportar(req, res, next) {
  try {
    const { from, to, estado } = req.query;
    const { start, end } = normalizeRange(from, to);
    const estadosFromQuery = parseEstadosQuery(req.query);

    const reservas = await getReservasParaExportar({
      start,
      end,
      estadoNombre: estado || null,
      estadoNombres: estadosFromQuery,
    });

    return res.json({
      range: {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      },
      total: reservas.length,
      reservas,
    });
  } catch (err) {
    return next(err);
  }
}
