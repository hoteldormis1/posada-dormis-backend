import { HuespedNoDeseado } from "../models/huespedNoDeseado.js";
import { Sequelize } from "sequelize";

export const getAllHuespedNoDeseado = async (req, res, next) => {
	try {
		const list = await HuespedNoDeseado.findAll({
			order: [["createdAt", "DESC"]],
		});
		res.json(list);
	} catch (err) {
		console.error("Error al obtener lista negra:", err);
		next(err);
	}
};

export const createHuespedNoDeseado = async (req, res, next) => {
	const { dni, motivo, observaciones } = req.body;

	if (!dni || String(dni).trim().length < 7) {
		return res.status(400).json({ error: "El DNI es obligatorio (mínimo 7 caracteres)" });
	}

	try {
		const existe = await HuespedNoDeseado.findOne({ where: { dni: String(dni).trim() } });
		if (existe) {
			return res.status(409).json({ error: "Este DNI ya se encuentra en la lista negra" });
		}

		const nuevo = await HuespedNoDeseado.create({
			dni: String(dni).trim(),
			motivo: motivo ? String(motivo).trim() : null,
			observaciones: observaciones ? String(observaciones).trim() : null,
		});

		res.status(201).json(nuevo);
	} catch (err) {
		console.error("Error al agregar a lista negra:", err);
		if (
			err instanceof Sequelize.ValidationError ||
			err instanceof Sequelize.UniqueConstraintError
		) {
			return res.status(400).json({ error: err.errors.map((e) => e.message) });
		}
		next(err);
	}
};

export const updateHuespedNoDeseado = async (req, res, next) => {
	try {
		const item = await HuespedNoDeseado.findByPk(req.params.id);
		if (!item) {
			return res.status(404).json({ error: "Registro no encontrado" });
		}

		const { dni, motivo, observaciones } = req.body;

		if (dni && String(dni).trim().length < 7) {
			return res.status(400).json({ error: "El DNI debe tener mínimo 7 caracteres" });
		}

		await item.update({
			...(dni && { dni: String(dni).trim() }),
			...(motivo !== undefined && { motivo: motivo ? String(motivo).trim() : null }),
			...(observaciones !== undefined && { observaciones: observaciones ? String(observaciones).trim() : null }),
		});

		const updated = await HuespedNoDeseado.findByPk(req.params.id);
		res.json(updated);
	} catch (err) {
		console.error("Error al actualizar lista negra:", err);
		if (
			err instanceof Sequelize.ValidationError ||
			err instanceof Sequelize.UniqueConstraintError
		) {
			return res.status(400).json({ error: err.errors.map((e) => e.message) });
		}
		next(err);
	}
};

export const deleteHuespedNoDeseado = async (req, res, next) => {
	try {
		const item = await HuespedNoDeseado.findByPk(req.params.id);
		if (!item) {
			return res.status(404).json({ error: "Registro no encontrado" });
		}

		await item.destroy();
		res.status(204).end();
	} catch (err) {
		console.error("Error al eliminar de lista negra:", err);
		next(err);
	}
};

/**
 * Checks if a DNI is blacklisted. Used internally by reservation controllers.
 */
export const isDniBlacklisted = async (dni) => {
	if (!dni) return false;
	const found = await HuespedNoDeseado.findOne({ where: { dni: String(dni).trim() } });
	return !!found;
};
