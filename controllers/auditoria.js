import { Auditoria } from "../models/auditoria.js";
import { Usuario } from "../models/usuario.js";
import { Op, Sequelize } from "sequelize";

export const getAllAuditorias = async (req, res, next) => {
	try {
		const page = parseInt(req.query.page, 10) || 1;
		const size = parseInt(req.query.size, 10) || 10;
		const search = (req.query.search || "").trim();

		// Campos de ordenamiento
		const sortField = req.query.sortField || "fecha"; // Por defecto ordena por fecha
		const sortOrder = (req.query.sortOrder || "DESC").toUpperCase(); // ASC o DESC

		const limit = size;
		const offset = (page - 1) * size;

		const whereCondition = search
			? {
					[Op.or]: [
						{ metodo: { [Op.like]: `%${search}%` } },
						{ ruta: { [Op.like]: `%${search}%` } },
						{ accion: { [Op.like]: `%${search}%` } },
						Sequelize.where(Sequelize.col("Usuario.nombre"), {
							[Op.like]: `%${search}%`,
						}),
						Sequelize.where(Sequelize.col("Usuario.email"), {
							[Op.like]: `%${search}%`,
						}),
					],
			  }
			: {};

		const { count, rows } = await Auditoria.findAndCountAll({
			where: whereCondition,
			limit,
			offset,
			order: [[sortField, sortOrder]], // Orden dinámico
			include: [
				{
					model: Usuario,
					attributes: ["idUsuario", "nombre", "email"],
					required: false, // LEFT JOIN
				},
			],
		});

		const auditorias = rows.map((a) => ({
			id: a.id,
			idUsuario: a.idUsuario,
			status: a.status,
			ruta: a.ruta,
			metodo: a.metodo,
			accion: a.accion,
			fecha: a.fecha,
			datos: a.datos,
			nombreUsuario: a.Usuario?.nombre ?? null,
			emailUsuario: a.Usuario?.email ?? null,
		}));

		res.json({
			total: count,
			page,
			pageSize: size,
			data: auditorias,
			sortField,
			sortOrder,
		});
	} catch (error) {
		console.error("Error al obtener auditorías:", error);
		res
			.status(500)
			.json({ message: "Error al obtener auditorías", error: error.message });
		next(error);
	}
};
