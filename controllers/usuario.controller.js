import { Op } from "sequelize";
import { Usuario } from "../models/usuario.js";

/**
 * GET /usuarios
 */

export const getAllUsuarios = async (req, res, next) => {
	try {
		const page = parseInt(req.query.page, 10) || 1;
		const size = parseInt(req.query.size, 10) || 10;
		const search = req.query.search || "";

		// Campos de ordenamiento
		const sortField = req.query.sortField || "idUsuario";
		const sortOrder =
			req.query.sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";

		const limit = size;
		const offset = (page - 1) * size;

		const whereCondition = search
			? {
				[Op.or]: [
					{ nombre: { [Op.iLike]: `%${search}%` } },
					{ email: { [Op.iLike]: `%${search}%` } },
				],
			}
			: {};

		const { count, rows } = await Usuario.findAndCountAll({
			where: whereCondition,
			limit,
			offset,
			attributes: { exclude: ["clave"] },
			order: [[sortField, sortOrder]], // <- orden dinámico
		});

		res.json({
			total: count,
			page,
			pageSize: size,
			data: rows,
			sortField,
			sortOrder,
		});
	} catch (err) {
		console.error("Error al obtener usuarios:", err);
		next(err);
	}
};
/**
 * DELETE /usuarios/:id
 */
export const deleteUsuario = async (req, res, next) => {
	try {
		const u = await Usuario.findByPk(req.params.id);
		if (!u) {
			return res.status(404).json({ error: "No existe usuario" });
		}
		await u.destroy();
		return res.status(204).end();
	} catch (err) {
		console.error(`Error al eliminar usuario ${req.params.id}:`, err);
		return next(err);
	}
};

/**
 * GET /usuarios/me
 * Devuelve el usuario autenticado (sin la clave).
 */
export const getCurrentUsuario = async (req, res, next) => {
	try {
		const userId =
			req.user?.idUsuario ||
			req.user?.userId ||
			req.auth?.userId ||
			req.userId ||
			res?.locals?.user?.idUsuario ||
			res?.locals?.user?.userId ||
			null;

		if (!userId) {
			return res.status(401).json({ error: "No autenticado" });
		}

		const user = await Usuario.findByPk(userId, {
			attributes: ["idUsuario", "nombre", "email", "idTipoUsuario", "verificado"], // 👈 solo estos campos
		});

		if (!user) {
			return res.status(404).json({ error: "Usuario no encontrado" });
		}

		return res.json(user);
	} catch (err) {
		console.error("Error al obtener el usuario actual:", err);
		return next(err);
	}
};
