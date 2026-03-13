// controllers/dashboard.controller.js (ESM, tidy + validations)

/**
 * @file Endpoint de Dashboard summary
 */

import {
  normalizeRange,
  getTotals,
  getTelemetry,
  getCurrentHabitacionesOcupadasCount,
  getTotalRoomsCount,
  sanitizeArgs
} from '../helpers/index.js'; // ← importante la extensión .js

// ─────────────────────────────────────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resumen de dashboard: totales, ocupación actual y series de telemetría.
 *
 * @route GET /dashboard/summary
 * @query {string} [from] ISO YYYY-MM-DD (inicio). Default: hoy-29 días.
 * @query {string} [to]   ISO YYYY-MM-DD (fin).    Default: hoy.
 * @query {'day'|'week'|'month'|'year'} [agruparPor='day'] Granularidad si no se usa bucketDays.
 * @query {'pagado'|'estado'} [ventaBy='pagado'] Cómo contar “ventas” (pagos>0 o por estado).
 * @query {number} [bucketDays] Tamaño fijo del bucket en días (tiene prioridad sobre agruparPor).
 * @query {'auto'|'month'|'monthShort'|'year'|'date'|'dateShort'|'weekRange'|'range'} [label='auto'] Formato de etiqueta.
 * @query {string} [locale='es-AR'] Locale para etiquetas.
 * @returns {Object} { range, totals, lastUpdated }
 */
export async function getDashboardSummary(req, res, next) {
  try {
    const { from, to } = req.query;
    const { agruparPor, ventaBy, label, locale, nBucket } = sanitizeArgs(req.query);

    // Validación fuerte de bucketDays (si vino no numérico, 400)
    if (req.query.bucketDays !== undefined && Number.isNaN(nBucket)) {
      return res.status(400).json({ error: 'bucketDays debe ser un número' });
    }

    const { start, end } = normalizeRange(from, to);

    const [totals, habitacionesOcupadas, totalHabitaciones, telemetria] = await Promise.all([
      getTotals({ start, end, ventaBy }),
      getCurrentHabitacionesOcupadasCount(),
      getTotalRoomsCount(),
      getTelemetry({ start, end, agruparPor, ventaBy, bucketDays: nBucket, label, locale }),
    ]);

    const tasaDeOcupacion = totalHabitaciones > 0
      ? (habitacionesOcupadas / totalHabitaciones)
      : 0;

    return res.json({
      range: {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      },
      totals: {
        telemetria,
        reservas: totals.reservasTotal,
        huespedes: totals.huespedesTotal,
        nochesPromedioEstadia: +Number(totals.nochesPromedioEstadia || 0).toFixed(2),
        ventas: totals.ventasTotal,
        montoPagado: totals.montoPagado,
        montoTotal: totals.montoTotal,
        habitacionesOcupadas,
        totalHabitaciones,
        tasaDeOcupacion,                       // 0..1
        tasaDeOcupacionPct: +(tasaDeOcupacion * 100).toFixed(2),
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
}
