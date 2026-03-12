import { Habitacion } from "../models/habitacion.js";
import { TipoHabitacion } from "../models/tipoHabitacion.js";
import { Reserva } from "../models/reserva.js";
import { Op, Sequelize, QueryTypes } from "sequelize";
import { sequelize } from "../db.js";
import { broadcast } from "../ws.js";

// GET /habitaciones
export const getAllHabitaciones = async (req, res, next) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const size = parseInt(req.query.size) || 10;
		const sortField = req.query.sortField || "numero";
		const sortOrder =
			req.query.sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";
		const search = req.query.search?.trim().toLowerCase() || "";

		const limit = size;
		const offset = (page - 1) * size;

		const isNumericSearch = !isNaN(Number(search));

		const whereCondition = search
			? {
				[Op.or]: [
					isNumericSearch ? { numero: Number(search) } : null,
					Sequelize.where(Sequelize.col("TipoHabitacion.nombre"), {
						[Op.iLike]: `%${search}%`,
					}),
				].filter(Boolean),
			}
			: {};

		// Ordenamiento dinámico (solo TipoHabitacion)
		let order;
		if (["nombre", "precio"].includes(sortField)) {
			order = [[{ model: TipoHabitacion, as: "TipoHabitacion" }, sortField, sortOrder]];
		} else {
			order = [[sortField, sortOrder]];
		}

		const { rows, count } = await Habitacion.findAndCountAll({
			include: [{ model: TipoHabitacion, as: "TipoHabitacion" }],
			where: whereCondition,
			order,
			limit,
			offset,
		});

		const formattedData = rows.map((h) => ({
			idHabitacion: h.idHabitacion,
			numero: h.numero,
			precio: h.TipoHabitacion?.precio ?? null,
			tipo: h.TipoHabitacion?.nombre ?? null,
			fueraDeServicio: h.fueraDeServicio,
		}));

		res.json({
			total: count,
			page,
			pageSize: size,
			data: formattedData,
			sortField,
			sortOrder,
		});
	} catch (err) {
		console.error("Error fetching habitaciones:", err);
		next(err);
	}
};

// GET /habitaciones/disponibles?date=YYYY-MM-DD
export const getHabitacionesDisponiblesPorDia = async (req, res, next) => {
	try {
		const { date } = req.query; // YYYY-MM-DD
		if (!date) return res.status(400).json({ error: "Falta 'date' (YYYY-MM-DD)" });

		const sql = `
      WITH occupied AS (
        SELECT r."idHabitacion"
        FROM "Reserva" r
        JOIN "EstadoReserva" er ON er."idEstadoReserva" = r."idEstadoReserva"
        WHERE r."fechaDesde"::date <= :day::date
          AND r."fechaHasta"::date >= :day::date
          AND LOWER(er."nombre") NOT IN ('cancelada', 'rechazada')
        GROUP BY r."idHabitacion"
      )
      SELECT h.*
      FROM "Habitacion" h
      LEFT JOIN occupied o ON o."idHabitacion" = h."idHabitacion"
      WHERE o."idHabitacion" IS NULL
        AND COALESCE(h."fueraDeServicio", false) = false
      ORDER BY h."idHabitacion";
    `;
		const rooms = await sequelize.query(sql, {
			replacements: { day: date },
			type: QueryTypes.SELECT,
		});

		res.json({ date, rooms });
	} catch (err) {
		console.error("Error al obtener habitaciones disponibles:", err);
		next(err);
	}
};

// GET /public/habitaciones/disponibles?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
export const getHabitacionesDisponiblesPublico = async (req, res, next) => {
	try {
		const { fechaInicio, fechaFin } = req.query;

		if (!fechaInicio || !fechaFin) {
			return res.status(400).json({ error: "Faltan parámetros fechaInicio y fechaFin (YYYY-MM-DD)" });
		}

		// Validar que las fechas sean válidas
		const inicio = new Date(fechaInicio);
		const fin = new Date(fechaFin);

		if (isNaN(inicio) || isNaN(fin)) {
			return res.status(400).json({ error: "Formato de fecha inválido" });
		}

		if (fin <= inicio) {
			return res.status(400).json({ error: "La fecha de fin debe ser posterior a la fecha de inicio" });
		}

		// Consulta SQL para obtener habitaciones disponibles en el rango de fechas
		const sql = `
		WITH occupied AS (
			SELECT DISTINCT r."idHabitacion"
			FROM "Reserva" r
			JOIN "EstadoReserva" er ON er."idEstadoReserva" = r."idEstadoReserva"
			WHERE r."fechaDesde"::date < :fechaFin::date
			  AND r."fechaHasta"::date > :fechaInicio::date
			  AND LOWER(er."nombre") NOT IN ('cancelada', 'rechazada')
		)
		SELECT 
			h."idHabitacion",
			h."numero",
			th."nombre" as tipo,
			th."precio",
			h."idTipoHabitacion"
		FROM "Habitacion" h
		INNER JOIN "TipoHabitacion" th ON th."idTipoHabitacion" = h."idTipoHabitacion"
		LEFT JOIN occupied o ON o."idHabitacion" = h."idHabitacion"
		WHERE o."idHabitacion" IS NULL
		  AND COALESCE(h."fueraDeServicio", false) = false
		ORDER BY th."precio", h."numero";
	`;

		const habitaciones = await sequelize.query(sql, {
			replacements: { fechaInicio, fechaFin },
			type: QueryTypes.SELECT,
		});

		res.json({
			fechaInicio,
			fechaFin,
			habitaciones
		});
	} catch (err) {
		console.error("Error al obtener habitaciones disponibles (público):", err);
		next(err);
	}
};

// POST /habitaciones
export const createHabitacion = async (req, res, next) => {
	const { idTipoHabitacion, numero, fueraDeServicio } = req.body;
	try {
		const nombre = await TipoHabitacion.findByPk(idTipoHabitacion);
		if (!nombre) {
			return res.status(400).json({ error: "Tipo de habitación no válido" });
		}

		const nueva = await Habitacion.create({
			idTipoHabitacion,
			numero,
			fueraDeServicio: typeof fueraDeServicio === "boolean" ? fueraDeServicio : false,
		});
		res.status(201).json(nueva);
	} catch (err) {
		console.error("Error creando habitación:", err);
		if (err.name === "SequelizeValidationError") {
			return res.status(400).json({ error: err.errors.map((e) => e.message) });
		}
		next(err);
	}
};

// PUT /habitaciones/:id
export const updateHabitacion = async (req, res, next) => {
	const { idTipoHabitacion, numero, fueraDeServicio } = req.body;
	try {
		const h = await Habitacion.findByPk(req.params.id);
		if (!h) return res.status(404).json({ error: "No existe habitación" });

		if (idTipoHabitacion !== undefined) {
			const nombre = await TipoHabitacion.findByPk(idTipoHabitacion);
			if (!nombre) {
				return res.status(400).json({ error: "Tipo de habitación no válido" });
			}
			h.idTipoHabitacion = idTipoHabitacion;
		}

		if (numero !== undefined) {
			h.numero = numero;
		}
		if (fueraDeServicio !== undefined) {
			h.fueraDeServicio = Boolean(fueraDeServicio);
		}

		await h.save();
		res.json(h);
	} catch (err) {
		console.error(`Error actualizando habitación ${req.params.id}:`, err);
		if (err.name === "SequelizeValidationError") {
			return res.status(400).json({ error: err.errors.map((e) => e.message) });
		}
		next(err);
	}
};

// PUT /habitaciones/:id/fuera-de-servicio
export const toggleFueraDeServicio = async (req, res, next) => {
	try {
		const h = await Habitacion.findByPk(req.params.id);
		if (!h) return res.status(404).json({ error: "No existe habitación" });

		h.fueraDeServicio = !h.fueraDeServicio;
		await h.save();

		broadcast("habitacion_actualizada", {
			idHabitacion: h.idHabitacion,
			numero: h.numero,
			fueraDeServicio: h.fueraDeServicio,
		});

		res.json({
			idHabitacion: h.idHabitacion,
			numero: h.numero,
			fueraDeServicio: h.fueraDeServicio,
		});
	} catch (err) {
		console.error(`Error al cambiar estado de servicio de habitación ${req.params.id}:`, err);
		next(err);
	}
};

// DELETE /habitaciones/:id
export const deleteHabitacion = async (req, res, next) => {
	try {
		const h = await Habitacion.findByPk(req.params.id);
		if (!h) return res.status(404).json({ error: "No existe habitación" });

		// Verificar si existen reservas asociadas a esta habitación
		const reservasCount = await Reserva.count({
			where: { idHabitacion: req.params.id }
		});

		if (reservasCount > 0) {
			return res.status(400).json({
				error: `No se puede eliminar la habitación porque tiene ${reservasCount} reserva${reservasCount > 1 ? 's' : ''} asociada${reservasCount > 1 ? 's' : ''}. Por favor, elimine primero las reservas.`
			});
		}

		await h.destroy();
		res.status(204).end();
	} catch (err) {
		console.error(`Error eliminando habitación ${req.params.id}:`, err);

		// Manejar específicamente errores de foreign key
		if (err.name === 'SequelizeForeignKeyConstraintError') {
			return res.status(400).json({
				error: 'No se puede eliminar la habitación porque tiene reservas asociadas. Por favor, elimine primero las reservas.'
			});
		}

		next(err);
	}
};
