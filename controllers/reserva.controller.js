import { Reserva } from "../models/reserva.js";
import { Habitacion } from "../models/habitacion.js";
import { Huesped } from "../models/huesped.js";
import { sequelize } from "../db.js";
import { Op, QueryTypes } from "sequelize";
import { TipoHabitacion } from "../models/tipoHabitacion.js";

/**
 * Obtiene todas las reservas con información del huésped y habitación asociada.
 * 
 * @route GET /reservas
 * @returns {Array<Object>} Lista de reservas formateadas con datos de habitación y huésped.
 */

export const getAllReservas = async (req, res, next) => {
	try {
		const list = await Reserva.findAll({
			include: ["Huesped", "Habitacion"],
		});

		const reservasFormateadas = list.map((r) => ({
			id: r.idReserva,
			numeroHab: r.Habitacion?.numero ?? "-",
			ingreso: r.fechaDesde ? new Date(r.fechaDesde).toLocaleDateString() : "-",
			egreso: r.fechaHasta ? new Date(r.fechaHasta).toLocaleDateString() : "-",
			huespedNombre: r.Huesped ? `${r.Huesped.nombre} ${r.Huesped.apellido}` : "-",
			telefonoHuesped: r.Huesped?.telefono ?? "-",
			dniHuesped: r.Huesped?.dni ?? "-",
			montoPagado: r.montoPagado,
			total: r.montoTotal,
			estadoDeReserva: r.idEstadoReserva,
		}));

		return res.json(reservasFormateadas);
	} catch (err) {
		console.error("Error al obtener reservas:", err);
		return next(err);
	}
};

/**
 * Obtiene las fechas en las que todas las habitaciones seleccionadas están completamente ocupadas.
 *
 * @route GET /reservas/calendar
 * @query {string|number|Array} [habitacionesIds] IDs de habitaciones a filtrar (puede ser lista separada por comas, número o array).
 * @returns {Object} Objeto con la propiedad `fullyBookedDates` que contiene un array de strings (YYYY-MM-DD) con las fechas donde todas las habitaciones filtradas están ocupadas.
 */

export const getReservasCalendar = async (req, res, next) => {
	try {
		const today = new Date();
		const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
			.toISOString().slice(0, 10);
		const endDate = new Date(today.getFullYear(), today.getMonth() + 4, 0)
			.toISOString().slice(0, 10);

		// ---- parseo robusto de IDs ----
		const parseIds = (val) => {
			if (!val) return [];
			if (Array.isArray(val)) {
				return val.flatMap(v => String(v).split(","))
					.map(v => Number(v))
					.filter(Number.isFinite);
			}
			if (typeof val === "string") {
				return val.split(",").map(v => Number(v)).filter(Number.isFinite);
			}
			if (typeof val === "number" && Number.isFinite(val)) return [val];
			return [];
		};

		const ids = Array.from(new Set([
			...parseIds(req?.query?.habitacionesIds),
		]));

		const usarFiltro = ids.length > 0;

		// ---- 1) contar habitaciones del universo a evaluar (raw SQL) ----
		const countSql = `
      SELECT COUNT(*)::int AS total
      FROM "Habitacion"
      ${usarFiltro ? 'WHERE "Habitacion"."idHabitacion" IN (:ids)' : ''};
    `;
		const countRows = await sequelize.query(countSql, {
			type: QueryTypes.SELECT,
			replacements: usarFiltro ? { ids } : {},
			// logging: console.log,
		});
		const totalSubset = countRows?.[0]?.total ?? 0;

		// Si no hay habitaciones en el subset, no puede haber días completos
		if (!totalSubset) {
			return res.json({ fullyBookedDates: [] });
		}

		// ---- 2) query de calendario (raw SQL) ----
		const filtroHabitaciones = usarFiltro ? 'AND r."idHabitacion" IN (:ids)' : '';

		const calendarSql = `
      SELECT to_char(d.day, 'YYYY-MM-DD') AS date
      FROM generate_series(:startDate::date, :endDate::date, '1 day') AS d(day)
      LEFT JOIN "Reserva" r
        ON r."fechaDesde" < (:endDate::date + INTERVAL '1 day')
       AND r."fechaHasta" > :startDate::date
       AND d.day BETWEEN date_trunc('day', r."fechaDesde") AND date_trunc('day', r."fechaHasta")
       ${filtroHabitaciones}
      GROUP BY d.day
      HAVING COUNT(DISTINCT r."idHabitacion") = :totalSubset
      ORDER BY d.day;
    `;

		const rows = await sequelize.query(calendarSql, {
			type: QueryTypes.SELECT,
			replacements: {
				startDate,
				endDate,
				totalSubset,
				...(usarFiltro ? { ids } : {}),
			},
			// logging: console.log,
		});

		const fullyBookedDates = rows.map(r => r.date);
		return res.json({ fullyBookedDates });
	} catch (err) {
		console.error("Error al calcular calendario:", {
			message: err?.message,
			detail: err?.original?.detail || err?.parent?.detail,
			sql: err?.sql,
			parameters: err?.parameters,
			stack: err?.stack,
		});
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
export const getReservasCalendar2 = async (req, res, next) => {
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
				: ["cancelada", "canceled", "anulada", "void"])
			: [];

		// ========== ROOMS ==========
		const roomsSql = `
      SELECT
        h."idHabitacion" AS "id",
        h."numero" AS "numero",
        ('Habitación ' || h."numero") AS "name"
      FROM "Habitacion" h
      ${usarFiltroHabit ? 'WHERE h."numero" IN (:numeros)' : ''}
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
        r."montoTotal" AS "price",
        LOWER(er."nombre") AS "status"
      FROM "Reserva" r
      JOIN "Habitacion" h ON h."idHabitacion" = r."idHabitacion"
      JOIN "Huesped" hp ON hp."idHuesped" = r."idHuesped"
      JOIN "EstadoReserva" er ON er."idEstadoReserva" = r."idEstadoReserva"
      WHERE ${baseOverlap}
      ${usarFiltroHabit ? 'AND h."numero" IN (:numeros)' : ''}
      ORDER BY r."fechaDesde", r."idReserva";
    `;
		const bookings = await sequelize.query(bookingsSql, {
			type: QueryTypes.SELECT,
			replacements: {
				startDate,
				endDate,
				...(usarFiltroHabit ? { numeros } : {}),
				...estadoRepl,
			},
		});

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
      JOIN "Habitacion" h ON h."idHabitacion" = r."idHabitacion"
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
		// Cantidad de días (back-to-back permitido => end > start)
		const dias = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
		if (dias <= 0) return res.status(400).json({ error: "Rango de fechas inválido" });

		// 🔒 0.1) CHEQUEO DE SOLAPAMIENTO (ANTES de crear huésped/hacer más trabajo)
		// Ajustá el filtro de estados si querés ignorar reservas canceladas, etc.
		// Por ejemplo: where: { idEstadoReserva: { [Op.in]: [1,2,3] } }
		const reservaSolapada = await Reserva.findOne({
			where: {
				idHabitacion,
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

		// 1) Crear o validar huésped
		if (!idHuesped) {
			const required = ["dni", "telefono", "origen", "nombre", "apellido"];
			const missing = required.filter((f) => !huespedData?.[f]);
			if (missing.length) {
				return res.status(400).json({ error: `Faltan datos para crear huésped: ${missing.join(", ")}` });
			}
			const nuevo = await Huesped.create({
				dni: huespedData.dni,
				telefono: huespedData.telefono,
				origen: huespedData.origen,
				nombre: huespedData.nombre,
				apellido: huespedData.apellido,
			});
			idHuesped = nuevo.idHuesped;
		} else {
			const exist = await Huesped.findByPk(idHuesped);
			if (!exist) return res.status(400).json({ error: "Huésped no válido" });
		}

		// 2) Validar habitación y obtener precio
		const habitacion = await Habitacion.findByPk(idHabitacion, {
			include: [{ model: TipoHabitacion, attributes: ["precio"] }],
		});
		if (!habitacion) return res.status(400).json({ error: "Habitación no válida" });

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
		console.error("Error al crear reserva:", err);
		if (err.name === "SequelizeValidationError" || err.name === "SequelizeForeignKeyConstraintError") {
			return res.status(400).json({ error: err.errors.map((e) => e.message) });
		}
		return next(err);
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
		await r.update(req.body);
		return res.json(r);
	} catch (err) {
		console.error(`Error al actualizar reserva ${req.params.id}:`, err);
		if (
			err.name === "SequelizeValidationError" ||
			err.name === "SequelizeForeignKeyConstraintError"
		) {
			return res.status(400).json({ error: err.errors.map((e) => e.message) });
		}
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
	const {
		huesped: huespedData,
		idHabitacion,
		fechaDesde,
		fechaHasta,
	} = req.body;

	try {
		// --- Validar datos del huésped ---
		const required = ["dni", "telefono", "origen", "nombre", "apellido"];
		const missing = required.filter((f) => !huespedData?.[f]);
		if (missing.length) {
			return res.status(400).json({
				error: `Faltan datos del huésped: ${missing.join(", ")}`
			});
		}

		// --- Validar habitación ---
		if (!idHabitacion) {
			return res.status(400).json({ error: "Falta idHabitacion" });
		}

		// --- Validar fechas ---
		if (!fechaDesde || !fechaHasta) {
			return res.status(400).json({ error: "Faltan fechas (fechaDesde, fechaHasta)" });
		}

		const start = new Date(fechaDesde);
		const end = new Date(fechaHasta);

		if (isNaN(start) || isNaN(end)) {
			return res.status(400).json({ error: "Formato de fecha inválido" });
		}

		const dias = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
		if (dias <= 0) {
			return res.status(400).json({ error: "La fecha de salida debe ser posterior a la fecha de entrada" });
		}

		// --- Verificar disponibilidad ---
		const reservaSolapada = await Reserva.findOne({
			where: {
				idHabitacion,
				[Op.and]: [
					{ fechaDesde: { [Op.lt]: end } },
					{ fechaHasta: { [Op.gt]: start } }
				],
			},
		});

		if (reservaSolapada) {
			return res.status(409).json({
				error: "La habitación ya está reservada en esas fechas.",
			});
		}

		// --- Verificar que la habitación exista y obtener precio ---
		const habitacion = await Habitacion.findByPk(idHabitacion, {
			include: [{ model: TipoHabitacion, attributes: ["precio"] }],
		});

		if (!habitacion) {
			return res.status(400).json({ error: "Habitación no válida" });
		}

		const precioPorNoche = habitacion.TipoHabitacion.precio;
		const montoTotal = precioPorNoche * dias;

		// --- Buscar o crear huésped por DNI ---
		let huesped = await Huesped.findOne({ where: { dni: huespedData.dni } });

		if (!huesped) {
			huesped = await Huesped.create({
				dni: huespedData.dni,
				telefono: huespedData.telefono,
				origen: huespedData.origen,
				nombre: huespedData.nombre,
				apellido: huespedData.apellido,
				direccion: huespedData.direccion || null,
			});
		}

		// --- Obtener el ID del estado "pendiente" ---
		// Asumiendo que existe un estado con nombre "pendiente" o "Pendiente"
		const { EstadoReserva } = await import("../models/estadoReserva.js");
		let estadoPendiente = await EstadoReserva.findOne({
			where: { nombre: { [Op.iLike]: "pendiente" } }
		});

		if (!estadoPendiente) {
			// Si no existe, crear el estado pendiente
			estadoPendiente = await EstadoReserva.create({ nombre: "Pendiente" });
		}

		// --- Crear reserva con estado pendiente y monto pagado en 0 ---
		const nuevaReserva = await Reserva.create({
			idHuesped: huesped.idHuesped,
			idHabitacion,
			idEstadoReserva: estadoPendiente.idEstadoReserva,
			fechaDesde: start,
			fechaHasta: end,
			montoPagado: 0,
			montoTotal,
		});

		// --- Devolver datos de la reserva ---
		const reservaCompleta = await Reserva.findByPk(nuevaReserva.idReserva, {
			attributes: ["idReserva", "fechaDesde", "fechaHasta", "montoPagado", "montoTotal"],
			include: [
				{ model: Huesped, attributes: ["dni", "telefono", "origen", "nombre", "apellido"] },
				{
					model: Habitacion,
					attributes: ["numero"],
					include: [{ model: TipoHabitacion, attributes: ["precio", "nombre"] }]
				},
			],
		});

		return res.status(201).json({
			success: true,
			mensaje: "Reserva creada exitosamente. Estado: PENDIENTE",
			reserva: reservaCompleta,
		});
	} catch (err) {
		console.error("Error al crear reserva pública:", err);
		if (err.name === "SequelizeValidationError" || err.name === "SequelizeForeignKeyConstraintError") {
			return res.status(400).json({ error: err.errors.map((e) => e.message) });
		}
		return next(err);
	}
};