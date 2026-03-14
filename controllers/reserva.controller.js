import { Reserva } from "../models/reserva.js";
import { Habitacion } from "../models/habitacion.js";
import { Huesped } from "../models/huesped.js";
import { EstadoReserva } from "../models/estadoReserva.js";
import { sequelize } from "../db.js";
import { Op, QueryTypes } from "sequelize";
import { TipoHabitacion } from "../models/tipoHabitacion.js";
import { AppError, ERROR_CODES, notFound, dniExists } from "../errors/AppError.js";
import { isDniBlacklisted } from "./huespedNoDeseado.controller.js";
import {
	enviarEmailAprobacion,
	enviarEmailRechazo,
	enviarEmailCancelacion,
	enviarEmailNuevaSolicitudPosada,
	enviarEmailConfirmacionIdentidad,
} from "../helpers/reservaEmails.js";
import { broadcast } from "../ws.js";
import {
	guardarPendiente,
	obtenerPendiente,
	eliminarPendiente,
} from "../helpers/pendingReservations.js";

const normalizarTelefonoArgentino = (value) => {
	const digits = String(value || "").replace(/\D/g, "");
	return digits.replace(/^549/, "54");
};

const validarHabitacionHabilitada = (habitacion) => {
	if (habitacion?.fueraDeServicio) {
		return {
			error: "La habitación se encuentra fuera de servicio.",
			code: "ROOM_DISABLED",
		};
	}
	return null;
};

/**
 * Obtiene todas las reservas con información del huésped y habitación asociada.
 * 
 * @route GET /reservas
 * @returns {Array<Object>} Lista de reservas formateadas con datos de habitación y huésped.
 */

/**
 * Obtiene solo las reservas con estado "pendiente".
 *
 * @route GET /reservas/pendientes
 */
export const getPendingReservas = async (req, res, next) => {
	try {
		const { EstadoReserva } = await import("../models/estadoReserva.js");

		const estadoPendiente = await EstadoReserva.findOne({
			where: { nombre: { [Op.iLike]: "pendiente" } },
		});

		if (!estadoPendiente) {
			return res.json([]);
		}

		const list = await Reserva.findAll({
			where: { idEstadoReserva: estadoPendiente.idEstadoReserva },
			include: ["Huesped", "Habitacion", "EstadoReserva"],
			order: [["fechaDesde", "ASC"]],
		});

		const reservas = list.map((r) => ({
			id: r.idReserva,
			numeroHab: r.Habitacion?.numero ?? "-",
			ingreso: r.fechaDesde ? r.fechaDesde.toISOString().slice(0, 10) : "-",
			egreso: r.fechaHasta ? r.fechaHasta.toISOString().slice(0, 10) : "-",
			huespedNombre: r.Huesped ? `${r.Huesped.nombre} ${r.Huesped.apellido}` : "-",
			telefonoHuesped: r.Huesped?.telefono ?? "-",
			emailHuesped: r.Huesped?.email ?? null,
			dniHuesped: r.Huesped?.dni ?? "-",
			montoPagado: r.montoPagado,
			total: r.montoTotal,
			estadoDeReserva: "Pendiente",
			idEstadoReserva: r.idEstadoReserva,
		}));

		return res.json(reservas);
	} catch (err) {
		console.error("Error al obtener reservas pendientes:", err);
		return next(err);
	}
};

export const getAllReservas = async (req, res, next) => {
	try {
		const list = await Reserva.findAll({
			include: ["Huesped", "Habitacion", "EstadoReserva"],
		});

		const reservasFormateadas = list.map((r) => ({
			id: r.idReserva,
			idReserva: r.idReserva,
			idHuesped: r.idHuesped,
			idHabitacion: r.idHabitacion,
			fechaDesde: r.fechaDesde ? r.fechaDesde.toISOString().slice(0, 10) : null,
			fechaHasta: r.fechaHasta ? r.fechaHasta.toISOString().slice(0, 10) : null,
			numeroHab: r.Habitacion?.numero ?? "-",
			ingreso: r.fechaDesde ? new Date(r.fechaDesde).toLocaleDateString() : "-",
			egreso: r.fechaHasta ? new Date(r.fechaHasta).toLocaleDateString() : "-",
			huespedNombre: r.Huesped ? `${r.Huesped.nombre} ${r.Huesped.apellido}` : "-",
			telefonoHuesped: r.Huesped?.telefono ?? "-",
			dniHuesped: r.Huesped?.dni ?? "-",
			origenHuesped: r.Huesped?.origen ?? "AR",
			direccionHuesped: r.Huesped?.direccion ?? "",
			montoPagado: r.montoPagado,
			total: r.montoTotal,
			estadoDeReserva: r.EstadoReserva?.nombre
				? r.EstadoReserva.nombre.charAt(0).toUpperCase() + r.EstadoReserva.nombre.slice(1)
				: "-",
			idEstadoReserva: r.idEstadoReserva,
		}));

		return res.json(reservasFormateadas);
	} catch (err) {
		console.error("Error al obtener reservas:", err);
		return next(err);
	}
};

/**
 * GET /api/calendario
 * Query params:
 *  - startDate=YYYY-MM-DD (opcional)
 *  - endDate=YYYY-MM-DD   (opcional)
 *  - habitacionesIds=101,102 (opcional)
 *  - includedStatuses=confirmada,checkin (opcional; si viene, ignora excludedStatuses)
 *  - excludedStatuses=cancelada,anulada  (opcional; default: ["cancelada","canceled","anulada","void"])
 */
export const getReservasCalendar = async (req, res, next) => {
	try {
		const toYMD = (d) => new Date(d).toISOString().slice(0, 10);
		const today = new Date();
		const defaultStart = toYMD(new Date(today.getFullYear(), today.getMonth(), 1));
		const defaultEnd = toYMD(new Date(today.getFullYear(), today.getMonth() + 4, 0));

		const startDate = (req.query.startDate && String(req.query.startDate)) || defaultStart;
		const endDate = (req.query.endDate && String(req.query.endDate)) || defaultEnd;

		// Parsear números de habitación desde query
		const parseNums = (val) => {
			if (!val) return [];
			if (Array.isArray(val)) return val.flatMap(v => String(v).split(",")).map(Number).filter(Number.isFinite);
			if (typeof val === "string") return val.split(",").map(Number).filter(Number.isFinite);
			if (typeof val === "number" && Number.isFinite(val)) return [val];
			return [];
		};
		const numeros = Array.from(new Set(parseNums(req?.query?.habitacionesNumeros)));
		const usarFiltroHabit = numeros.length > 0;

		const includedStatuses = req.query.includedStatuses
			? String(req.query.includedStatuses).split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
			: null;

		const excludedStatuses = !includedStatuses
			? (req.query.excludedStatuses
				? String(req.query.excludedStatuses).split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
				: ["cancelada", "canceled", "anulada", "void", "rechazada"])
			: [];

		// ========== ROOMS ==========
		const roomsSql = `
      SELECT
        h."idHabitacion" AS "id",
        h."numero" AS "numero",
        ('Habitación ' || h."numero") AS "name"
      FROM "Habitacion" h
      WHERE h."deletedAt" IS NULL
      ${usarFiltroHabit ? 'AND h."numero" IN (:numeros)' : ''}
      ORDER BY h."numero";
    `;
		const rooms = await sequelize.query(roomsSql, {
			type: QueryTypes.SELECT,
			replacements: usarFiltroHabit ? { numeros } : {},
		});

		const totalSubset = rooms.length;
		if (!totalSubset) {
			return res.json({
				range: { startDate, endDate, endExclusive: true },
				roomCount: 0,
				rooms: [],
				bookings: [],
				byDate: [],
				fullyBookedDates: [],
			});
		}

		// ========= WHERE compartidos =========
		const habitWhere = usarFiltroHabit ? 'h."numero" IN (:numeros)' : null;

		const estadoWhere = [];
		const estadoRepl = {};
		if (includedStatuses && includedStatuses.length) {
			estadoWhere.push('LOWER(er."nombre") IN (:includedStatuses)');
			estadoRepl.includedStatuses = includedStatuses;
		} else if (excludedStatuses && excludedStatuses.length) {
			estadoWhere.push('LOWER(er."nombre") NOT IN (:excludedStatuses)');
			estadoRepl.excludedStatuses = excludedStatuses;
		}

		const baseOverlap = [
			'r."fechaDesde" < (:endDate::date + INTERVAL \'1 day\')',
			'r."fechaHasta" > :startDate::date',
			...estadoWhere,
		].filter(Boolean).join(' AND ');

		// ========== BOOKINGS ==========
		const bookingsSql = `
      SELECT
        r."idReserva" AS "id",
        h."numero" AS "roomNumber",
        to_char(date_trunc('day', r."fechaDesde"), 'YYYY-MM-DD') AS "start",
        to_char(date_trunc('day', r."fechaHasta"), 'YYYY-MM-DD') AS "end",
        COALESCE(hp."nombre", '') AS "guest",
        r."montoTotal" AS "montoTotal",
        r."montoPagado" AS "montoPagado",
        LOWER(er."nombre") AS "status"
      FROM "Reserva" r
      JOIN "Habitacion" h ON h."idHabitacion" = r."idHabitacion" AND h."deletedAt" IS NULL
      LEFT JOIN "Huesped" hp ON hp."idHuesped" = r."idHuesped"
      JOIN "EstadoReserva" er ON er."idEstadoReserva" = r."idEstadoReserva"
      WHERE r."deletedAt" IS NULL
        AND ${baseOverlap}
      ${usarFiltroHabit ? 'AND h."numero" IN (:numeros)' : ''}
      ORDER BY r."fechaDesde", r."idReserva";
    `;
		const rawBookings = await sequelize.query(bookingsSql, {
			type: QueryTypes.SELECT,
			replacements: {
				startDate,
				endDate,
				...(usarFiltroHabit ? { numeros } : {}),
				...estadoRepl,
			},
		});

		// Normalizamos keys/casting para garantizar que montoPagado siempre viaje al frontend
		const bookings = (rawBookings || []).map((b) => ({
			...b,
		}));

		// ========== BY-DATE ==========
		const byDateSql = `
      WITH days AS (
        SELECT d::date AS day
        FROM generate_series(:startDate::date, :endDate::date, '1 day') AS d
      )
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS "date",
        COUNT(DISTINCT h."numero") AS "roomsReserved",
        ARRAY_AGG(DISTINCT h."numero") AS "roomNumbers"
      FROM days
      LEFT JOIN "Reserva" r
        ON days.day BETWEEN date_trunc('day', r."fechaDesde")
                         AND date_trunc('day', r."fechaHasta")
       AND r."fechaDesde" < (:endDate::date + INTERVAL '1 day')
       AND r."fechaHasta" > :startDate::date
       AND r."deletedAt" IS NULL
      JOIN "Habitacion" h ON h."idHabitacion" = r."idHabitacion" AND h."deletedAt" IS NULL
      LEFT JOIN "EstadoReserva" er ON er."idEstadoReserva" = r."idEstadoReserva"
      ${usarFiltroHabit ? 'AND h."numero" IN (:numeros)' : ""}
      ${estadoWhere.length ? `AND ${estadoWhere.join(" AND ")}` : ""}
      GROUP BY days.day
      ORDER BY days.day;
    `;
		const byDate = await sequelize.query(byDateSql, {
			type: QueryTypes.SELECT,
			replacements: {
				startDate,
				endDate,
				...(usarFiltroHabit ? { numeros } : {}),
				...estadoRepl,
			},
		});

		const fullyBookedDates = byDate
			.filter(d => Number(d.roomsReserved) === totalSubset)
			.map(d => d.date);

		return res.json({
			range: { startDate, endDate, endExclusive: true },
			roomCount: totalSubset,
			rooms,
			bookings,
			byDate,
			fullyBookedDates,
		});
	} catch (err) {
		console.error("Error en calendario:", {
			message: err?.message,
			detail: err?.original?.detail || err?.parent?.detail,
			sql: err?.sql,
			parameters: err?.parameters,
			stack: err?.stack,
		});
		return res.status(500).json({
			error: "Calendario: fallo SQL",
			message: err?.message,
			detail: err?.original?.detail || err?.parent?.detail || null,
			sql: err?.sql || null,
			parameters: err?.parameters || null,
		});
	}
};




/**
 * Crea una nueva reserva, validando y/o creando huésped y calculando el monto total.
 * 
 * @route POST /reservas
 * @body {number} [idHuesped] ID de huésped existente (si no se envía, se crea uno nuevo con datos en `huesped`).
 * @body {Object} [huesped] Datos del huésped a crear (dni, telefono, origen, nombre, apellido).
 * @body {number} idHabitacion ID de la habitación.
 * @body {number} idEstadoReserva ID del estado de la reserva.
 * @body {string} fechaDesde Fecha de inicio (YYYY-MM-DD).
 * @body {string} fechaHasta Fecha de fin (YYYY-MM-DD).
 * @body {number} montoPagado Monto pagado como seña.
 * @returns {Object} Datos completos de la reserva creada.
 */

export const createReserva = async (req, res, next) => {
	let {
		idHuesped,
		huesped: huespedData,
		idHabitacion,
		idEstadoReserva,
		fechaDesde,
		fechaHasta,
		montoPagado,
	} = req.body;

	try {
		// --- Normalizá fechas a Date (recomendado: validar formato antes) ---
		const start = new Date(fechaDesde);
		const end = new Date(fechaHasta);

		// 0) Validación mínima de fechas
		if (!(start instanceof Date) || isNaN(start) || !(end instanceof Date) || isNaN(end)) {
			return res.status(400).json({ error: "Fechas inválidas" });
		}
		// Calcular noches comparando solo la parte de fecha en UTC (evita desfases por UTC-3 Argentina)
		const soloFechaUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
		const noches = Math.round((soloFechaUTC(end) - soloFechaUTC(start)) / 86_400_000);
		if (noches <= 0) return res.status(400).json({ error: "Rango de fechas inválido" });
		if (noches < 2) return res.status(400).json({ error: "La estadía mínima es de 2 noches" });
		const dias = noches; // alias para el cálculo de montoTotal

		// 🔒 0.1) CHEQUEO DE SOLAPAMIENTO (ANTES de crear huésped/hacer más trabajo)
		// Excluye reservas canceladas y rechazadas para no bloquear fechas ya liberadas.
		const estadosInactivos = await EstadoReserva.findAll({
			where: { nombre: { [Op.in]: ["cancelada", "rechazada"] } },
			attributes: ["idEstadoReserva"],
		});
		const idsInactivos = estadosInactivos.map((e) => e.idEstadoReserva);

		const reservaSolapada = await Reserva.findOne({
			where: {
				idHabitacion,
				...(idsInactivos.length ? { idEstadoReserva: { [Op.notIn]: idsInactivos } } : {}),
				[Op.and]: [
					{ fechaDesde: { [Op.lt]: end } }, // existing.start < new.end
					{ fechaHasta: { [Op.gt]: start } } // existing.end > new.start
				],
			},
			include: [
				{ model: Huesped, attributes: ["nombre", "apellido", "telefono"] },
				{ model: Habitacion, attributes: ["numero"] }
			]
		});

		if (reservaSolapada) {
			return res.status(409).json({
				error: "La habitación ya está reservada en esas fechas.",
				conflicto: {
					idReserva: reservaSolapada.idReserva,
					habitacion: reservaSolapada.Habitacion?.numero,
					desde: reservaSolapada.fechaDesde,
					hasta: reservaSolapada.fechaHasta,
					huesped: reservaSolapada.Huesped
						? `${reservaSolapada.Huesped.nombre} ${reservaSolapada.Huesped.apellido}`
						: undefined,
				}
			});
		}

		// 1) Verificar lista negra y crear o validar huésped
		const dniToCheck = huespedData?.dni || (idHuesped ? (await Huesped.findByPk(idHuesped))?.dni : null);
		if (dniToCheck && await isDniBlacklisted(dniToCheck)) {
			return res.status(403).json({
				error: "Este huésped se encuentra en la lista de no deseados. No se puede crear la reserva.",
				code: "DNI_BLACKLISTED",
			});
		}

		if (!idHuesped) {
			const required = ["dni", "telefono", "origen", "nombre", "apellido"];
			const missing = required.filter((f) => !huespedData?.[f]);
			if (missing.length) {
				return res.status(400).json({ error: `Faltan datos para crear huésped: ${missing.join(", ")}` });
			}
			// Si el DNI ya existe, no silenciar ni reutilizar: informar al admin para que use "huésped existente"
			let huespedExistente = await Huesped.findOne({ where: { dni: huespedData.dni } });
			if (huespedExistente) {
				throw dniExists(huespedData.dni, huespedExistente.nombre, huespedExistente.apellido, huespedExistente.idHuesped);
			} else {
				const nuevo = await Huesped.create({
					dni: huespedData.dni,
					telefono: huespedData.telefono,
					origen: huespedData.origen,
					nombre: huespedData.nombre,
					apellido: huespedData.apellido,
					email: huespedData.email || null,
					direccion: huespedData.direccion || null,
				});
				idHuesped = nuevo.idHuesped;
			}
		} else {
			const exist = await Huesped.findByPk(idHuesped);
			if (!exist) return res.status(400).json({ error: "Huésped no válido" });
		}

		// 2) Validar habitación y obtener precio
		const habitacion = await Habitacion.findByPk(idHabitacion, {
			include: [{ model: TipoHabitacion, attributes: ["precio"] }],
		});
		if (!habitacion) return res.status(400).json({ error: "Habitación no válida" });
		const bloqueoHabitacion = validarHabitacionHabilitada(habitacion);
		if (bloqueoHabitacion) return res.status(409).json(bloqueoHabitacion);

		const precioPorNoche = habitacion.TipoHabitacion.precio;

		// 3) Calcular montoTotal con las fechas ya validadas
		const montoTotal = precioPorNoche * dias;

		// 4) Validar montoPagado
		if (montoPagado > montoTotal) {
			return res.status(400).json({ error: "La seña no puede ser mayor al monto total" });
		}

		// 5) Crear reserva
		const nuevaReserva = await Reserva.create({
			idHuesped,
			idHabitacion,
			idEstadoReserva,
			fechaDesde: start, // guardá las Date normalizadas
			fechaHasta: end,
			montoPagado,
			montoTotal,
		});

		// 6) Devolver datos
		const reservaCompleta = await Reserva.findByPk(nuevaReserva.idReserva, {
			attributes: ["idReserva", "fechaDesde", "fechaHasta", "montoPagado", "montoTotal"],
			include: [
				{ model: Huesped, attributes: ["dni", "telefono", "origen", "nombre", "apellido"] },
				{ model: Habitacion, attributes: ["numero"], include: [{ model: TipoHabitacion, attributes: ["precio"] }] },
			],
		});

		return res.status(201).json(reservaCompleta);
	} catch (err) {
		next(err);
	}
};

/**
 * Actualiza una reserva existente por su ID.
 * 
 * @route PUT /reservas/:id
 * @param {number} id ID de la reserva a actualizar.
 * @body {Object} Datos a actualizar de la reserva.
 * @returns {Object} Reserva actualizada.
 */


export const updateReserva = async (req, res, next) => {
	try {
		const r = await Reserva.findByPk(req.params.id);
		if (!r) return res.status(404).json({ error: "No existe reserva" });

		// Regla de transición: si la reserva ya avanzó desde confirmada,
		// no permitir volver a pendiente/rechazada.
		if (req.body?.idEstadoReserva !== undefined) {
			const { EstadoReserva } = await import("../models/estadoReserva.js");
			const estadoActual = await EstadoReserva.findByPk(r.idEstadoReserva);
			const estadoDestino = await EstadoReserva.findByPk(Number(req.body.idEstadoReserva));

			const origen = String(estadoActual?.nombre || "").toLowerCase();
			const destino = String(estadoDestino?.nombre || "").toLowerCase();
			const origenBloqueado = ["confirmada", "checkin", "checkout"].includes(origen);
			const destinoBloqueado = ["pendiente"].includes(destino);

			if (origenBloqueado && destinoBloqueado) {
				return res.status(400).json({
					error:
						"No se puede volver a 'pendiente' si la reserva ya fue confirmada.",
					code: "ESTADO_TRANSICION_INVALIDA",
				});
			}
		}

		await r.update(req.body);
		return res.json(r);
	} catch (err) {
		next(err);
	}
};

/**
 * Registra el check-in de una reserva.
 * Solo reservas con estado "confirmada" pueden hacer check-in.
 * 
 * @route PUT /reservas/:id/checkin
 */
export const checkinReserva = async (req, res, next) => {
	try {
		const { EstadoReserva } = await import("../models/estadoReserva.js");

		const reserva = await Reserva.findByPk(req.params.id, {
			include: [{ model: EstadoReserva, attributes: ["nombre"] }],
		});
		if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });

		const estadoActual = reserva.EstadoReserva?.nombre?.toLowerCase();
		if (estadoActual !== "confirmada" && estadoActual !== "pendiente") {
			return res.status(400).json({
				error: `No se puede hacer check-in desde el estado "${reserva.EstadoReserva?.nombre || estadoActual}". La reserva debe estar confirmada o pendiente.`,
			});
		}

		const estadoCheckin = await EstadoReserva.findOne({
			where: { nombre: { [Op.iLike]: "checkin" } },
		});
		if (!estadoCheckin) {
			return res.status(500).json({ error: "Estado 'checkin' no encontrado en el sistema" });
		}

		await reserva.update({ idEstadoReserva: estadoCheckin.idEstadoReserva });

		const updated = await Reserva.findByPk(req.params.id, {
			include: ["Huesped", "Habitacion", "EstadoReserva"],
		});

		return res.json({
			message: "Check-in registrado correctamente",
			reserva: updated,
		});
	} catch (err) {
		console.error(`Error al registrar check-in ${req.params.id}:`, err);
		return next(err);
	}
};

/**
 * Registra el check-out de una reserva.
 * Solo reservas con estado "checkin" pueden hacer check-out.
 * 
 * @route PUT /reservas/:id/checkout
 */
export const checkoutReserva = async (req, res, next) => {
	try {
		const { EstadoReserva } = await import("../models/estadoReserva.js");

		const reserva = await Reserva.findByPk(req.params.id, {
			include: [{ model: EstadoReserva, attributes: ["nombre"] }],
		});
		if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });

		const estadoActual = reserva.EstadoReserva?.nombre?.toLowerCase();
		if (estadoActual !== "checkin") {
			return res.status(400).json({
				error: `No se puede hacer check-out desde el estado "${reserva.EstadoReserva?.nombre || estadoActual}". La reserva debe estar en check-in.`,
			});
		}

		const estadoCheckout = await EstadoReserva.findOne({
			where: { nombre: { [Op.iLike]: "checkout" } },
		});
		if (!estadoCheckout) {
			return res.status(500).json({ error: "Estado 'checkout' no encontrado en el sistema" });
		}

		await reserva.update({ idEstadoReserva: estadoCheckout.idEstadoReserva });

		const updated = await Reserva.findByPk(req.params.id, {
			include: ["Huesped", "Habitacion", "EstadoReserva"],
		});

		return res.json({
			message: "Check-out registrado correctamente",
			reserva: updated,
		});
	} catch (err) {
		console.error(`Error al registrar check-out ${req.params.id}:`, err);
		return next(err);
	}
};

/**
 * Confirma una reserva pendiente.
 * Solo reservas con estado "pendiente" pueden ser confirmadas.
 *
 * @route PUT /reservas/:id/confirmar
 */
export const confirmarReserva = async (req, res, next) => {
	try {
		const { EstadoReserva } = await import("../models/estadoReserva.js");

		const reserva = await Reserva.findByPk(req.params.id, {
			include: [{ model: EstadoReserva, attributes: ["nombre"] }],
		});
		if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });

		const estadoActual = reserva.EstadoReserva?.nombre?.toLowerCase();
		if (estadoActual !== "pendiente") {
			return res.status(400).json({
				error: `No se puede confirmar desde el estado "${reserva.EstadoReserva?.nombre || estadoActual}". La reserva debe estar pendiente.`,
			});
		}

		const estadoConfirmada = await EstadoReserva.findOne({
			where: { nombre: { [Op.iLike]: "confirmada" } },
		});
		if (!estadoConfirmada) {
			return res.status(500).json({ error: "Estado 'confirmada' no encontrado en el sistema" });
		}

		await reserva.update({ idEstadoReserva: estadoConfirmada.idEstadoReserva });

		const updated = await Reserva.findByPk(req.params.id, {
			include: ["Huesped", "Habitacion", "EstadoReserva"],
		});

		// Enviar email de aprobación si el huésped tiene email
		if (updated?.Huesped?.email) {
			try {
				await enviarEmailAprobacion({
					to: updated.Huesped.email,
					nombreHuesped: `${updated.Huesped.nombre} ${updated.Huesped.apellido}`,
					habitacion: updated.Habitacion?.numero ?? "-",
					fechaDesde: updated.fechaDesde,
					fechaHasta: updated.fechaHasta,
					montoTotal: updated.montoTotal,
				});
			} catch (emailErr) {
				console.error("Error al enviar email de aprobación:", emailErr);
				// No falla la operación si el email no se envía
			}
		}

		broadcast("reserva_actualizada", {
			id: Number(req.params.id),
			estado: "confirmada",
		});

		return res.json({
			message: "Reserva confirmada correctamente",
			reserva: updated,
		});
	} catch (err) {
		console.error(`Error al confirmar reserva ${req.params.id}:`, err);
		return next(err);
	}
};

/**
 * Cancela una reserva.
 * Se puede cancelar desde cualquier estado excepto checkout y cancelada.
 *
 * @route PUT /reservas/:id/cancelar
 */
export const cancelarReserva = async (req, res, next) => {
	try {
		const { EstadoReserva } = await import("../models/estadoReserva.js");

		const reserva = await Reserva.findByPk(req.params.id, {
			include: [{ model: EstadoReserva, attributes: ["nombre"] }],
		});
		if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });

		const estadoActual = reserva.EstadoReserva?.nombre?.toLowerCase();
		if (estadoActual === "cancelada") {
			return res.status(400).json({ error: "La reserva ya está cancelada." });
		}
		if (estadoActual === "checkout") {
			return res.status(400).json({ error: "No se puede cancelar una reserva que ya hizo check-out." });
		}

		const estadoCancelada = await EstadoReserva.findOne({
			where: { nombre: { [Op.iLike]: "cancelada" } },
		});
		if (!estadoCancelada) {
			return res.status(500).json({ error: "Estado 'cancelada' no encontrado en el sistema" });
		}

		const eraPendiente = estadoActual === "pendiente";

		await reserva.update({ idEstadoReserva: estadoCancelada.idEstadoReserva });

		const updated = await Reserva.findByPk(req.params.id, {
			include: ["Huesped", "Habitacion", "EstadoReserva"],
		});

		// Enviar email al huésped si tiene email registrado
		if (updated?.Huesped?.email) {
			try {
				if (eraPendiente) {
					// Solicitud no aprobada → email de rechazo
					await enviarEmailRechazo({
						to: updated.Huesped.email,
						nombreHuesped: `${updated.Huesped.nombre} ${updated.Huesped.apellido}`,
						habitacion: updated.Habitacion?.numero ?? "-",
						fechaDesde: updated.fechaDesde,
						fechaHasta: updated.fechaHasta,
						motivo: req.body?.motivo || null,
					});
				} else {
					// Reserva confirmada cancelada → email de cancelación
					await enviarEmailCancelacion({
						to: updated.Huesped.email,
						nombreHuesped: `${updated.Huesped.nombre} ${updated.Huesped.apellido}`,
						habitacion: updated.Habitacion?.numero ?? "-",
						fechaDesde: updated.fechaDesde,
						fechaHasta: updated.fechaHasta,
					});
				}
			} catch (emailErr) {
				console.error("Error al enviar email de cancelación:", emailErr);
			}
		}

		broadcast("reserva_actualizada", {
			id: Number(req.params.id),
			estado: "cancelada",
		});

		return res.json({
			message: "Reserva cancelada correctamente",
			reserva: updated,
		});
	} catch (err) {
		console.error(`Error al cancelar reserva ${req.params.id}:`, err);
		return next(err);
	}
};

/**
 * Rechaza una reserva pendiente (acción administrativa).
 * Solo aplica desde el estado "pendiente".
 * Envía email de rechazo al huésped si tiene email registrado.
 *
 * @route PUT /reservas/:id/rechazar
 */
export const rechazarReserva = async (req, res, next) => {
	try {
		const { EstadoReserva } = await import("../models/estadoReserva.js");

		const reserva = await Reserva.findByPk(req.params.id, {
			include: [{ model: EstadoReserva, attributes: ["nombre"] }],
		});
		if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });

		const estadoActual = reserva.EstadoReserva?.nombre?.toLowerCase();
		if (estadoActual !== "pendiente") {
			return res.status(400).json({
				error: `Solo se pueden rechazar reservas pendientes. Estado actual: "${reserva.EstadoReserva?.nombre || estadoActual}".`,
			});
		}

		const estadoRechazada = await EstadoReserva.findOne({
			where: { nombre: { [Op.iLike]: "rechazada" } },
		});
		if (!estadoRechazada) {
			return res.status(500).json({ error: "Estado 'rechazada' no encontrado en el sistema" });
		}

		await reserva.update({ idEstadoReserva: estadoRechazada.idEstadoReserva });

		const updated = await Reserva.findByPk(req.params.id, {
			include: ["Huesped", "Habitacion", "EstadoReserva"],
		});

		// Enviar email de rechazo si el huésped tiene email
		if (updated?.Huesped?.email) {
			try {
				await enviarEmailRechazo({
					to: updated.Huesped.email,
					nombreHuesped: `${updated.Huesped.nombre} ${updated.Huesped.apellido}`,
					habitacion: updated.Habitacion?.numero ?? "-",
					fechaDesde: updated.fechaDesde,
					fechaHasta: updated.fechaHasta,
					motivo: req.body?.motivo || null,
				});
			} catch (emailErr) {
				console.error("Error al enviar email de rechazo:", emailErr);
			}
		}

		broadcast("reserva_actualizada", {
			id: Number(req.params.id),
			estado: "rechazada",
		});

		return res.json({
			message: "Reserva rechazada correctamente",
			reserva: updated,
		});
	} catch (err) {
		console.error(`Error al rechazar reserva ${req.params.id}:`, err);
		return next(err);
	}
};

/**
 * Elimina una reserva existente por su ID.
 * 
 * @route DELETE /reservas/:id
 * @param {number} id ID de la reserva a eliminar.
 * @returns {void} 204 No Content en caso de éxito.
 */

export const deleteReserva = async (req, res, next) => {
	try {
		const r = await Reserva.findByPk(req.params.id);
		if (!r) return res.status(404).json({ error: "No existe reserva" });
		await r.destroy();
		return res.status(204).end();
	} catch (err) {
		console.error(`Error al eliminar reserva ${req.params.id}:`, err);
		return next(err);
	}
};

/**
 * Crea una reserva pública (sin autenticación). La reserva se crea con estado "pendiente".
 * 
 * @route POST /public/reservas
 * @body {Object} huesped Datos del huésped (dni, telefono, origen, nombre, apellido).
 * @body {number} idHabitacion ID de la habitación.
 * @body {string} fechaDesde Fecha de inicio (YYYY-MM-DD).
 * @body {string} fechaHasta Fecha de fin (YYYY-MM-DD).
 * @returns {Object} Datos completos de la reserva creada.
 */
export const createReservaPublica = async (req, res, next) => {
	const { huesped: huespedData, idHabitacion, fechaDesde, fechaHasta } = req.body;

	try {
		// --- Validar datos del huésped ---
		const required = ["dni", "telefono", "origen", "nombre", "apellido", "email"];
		const missing = required.filter((f) => !huespedData?.[f]);
		if (missing.length) {
			return res.status(400).json({ error: `Faltan datos del huésped: ${missing.join(", ")}` });
		}

		// --- Verificar lista negra ---
		if (await isDniBlacklisted(huespedData.dni)) {
			return res.status(403).json({
				error: "No es posible completar la reserva con los datos ingresados.",
				code: "DNI_BLACKLISTED",
			});
		}

		if (!idHabitacion) return res.status(400).json({ error: "Falta idHabitacion" });
		if (!fechaDesde || !fechaHasta) return res.status(400).json({ error: "Faltan fechas" });

		const start = new Date(fechaDesde);
		const end = new Date(fechaHasta);
		if (isNaN(start) || isNaN(end)) return res.status(400).json({ error: "Formato de fecha inválido" });

		const soloFechaUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
		const dias = Math.round((soloFechaUTC(end) - soloFechaUTC(start)) / 86_400_000);
		if (dias <= 0) return res.status(400).json({ error: "La fecha de salida debe ser posterior a la fecha de entrada" });
		if (dias < 2) return res.status(400).json({ error: "La estadía mínima es de 2 noches" });

		// --- Verificar disponibilidad (excluye canceladas y rechazadas) ---
		const { EstadoReserva } = await import("../models/estadoReserva.js");
		const reservaSolapada = await Reserva.findOne({
			where: {
				idHabitacion,
				[Op.and]: [{ fechaDesde: { [Op.lt]: end } }, { fechaHasta: { [Op.gt]: start } }],
			},
			include: [{
				model: EstadoReserva,
				where: { nombre: { [Op.notIn]: ["cancelada", "rechazada"] } },
				required: true,
			}],
		});
		if (reservaSolapada) return res.status(409).json({ error: "La habitación ya está reservada en esas fechas." });

		// --- Verificar habitación y calcular precio ---
		const habitacion = await Habitacion.findByPk(idHabitacion, {
			include: [{ model: TipoHabitacion, attributes: ["precio", "nombre"] }],
		});
		if (!habitacion) return res.status(400).json({ error: "Habitación no válida" });
		const bloqueoHabitacion = validarHabitacionHabilitada(habitacion);
		if (bloqueoHabitacion) return res.status(409).json(bloqueoHabitacion);

		const montoTotal = habitacion.TipoHabitacion.precio * dias;

		const normalizarTexto = (value) => String(value || "").trim().toLowerCase();
		const huespedExistente = await Huesped.findOne({ where: { dni: huespedData.dni } });
		const cambiosDetectados = [];
		if (huespedExistente) {
			if (
				huespedData.email &&
				normalizarTexto(huespedData.email) !== normalizarTexto(huespedExistente.email)
			) {
				cambiosDetectados.push("email");
			}
			if (
				huespedData.telefono &&
				normalizarTelefonoArgentino(huespedData.telefono) !==
					normalizarTelefonoArgentino(huespedExistente.telefono)
			) {
				cambiosDetectados.push("telefono");
			}
			if (
				(huespedData.direccion || "").trim() !== (huespedExistente.direccion || "").trim()
			) {
				cambiosDetectados.push("direccion");
			}
		}
		const hayCambiosDatos = cambiosDetectados.length > 0;

		// --- Guardar como pendiente y enviar email de confirmación ---
		const token = crypto.randomUUID();
		const frontendUrl = process.env.FRONTEND_URL;

		guardarPendiente(token, {
			huespedData,
			idHabitacion,
			fechaDesde: start.toISOString(),
			fechaHasta: end.toISOString(),
			montoTotal,
			numHabitacion: habitacion.numero,
			hayCambiosDatos,
			cambiosDetectados,
		});

		const urlConfirmar = `${frontendUrl}/confirmar-reserva?token=${token}&accion=confirmar`;
		const urlCancelar = `${frontendUrl}/confirmar-reserva?token=${token}&accion=cancelar`;
		const nombreCompleto = `${huespedData.nombre} ${huespedData.apellido}`;

		enviarEmailConfirmacionIdentidad({
			to: hayCambiosDatos && huespedExistente?.email ? huespedExistente.email : huespedData.email,
			nombreHuesped: nombreCompleto,
			habitacion: habitacion.numero,
			fechaDesde: start,
			fechaHasta: end,
			montoTotal,
			urlConfirmar,
			urlCancelar,
			hayCambiosDatos,
			cambiosDetectados,
		}).catch((err) => console.error("Error al enviar email de confirmación:", err));

		return res.status(202).json({
			success: true,
			mensaje: "Te enviamos un email para confirmar tu identidad. Revisá tu bandeja de entrada.",
			email: huespedData.email,
		});
	} catch (err) {
		next(err);
	}
};

/**
 * Confirma una reserva pública a partir de un token de verificación de identidad.
 * Crea el huésped (o lo actualiza), crea la reserva y notifica a la posada.
 *
 * @route GET /public/reservas/confirmar?token=xxx
 */
export const confirmarReservaPublica = async (req, res, next) => {
	const { token } = req.query;
	if (!token) return res.status(400).json({ error: "Token requerido" });

	const pendiente = obtenerPendiente(token);
	if (!pendiente) {
		return res.status(410).json({
			error: "El enlace ya expiró o no es válido. Podés volver a solicitar la reserva desde el sitio.",
			code: "TOKEN_EXPIRED",
		});
	}

	const { huespedData, idHabitacion, fechaDesde, fechaHasta, montoTotal, numHabitacion } = pendiente;

	try {
		// --- Re-verificar disponibilidad (excluye canceladas y rechazadas) ---
		const start = new Date(fechaDesde);
		const end = new Date(fechaHasta);
		const { EstadoReserva } = await import("../models/estadoReserva.js");

		const solapada = await Reserva.findOne({
			where: {
				idHabitacion,
				[Op.and]: [{ fechaDesde: { [Op.lt]: end } }, { fechaHasta: { [Op.gt]: start } }],
			},
			include: [{
				model: EstadoReserva,
				where: { nombre: { [Op.notIn]: ["cancelada", "rechazada"] } },
				required: true,
			}],
		});
		if (solapada) {
			eliminarPendiente(token);
			return res.status(409).json({
				error: "La habitación ya no está disponible en esas fechas. Por favor realizá una nueva solicitud.",
				code: "ROOM_UNAVAILABLE",
			});
		}

		const habitacion = await Habitacion.findByPk(idHabitacion);
		if (!habitacion) {
			eliminarPendiente(token);
			return res.status(400).json({ error: "Habitación no válida" });
		}
		const bloqueoHabitacion = validarHabitacionHabilitada(habitacion);
		if (bloqueoHabitacion) {
			eliminarPendiente(token);
			return res.status(409).json(bloqueoHabitacion);
		}

		// --- Buscar o crear huésped ---
		let huesped = await Huesped.findOne({ where: { dni: huespedData.dni } });
		if (!huesped) {
			huesped = await Huesped.create({
				dni: huespedData.dni,
				telefono: huespedData.telefono,
				origen: huespedData.origen,
				nombre: huespedData.nombre,
				apellido: huespedData.apellido,
				email: huespedData.email || null,
				direccion: huespedData.direccion || null,
			});
		} else {
			const updates = {};
			if (huespedData.email && huespedData.email !== huesped.email) updates.email = huespedData.email;
			if (
				huespedData.telefono &&
				normalizarTelefonoArgentino(huespedData.telefono) !==
					normalizarTelefonoArgentino(huesped.telefono)
			) {
				updates.telefono = huespedData.telefono;
			}
			if (huespedData.direccion !== undefined && (huespedData.direccion || null) !== huesped.direccion) updates.direccion = huespedData.direccion || null;
			if (Object.keys(updates).length) await huesped.update(updates);
		}

		// --- Obtener estado pendiente ---
		let estadoPendiente = await EstadoReserva.findOne({ where: { nombre: { [Op.iLike]: "pendiente" } } });
		if (!estadoPendiente) estadoPendiente = await EstadoReserva.create({ nombre: "Pendiente" });

		// --- Crear reserva ---
		const nuevaReserva = await Reserva.create({
			idHuesped: huesped.idHuesped,
			idHabitacion,
			idEstadoReserva: estadoPendiente.idEstadoReserva,
			fechaDesde: start,
			fechaHasta: end,
			montoPagado: 0,
			montoTotal,
		});

		eliminarPendiente(token);

		// --- Notificaciones ---
		broadcast("nueva_reserva", {
			id: nuevaReserva.idReserva,
			habitacion: numHabitacion ?? null,
			huesped: `${huesped.nombre} ${huesped.apellido}`,
		});

		const nombreCompleto = `${huesped.nombre} ${huesped.apellido}`;
		const emailHuesped = huesped.email;

		enviarEmailNuevaSolicitudPosada({
			nombreHuesped: nombreCompleto,
			dniHuesped: huesped.dni,
			telefonoHuesped: huesped.telefono,
			emailHuesped: emailHuesped || null,
			habitacion: numHabitacion,
			fechaDesde: start,
			fechaHasta: end,
			montoTotal,
		}).catch((err) => console.error("Error al enviar email a la posada:", err));

		return res.status(201).json({
			success: true,
			mensaje: "¡Reserva confirmada! La posada revisará tu solicitud y te avisaremos.",
		});
	} catch (err) {
		console.error("Error al confirmar reserva pública:", err);
		return next(err);
	}
};

/**
 * Cancela una reserva pendiente de confirmación (token no expirado).
 *
 * @route GET /public/reservas/cancelar-pendiente?token=xxx
 */
export const cancelarPendientePublica = async (req, res) => {
	const { token } = req.query;
	if (!token) return res.status(400).json({ error: "Token requerido" });
	eliminarPendiente(token);
	return res.json({ success: true, mensaje: "Solicitud cancelada correctamente." });
};

/**
 * Cambia el estado de una reserva a cualquier estado por nombre (sin validaciones de transición).
 * @route PUT /reservas/:id/estado
 * @body {string} nombre - nombre del estado destino
 */
export const setEstadoReserva = async (req, res, next) => {
	try {
		const { nombre } = req.body;
		if (!nombre) return res.status(400).json({ error: "Falta el campo 'nombre' del estado." });

		const reserva = await Reserva.findByPk(req.params.id);
		if (!reserva) return res.status(404).json({ error: "Reserva no encontrada." });

		const { EstadoReserva } = await import("../models/estadoReserva.js");
		const estado = await EstadoReserva.findOne({ where: { nombre: { [Op.iLike]: nombre } } });
		if (!estado) return res.status(400).json({ error: `Estado '${nombre}' no encontrado.` });

		await reserva.update({ idEstadoReserva: estado.idEstadoReserva });

		return res.json({ id: reserva.idReserva, estado: estado.nombre });
	} catch (err) {
		console.error("Error al cambiar estado de reserva:", err);
		return next(err);
	}
};