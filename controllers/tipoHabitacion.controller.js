import { TipoHabitacion } from "../models/tipoHabitacion.js";
import { Habitacion } from "../models/habitacion.js";

export const getAllTipoHabitaciones = async (req, res, next) => {
	try {
		const lista = await TipoHabitacion.findAll();
		res.json(lista);
	} catch (err) {
		console.error("Error al obtener tipos de habitación:", err);
		next(err);
	}
};

export const getTipoHabitacionById = async (req, res, next) => {
	try {
		const t = await TipoHabitacion.findByPk(req.params.id);
		if (!t) {
			return res.status(404).json({ error: "No existe tipo de habitación" });
		}
		res.json(t);
	} catch (err) {
		console.error(`Error al obtener tipo de habitación ${req.params.id}:`, err);
		next(err);
	}
};

/**
 * Crea un nuevo tipo de habitación
 */
export const createTipoHabitacion = async (req, res, next) => {
	try {
		const { nombre, precio } = req.body;

		if (!nombre || precio == null) {
			return res.status(400).json({ error: "Nombre y precio son obligatorios" });
		}

		const nuevoTipo = await TipoHabitacion.create({
			nombre,
			precio,
		});

		res.status(201).json(nuevoTipo);
	} catch (err) {
		console.error("Error al crear tipo de habitación:", err);
		next(err);
	}
};

/**
 * Actualiza un tipo de habitación existente
 */
export const updateTipoHabitacion = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { nombre, precio } = req.body;

		if (!nombre || precio == null) {
			return res.status(400).json({ error: "Nombre y precio son obligatorios" });
		}

		const tipo = await TipoHabitacion.findByPk(id);
		if (!tipo) {
			return res.status(404).json({ error: "No existe tipo de habitación" });
		}

		await tipo.update({
			nombre,
			precio,
		});

		res.json(tipo);
	} catch (err) {
		console.error("Error al actualizar tipo de habitación:", err);
		next(err);
	}
};

/**
 * Elimina un tipo de habitación
 */
export const deleteTipoHabitacion = async (req, res, next) => {
	try {
		const { id } = req.params;

		const tipo = await TipoHabitacion.findByPk(id);
		if (!tipo) {
			return res.status(404).json({ error: "No existe tipo de habitación" });
		}

		// Verificar si existen habitaciones asociadas a este tipo
		const habitacionesCount = await Habitacion.count({
			where: { idTipoHabitacion: id }
		});

		if (habitacionesCount > 0) {
			return res.status(400).json({ 
				error: `No se puede eliminar el tipo de habitación "${tipo.nombre}" porque tiene ${habitacionesCount} habitación${habitacionesCount > 1 ? 'es' : ''} asociada${habitacionesCount > 1 ? 's' : ''}. Por favor, elimine primero las habitaciones o cambie su tipo.` 
			});
		}

		await tipo.destroy();
		res.json({ message: "Tipo de habitación eliminado exitosamente" });
	} catch (err) {
		console.error("Error al eliminar tipo de habitación:", err);
		
		// Manejar específicamente errores de foreign key
		if (err.name === 'SequelizeForeignKeyConstraintError') {
			return res.status(400).json({ 
				error: 'No se puede eliminar el tipo de habitación porque tiene habitaciones asociadas. Por favor, elimine primero las habitaciones o cambie su tipo.' 
			});
		}
		
		next(err);
	}
};