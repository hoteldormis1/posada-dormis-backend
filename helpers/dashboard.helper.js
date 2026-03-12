// helpers/dashboard.helpers.js (ESM)
import { Op, fn, col, literal, where as sqlWhere } from 'sequelize';
import { Habitacion, Reserva } from '../models/index.js';
import { sequelize } from '../db.js';

// Config
export const GRAN_MAP = { day: 'day', week: 'week', month: 'month', year: 'year' };
export const ESTADOS_VENTA_IDS = []; // p.ej. [2,3] si contás ventas por estado
let timelineColumnCache = null;

// ─────────────────────────── Utils de fecha ───────────────────────────
export function parseDateISO(d) {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
}

export function normalizeRange(fromStr, toStr) {
    const now = new Date();
    const to = parseDateISO(toStr) || now;
    const from =
        parseDateISO(fromStr) ||
        new Date(to.getFullYear(), to.getMonth(), to.getDate() - 29);

    const start = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0));
    const end = new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59));
    return { start, end };
}

// ─────────────────────────── Helpers de filtro ─────────────────────────
export function whereRangoSolapado(start, end) {
    return {
        fechaDesde: { [Op.lte]: end },
        fechaHasta: { [Op.gte]: start },
    };
}

export function whereVenta(baseWhere, ventaBy) {
    if (ventaBy === 'estado' && ESTADOS_VENTA_IDS.length) {
        return { ...baseWhere, idEstadoReserva: { [Op.in]: ESTADOS_VENTA_IDS } };
    }
    return { ...baseWhere, montoPagado: { [Op.gt]: 0 } };
}

async function resolveTimelineColumn() {
    if (timelineColumnCache) return timelineColumnCache;

    try {
        const qi = sequelize.getQueryInterface();
        const cols = await qi.describeTable('Reserva');
        const candidates = ['fechaCreacion', 'createdAt', 'created_at'];
        const found = candidates.find((c) => Object.prototype.hasOwnProperty.call(cols, c));
        timelineColumnCache = found || 'fechaDesde';
    } catch {
        timelineColumnCache = 'fechaDesde';
    }

    return timelineColumnCache;
}

function buildTimelineWhere(start, end, timelineColumn) {
    return {
        [Op.and]: [
            sqlWhere(col(timelineColumn), { [Op.gte]: start }),
            sqlWhere(col(timelineColumn), { [Op.lte]: end }),
        ],
    };
}

// ─────────────── Helpers de formateo de labels/fechas ────────────────
export function ddmmy(d, locale = 'es-AR') {
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
}
export function isoDate(d) {
    return d.toISOString().slice(0, 10);
}
export function monthLabel(d, locale = 'es-AR', short = false) {
    const s = d.toLocaleDateString(locale, { month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' });
    return s.replace(' de ', ' ');
}
export function clampToEnd(d, end) {
    return end && d > end ? new Date(end) : d;
}

export function formatBucketLabel(bucketISO, { agruparPor, bucketDays, end, label = 'auto', locale = 'es-AR' }) {
    const start = new Date(bucketISO);
    const hasBuckets = Number(bucketDays) > 0;

    let mode = label;
    if (label === 'auto') {
        if (hasBuckets) mode = 'range';
        else if ((agruparPor || 'day') === 'month') mode = 'monthShort';
        else if (agruparPor === 'week') mode = 'weekRange';
        else if (agruparPor === 'year') mode = 'year';
        else mode = 'dateShort';
    }

    if (mode === 'month' || mode === 'monthShort') return monthLabel(start, locale, mode === 'monthShort');
    if (mode === 'year') return start.toLocaleDateString(locale, { year: 'numeric', timeZone: 'UTC' });
    if (mode === 'date') return isoDate(start);
    if (mode === 'dateShort') return ddmmy(start, locale);
    if (mode === 'weekRange') {
        const endRange = clampToEnd(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6, 0, 0, 0)), end);
        return `${ddmmy(start, locale)}–${ddmmy(endRange, locale)}`;
    }
    if (mode === 'range') {
        const days = Math.max(1, Math.floor(+bucketDays || 1));
        const endRange = clampToEnd(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + (days - 1), 0, 0, 0)), end);
        return `${ddmmy(start, locale)}–${ddmmy(endRange, locale)}`;
    }
    return isoDate(start);
}

// ─────────────────────── Bucket expr (agrupación SQL) ───────────────────────
/**
 * Construye la expresión SQL de bucket para agrupar por día/semana/mes/año o por N días fijos.
 * @param {Object} params
 * @param {'day'|'week'|'month'|'year'} [params.agruparPor]
 * @param {number} [params.bucketDays]
 * @param {string} params.originIso ISO del origen (ancla de buckets)
 * @param {string} params.tsExpr expresión SQL del timestamp a bucketer (ej: `"fechaDesde" AT TIME ZONE 'UTC'"`)
 * @returns {string} SQL literal
 */
export function bucketExprOn({ agruparPor, bucketDays, originIso, tsExpr }) {
    if (Number(bucketDays) > 0) {
        const d = Math.max(1, Math.floor(+bucketDays));
        return `
      (
        DATE_TRUNC('day', '${originIso}'::timestamptz)
        + FLOOR(
            EXTRACT(EPOCH FROM ((${tsExpr}) - '${originIso}'::timestamptz))
            / (${d}*86400)
          ) * INTERVAL '${d} days'
      )
    `;
    }
    const gran = GRAN_MAP[agruparPor] || 'day';
    return `date_trunc('${gran}', ${tsExpr})`;
}

// ───────────────────────────── Servicios/aggregations ─────────────────────────────
export async function getTotals({ start, end, ventaBy }) {
    const timelineColumn = await resolveTimelineColumn();
    const whereAll = buildTimelineWhere(start, end, timelineColumn);
    const reservasTotal = await Reserva.count({ where: whereAll });

    const [agg] = await Reserva.findAll({
        attributes: [
            [fn('COUNT', col('idReserva')), 'ventas'],
            [fn('COALESCE', fn('SUM', col('montoTotal')), 0), 'montoTotal'],
            [fn('COALESCE', fn('SUM', col('montoPagado')), 0), 'montoPagado'],
        ],
        where: whereVenta(whereAll, ventaBy),
        raw: true,
    });

    const huespedesTotal = await Reserva.count({
        distinct: true,
        col: 'idHuesped',
        where: whereAll,
    });

    const [nightsAgg] = await Reserva.findAll({
        attributes: [
            [
                literal('COALESCE(AVG(EXTRACT(EPOCH FROM ("fechaHasta" - "fechaDesde")) / 86400.0), 0)'),
                'nochesPromedioEstadia',
            ],
        ],
        where: whereAll,
        raw: true,
    });

    return {
        reservasTotal,
        ventasTotal: Number(agg?.ventas || 0),
        montoPagado: Number(agg?.montoPagado || 0),
        montoTotal: Number(agg?.montoTotal || 0),
        huespedesTotal,
        nochesPromedioEstadia: Number(nightsAgg?.nochesPromedioEstadia || 0),
    };
}

export async function getTelemetry({
    start,
    end,
    agruparPor,
    ventaBy,
    bucketDays,
    label = 'auto',
    locale = 'es-AR',
}) {
    const originIso = start.toISOString();
    const timelineColumn = await resolveTimelineColumn();

    const bucketSQL = bucketExprOn({
        agruparPor,
        bucketDays,
        originIso,
        tsExpr: `"${timelineColumn}" AT TIME ZONE 'UTC'`,
    });

    const whereTimelineOnly = buildTimelineWhere(start, end, timelineColumn);

    const reservasSeries = await Reserva.findAll({
        attributes: [
            [literal(bucketSQL), 'bucket'],
            [fn('COUNT', col('idReserva')), 'count'],
        ],
        where: whereTimelineOnly,
        group: [literal(bucketSQL)],
        order: [literal(bucketSQL)],
        raw: true,
    });

    const ventasSeries = await Reserva.findAll({
        attributes: [
            [literal(bucketSQL), 'bucket'],
            [fn('COUNT', col('idReserva')), 'count'],
            [fn('COALESCE', fn('SUM', col('montoPagado')), 0), 'sum'],
        ],
        where: whereVenta(whereTimelineOnly, ventaBy),
        group: [literal(bucketSQL)],
        order: [literal(bucketSQL)],
        raw: true,
    });

    const mapRow = (r) => {
        const bucketISO = new Date(r.bucket + 'Z').toISOString();
        return {
            bucket: bucketISO,
            label: formatBucketLabel(bucketISO, { agruparPor, bucketDays, end, label, locale }),
            count: Number(r.count || 0),
            ...(r.sum !== undefined ? { sum: Number(r.sum || 0) } : {}),
        };
    };

    return {
        agruparPor: Number(bucketDays) > 0 ? `${Math.max(1, Math.floor(+bucketDays))}d` : (agruparPor || 'day'),
        timelineColumn,
        reservas: reservasSeries.map(mapRow),
        ventas: ventasSeries.map(mapRow),
    };
}

// ───────────────────────── Ocupación y conteos ─────────────────────────
export async function getCurrentHabitacionesOcupadasCount(now = new Date()) {
    const occupied = await Reserva.count({
        distinct: true,
        col: 'idHabitacion',
        where: {
            fechaDesde: { [Op.lte]: now },
            fechaHasta: { [Op.gt]: now },
        },
    });
    return occupied;
}

export function getTotalRoomsCount() {
    return Habitacion.count();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers locales de validación
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_GRAN = new Set(['day', 'week', 'month', 'year']);
const ALLOWED_VENTA_BY = new Set(['pagado', 'estado']);
const ALLOWED_LABEL = new Set([
    'auto', 'month', 'monthShort', 'year', 'date', 'dateShort', 'weekRange', 'range',
]);

export function pickLocale(reqLocale, fallback = 'es-AR') {
    // admite "es-AR", "en-US", etc. Si viene vacío/devuelve fallback
    if (typeof reqLocale !== 'string' || !reqLocale.trim()) return fallback;
    return reqLocale.trim();
}

export function parseBucketDays(v) {
    if (v === undefined || v === null || v === '') return 0;
    const n = Number(v);
    if (!Number.isFinite(n)) return NaN;
    if (n <= 0) return 0;          // normalizamos no-positivos a 0 (= desactivar)
    return Math.floor(n);          // buckets enteros
}

export function sanitizeArgs(qs) {
    const agruparPor = ALLOWED_GRAN.has(qs.agruparPor) ? qs.agruparPor : 'day';
    const ventaBy = ALLOWED_VENTA_BY.has(qs.ventaBy) ? qs.ventaBy : 'pagado';
    const label = ALLOWED_LABEL.has(qs.label) ? qs.label : 'auto';
    const locale = pickLocale(qs.locale, 'es-AR');

    const nBucket = parseBucketDays(qs.bucketDays);
    // nBucket puede ser NaN si mandan porquería
    return { agruparPor, ventaBy, label, locale, nBucket };
}