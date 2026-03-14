import { Huesped } from "../models/huesped.js";
import { Reserva } from "../models/reserva.js";
import { isDniBlacklisted } from "./huespedNoDeseado.controller.js";
import { AppError, ERROR_CODES, notFound, missingFields, dniExists, entityInUse } from "../errors/AppError.js";

const requiredFields = ["nombre", "apellido", "dni", "telefono", "origen"];

export const getAllHuespedes = async (req, res, next) => {
	try {
		const list = await Huesped.findAll();
		res.json(list);
	} catch (err) {
		next(err);
	}
};

export const getHuespedById = async (req, res, next) => {
	try {
		const h = await Huesped.findByPk(req.params.id);
		if (!h) throw notFound("Huésped");
		res.json(h);
	} catch (err) {
		next(err);
	}
};

export const createHuesped = async (req, res, next) => {
	try {
		const missing = requiredFields.filter((field) => !req.body[field]);
		if (missing.length) throw missingFields(missing);

		const existente = await Huesped.findOne({ where: { dni: req.body.dni } });
		if (existente) {
			throw new AppError(
				ERROR_CODES.DNI_DUPLICADO,
				409,
				`Ya existe un huésped con DNI ${req.body.dni}: ${existente.nombre} ${existente.apellido}.`,
				{ idHuesped: existente.idHuesped, nombre: existente.nombre, apellido: existente.apellido }
			);
		}

		const nuevo = await Huesped.create(req.body);
		res.status(201).json(nuevo);
	} catch (err) {
		next(err);
	}
};

export const updateHuesped = async (req, res, next) => {
	try {
		const huesped = await Huesped.findByPk(req.params.id);
		if (!huesped) throw notFound("Huésped");

		const missing = requiredFields.filter(
			(field) => req.body[field] !== undefined && !req.body[field]
		);
		if (missing.length) throw missingFields(missing);

		// Validar DNI único si se intenta cambiar
		if (req.body.dni && Number(req.body.dni) !== Number(huesped.dni)) {
			const existente = await Huesped.findOne({ where: { dni: req.body.dni } });
			if (existente) {
				throw new AppError(
					ERROR_CODES.DNI_DUPLICADO,
					409,
					`El DNI ${req.body.dni} ya está registrado para ${existente.nombre} ${existente.apellido}.`,
					{ idHuesped: existente.idHuesped, nombre: existente.nombre, apellido: existente.apellido }
				);
			}
		}

		await huesped.update(req.body);
		const actualizado = await Huesped.findByPk(req.params.id);
		res.json(actualizado);
	} catch (err) {
		next(err);
	}
};

export const deleteHuesped = async (req, res, next) => {
	try {
		const huesped = await Huesped.findByPk(req.params.id);
		if (!huesped) throw notFound("Huésped");

		// Verificar reservas activas o históricas antes de eliminar
		const reservasCount = await Reserva.count({ where: { idHuesped: req.params.id } });
		if (reservasCount > 0) {
			throw entityInUse("el huésped", reservasCount, "reserva");
		}

		await huesped.destroy();
		res.status(204).end();
	} catch (err) {
		next(err);
	}
};

// ─── Endpoints públicos para pre-llenar formulario de reserva ───────────────

/**
 * Paso 1: recibe DNI, responde solo si existe o no.
 * NO devuelve datos personales para evitar enumeración.
 */
export const buscarHuespedPorDni = async (req, res, next) => {
	const { dni } = req.body;
	if (!dni) return res.status(400).json({ code: ERROR_CODES.MISSING_FIELDS, error: "DNI requerido" });

	const dniNum = Number(dni);
	if (!Number.isInteger(dniNum) || dniNum <= 0) {
		return res.status(400).json({ code: ERROR_CODES.VALIDATION_ERROR, error: "DNI inválido" });
	}

	try {
		if (await isDniBlacklisted(dni)) {
			return res.status(403).json({ code: ERROR_CODES.DNI_BLACKLISTED, error: "DNI en lista de no deseados." });
		}
		const existe = await Huesped.findOne({ where: { dni: dniNum } });
		return res.json({ encontrado: !!existe });
	} catch (err) {
		next(err);
	}
};

/**
 * Paso 2: recibe DNI + teléfono.
 * Solo devuelve los datos del huésped si ambos coinciden.
 */
export const verificarTelefonoHuesped = async (req, res, next) => {
	const { dni, telefono } = req.body;
	if (!dni || !telefono) {
		return res.status(400).json({ code: ERROR_CODES.MISSING_FIELDS, error: "DNI y teléfono son requeridos" });
	}

	const dniNum = Number(dni);
	if (!Number.isInteger(dniNum) || dniNum <= 0) {
		return res.status(400).json({ code: ERROR_CODES.VALIDATION_ERROR, error: "DNI inválido" });
	}

	try {
		const huesped = await Huesped.findOne({ where: { dni: dniNum } });
		if (!huesped) throw notFound("Huésped");

		const normalizar = (t) => String(t).replace(/\D/g, "").replace(/^549/, "54");
		if (normalizar(huesped.telefono) !== normalizar(telefono)) {
			return res.status(401).json({ code: ERROR_CODES.UNAUTHORIZED, error: "El teléfono no coincide" });
		}

		return res.json({
			idHuesped: huesped.idHuesped,
			nombre: huesped.nombre,
			apellido: huesped.apellido,
			dni: huesped.dni,
			telefono: huesped.telefono,
			origen: huesped.origen,
			email: huesped.email ?? "",
			direccion: huesped.direccion ?? "",
		});
	} catch (err) {
		next(err);
	}
};
