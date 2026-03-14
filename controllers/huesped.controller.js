import { Huesped } from "../models/huesped.js";
import { Sequelize } from "sequelize";
import { isDniBlacklisted } from "./huespedNoDeseado.controller.js";

const requiredFields = [
	"nombre",
	"apellido",
	"dni",
	"telefono",
	"origen",
];

export const getAllHuespedes = async (req, res, next) => {
	try {
		const list = await Huesped.findAll();
		res.json(list);
	} catch (err) {
		console.error("Error al obtener huéspedes:", err);
		next(err);
	}
};

export const getHuespedById = async (req, res, next) => {
	try {
		const h = await Huesped.findByPk(req.params.id);
		if (!h) return res.status(404).json({ error: "No existe huésped" });
		res.json(h);
	} catch (err) {
		console.error(`Error al obtener huésped ${req.params.id}:`, err);
		next(err);
	}
};

export const createHuesped = async (req, res, next) => {
	// Validación de campos obligatorios
	const missing = requiredFields.filter((field) => !req.body[field]);
	if (missing.length) {
		return res
			.status(400)
			.json({ error: `Faltan campos obligatorios: ${missing.join(", ")}` });
	}

	try {
		const existente = await Huesped.findOne({ where: { dni: req.body.dni } });
		if (existente) {
			return res.status(409).json({ error: "Ya existe un huésped con ese DNI." });
		}

		const nuevo = await Huesped.create(req.body);
		res.status(201).json(nuevo);
	} catch (err) {
		console.error("Error al crear huésped:", err);
		if (
			err instanceof Sequelize.ValidationError ||
			err instanceof Sequelize.UniqueConstraintError
		) {
			return res.status(400).json({ error: err.errors.map((e) => e.message) });
		}
		next(err);
	}
};

export const updateHuesped = async (req, res, next) => {
	try {
		const huesped = await Huesped.findByPk(req.params.id);
		if (!huesped) {
			return res.status(404).json({ error: "No existe huésped" });
		}

		// Validar campos obligatorios si se envían
		const missing = requiredFields.filter(
			(field) => req.body[field] !== undefined && !req.body[field]
		);
		if (missing.length) {
			return res.status(400).json({
				error: `Campos obligatorios vacíos: ${missing.join(", ")}`,
			});
		}

		await huesped.update(req.body);
		const actualizado = await Huesped.findByPk(req.params.id);
		res.json(actualizado);
	} catch (err) {
		console.error(`Error al actualizar huésped ${req.params.id}:`, err);
		if (
			err instanceof Sequelize.ValidationError ||
			err instanceof Sequelize.UniqueConstraintError
		) {
			return res.status(400).json({ error: err.errors.map((e) => e.message) });
		}
		next(err);
	}
};

export const deleteHuesped = async (req, res, next) => {
	try {
		const huesped = await Huesped.findByPk(req.params.id);
		if (!huesped) {
			return res.status(404).json({ error: "No existe huésped" });
		}

		await huesped.destroy();
		res.status(204).end();
	} catch (err) {
		console.error(`Error al eliminar huésped ${req.params.id}:`, err);
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
	if (!dni) return res.status(400).json({ error: "DNI requerido" });

	const dniNum = Number(dni);
	if (!Number.isInteger(dniNum) || dniNum <= 0) {
		return res.status(400).json({ error: "DNI inválido" });
	}

	try {
		if (await isDniBlacklisted(dni)) {
			return res.status(403).json({ code: "DNI_BLACKLISTED" });
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
 * El teléfono se compara ignorando espacios y guiones.
 */
export const verificarTelefonoHuesped = async (req, res, next) => {
	const { dni, telefono } = req.body;
	if (!dni || !telefono) {
		return res.status(400).json({ error: "DNI y teléfono son requeridos" });
	}

	const dniNum = Number(dni);
	if (!Number.isInteger(dniNum) || dniNum <= 0) {
		return res.status(400).json({ error: "DNI inválido" });
	}

	try {
		const huesped = await Huesped.findOne({ where: { dni: dniNum } });
		if (!huesped) {
			return res.status(404).json({ error: "Huésped no encontrado" });
		}

		const normalizar = (t) => {
			const digits = String(t).replace(/\D/g, "");
			return digits.replace(/^549/, "54");
		};
		if (normalizar(huesped.telefono) !== normalizar(telefono)) {
			return res.status(401).json({ error: "El teléfono no coincide" });
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
