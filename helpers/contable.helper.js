// helpers/contable.helper.js (ESM)
import { Op, fn, col, literal, QueryTypes, where as sqlWhere } from 'sequelize';
import { Reserva, EstadoReserva, Huesped, Habitacion, TipoHabitacion } from '../models/index.js';
import { sequelize } from '../db.js';
import { normalizeRange } from './dashboard.helper.js';

// ─────────────────────────── Resumen contable ───────────────────────────

/**
 * Devuelve totales agrupados por estado de reserva dentro de un rango de fechas.
 * Cada estado incluye: cantidad de reservas, montoTotal, montoPagado, y saldo pendiente.
 */
export async function getResumenContable({ start, end, estadoNombres = [] }) {
  const whereRange = {
    fechaDesde: { [Op.lte]: end },
    fechaHasta: { [Op.gte]: start },
  };
  const estadosNormalizados = (estadoNombres || [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);

  // Totales por estado
  const porEstado = await Reserva.findAll({
    attributes: [
      'idEstadoReserva',
      [fn('COUNT', col('Reserva.idReserva')), 'cantidad'],
      [fn('COALESCE', fn('SUM', col('montoTotal')), 0), 'montoTotal'],
      [fn('COALESCE', fn('SUM', col('montoPagado')), 0), 'montoPagado'],
    ],
    where: whereRange,
    include: [
      {
        model: EstadoReserva,
        attributes: ['nombre', 'descripcion'],
        ...(estadosNormalizados.length
          ? {
              where: sqlWhere(fn('LOWER', col('EstadoReserva.nombre')), {
                [Op.in]: estadosNormalizados,
              }),
            }
          : {}),
      },
    ],
    group: ['Reserva.idEstadoReserva', 'EstadoReserva.idEstadoReserva'],
    raw: true,
    nest: true,
  });

  // Totales generales
  const [totalesGenerales] = await Reserva.findAll({
    attributes: [
      [fn('COUNT', col('idReserva')), 'cantidad'],
      [fn('COALESCE', fn('SUM', col('montoTotal')), 0), 'montoTotal'],
      [fn('COALESCE', fn('SUM', col('montoPagado')), 0), 'montoPagado'],
    ],
    where: whereRange,
    raw: true,
  });

  const estados = porEstado.map((row) => ({
    idEstadoReserva: row.idEstadoReserva,
    nombre: row.EstadoReserva?.nombre || 'desconocido',
    descripcion: row.EstadoReserva?.descripcion || '',
    cantidad: Number(row.cantidad || 0),
    montoTotal: Number(row.montoTotal || 0),
    montoPagado: Number(row.montoPagado || 0),
    saldoPendiente: Number(row.montoTotal || 0) - Number(row.montoPagado || 0),
  }));

  const totalGeneral = {
    cantidad: Number(totalesGenerales?.cantidad || 0),
    montoTotal: Number(totalesGenerales?.montoTotal || 0),
    montoPagado: Number(totalesGenerales?.montoPagado || 0),
    saldoPendiente:
      Number(totalesGenerales?.montoTotal || 0) - Number(totalesGenerales?.montoPagado || 0),
  };

  // Serie diaria de reservas por fecha
  // TO_CHAR garantiza que pg devuelva un string 'YYYY-MM-DD' en lugar de un Date object
  const porFecha = await Reserva.findAll({
    attributes: [
      [literal(`TO_CHAR("fechaDesde" AT TIME ZONE 'UTC', 'YYYY-MM-DD')`), 'fecha'],
      [fn('COUNT', col('idReserva')), 'cantidad'],
    ],
    where: {
      fechaDesde: { [Op.between]: [start, end] },
    },
    group: [literal(`TO_CHAR("fechaDesde" AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)],
    order: [[literal(`TO_CHAR("fechaDesde" AT TIME ZONE 'UTC', 'YYYY-MM-DD')`), 'ASC']],
    raw: true,
  });

  const serieReservasPorFecha = porFecha.map((row) => ({
    fecha: String(row.fecha),
    cantidad: Number(row.cantidad || 0),
  }));

  return { estados, totalGeneral, serieReservasPorFecha };
}

// ─────────────────────────── Listado para exportar ───────────────────────────

/**
 * Devuelve un listado detallado de reservas para exportación (CSV/PDF).
 * Incluye datos del huésped, habitación, tipo, estado, montos y fechas.
 */
export async function getReservasParaExportar({ start, end, estadoNombre, estadoNombres = [] }) {
  const whereRange = {
    fechaDesde: { [Op.lte]: end },
    fechaHasta: { [Op.gte]: start },
  };
  const estadosNormalizados = (estadoNombres || [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);

  const include = [
    {
      model: Huesped,
      attributes: ['nombre', 'apellido', 'dni', 'telefono', 'origen', 'email'],
    },
    {
      model: Habitacion,
      attributes: ['numero'],
      include: [
        {
          model: TipoHabitacion,
          attributes: ['nombre', 'precio'],
        },
      ],
    },
    {
      model: EstadoReserva,
      attributes: ['nombre', 'descripcion'],
      ...((estadoNombre || estadosNormalizados.length)
        ? {
            where: estadoNombre
              ? sqlWhere(fn('LOWER', col('EstadoReserva.nombre')), {
                  [Op.eq]: String(estadoNombre).trim().toLowerCase(),
                })
              : sqlWhere(fn('LOWER', col('EstadoReserva.nombre')), {
                  [Op.in]: estadosNormalizados,
                }),
          }
        : {}),
    },
  ];

  const reservas = await Reserva.findAll({
    where: whereRange,
    include,
    order: [['fechaDesde', 'ASC']],
    raw: true,
    nest: true,
  });

  return reservas.map((r) => ({
    idReserva: r.idReserva,
    huesped: `${r.Huesped?.nombre || ''} ${r.Huesped?.apellido || ''}`.trim(),
    dni: r.Huesped?.dni || '',
    telefono: r.Huesped?.telefono || '',
    email: r.Huesped?.email || '',
    origen: r.Huesped?.origen || '',
    habitacion: r.Habitacion?.numero || '',
    tipoHabitacion: r.Habitacion?.TipoHabitacion?.nombre || '',
    precioNoche: r.Habitacion?.TipoHabitacion?.precio || 0,
    estado: r.EstadoReserva?.nombre || '',
    fechaDesde: r.fechaDesde,
    fechaHasta: r.fechaHasta,
    montoTotal: Number(r.montoTotal || 0),
    montoPagado: Number(r.montoPagado || 0),
    saldoPendiente: Number(r.montoTotal || 0) - Number(r.montoPagado || 0),
  }));
}

// ─────────────────────────── Ocupación por fecha ───────────────────────────

/**
 * Para cada día en [start, end] devuelve cuántas habitaciones estaban ocupadas
 * y el porcentaje sobre el total. Usa generate_series para no saltear días sin reservas.
 */
export async function getOcupacionPorFecha({ start, end }) {
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);

  const rows = await sequelize.query(
    `
    WITH dates AS (
      SELECT generate_series(
        :start::date,
        :end::date,
        INTERVAL '1 day'
      )::date AS fecha
    ),
    total_hab AS (
      SELECT COUNT(*) AS total FROM "Habitacion"
    ),
    ocupados AS (
      SELECT
        d.fecha,
        COUNT(DISTINCT r."idHabitacion") AS ocupadas
      FROM dates d
      LEFT JOIN "Reserva" r
        ON r."fechaDesde"::date <= d.fecha
       AND r."fechaHasta"::date >= d.fecha
      GROUP BY d.fecha
    )
    SELECT
      TO_CHAR(o.fecha, 'YYYY-MM-DD')        AS fecha,
      o.ocupadas::int                        AS ocupadas,
      t.total::int                           AS total,
      ROUND(
        o.ocupadas::numeric / NULLIF(t.total, 0) * 100, 1
      )                                      AS porcentaje
    FROM ocupados o
    CROSS JOIN total_hab t
    ORDER BY o.fecha
    `,
    {
      replacements: { start: startISO, end: endISO },
      type: QueryTypes.SELECT,
    }
  );

  return rows.map((r) => ({
    fecha: String(r.fecha),
    ocupadas: Number(r.ocupadas || 0),
    total: Number(r.total || 0),
    porcentaje: Number(r.porcentaje || 0),
  }));
}
