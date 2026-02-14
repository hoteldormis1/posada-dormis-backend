// helpers/contable.helper.js (ESM)
import { Op, fn, col, literal } from 'sequelize';
import { Reserva, EstadoReserva, Huesped, Habitacion, TipoHabitacion } from '../models/index.js';
import { normalizeRange } from './dashboard.helper.js';

// ─────────────────────────── Resumen contable ───────────────────────────

/**
 * Devuelve totales agrupados por estado de reserva dentro de un rango de fechas.
 * Cada estado incluye: cantidad de reservas, montoTotal, montoPagado, y saldo pendiente.
 */
export async function getResumenContable({ start, end }) {
  const whereRange = {
    fechaDesde: { [Op.lte]: end },
    fechaHasta: { [Op.gte]: start },
  };

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

  return { estados, totalGeneral };
}

// ─────────────────────────── Listado para exportar ───────────────────────────

/**
 * Devuelve un listado detallado de reservas para exportación (CSV/PDF).
 * Incluye datos del huésped, habitación, tipo, estado, montos y fechas.
 */
export async function getReservasParaExportar({ start, end, estadoNombre }) {
  const whereRange = {
    fechaDesde: { [Op.lte]: end },
    fechaHasta: { [Op.gte]: start },
  };

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
      ...(estadoNombre
        ? { where: { nombre: estadoNombre } }
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
