import { EstadoReserva } from "../models/estadoReserva.js";

/**
 * Devuelve todos los estados de habitación
 */
export const getAllEstadosDeReserva = async (req, res, next) => {
	try {
		const estados = await EstadoReserva.findAll();
		return res.json(estados);
	} catch (error) {
		// Pasa el error al handler de errores de Express
		next(error);
	}
};

/**
 * Crea un nuevo estado de habitación
 */

export const createEstadoDeReserva = async (req, res, next) => {
	try {
		const { nombre } = req.body;

		if (!nombre) {
			return res.status(400).json({ mensaje: "El estado es obligatorio" });
		}

		const nuevoEstado = await EstadoReserva.create({ nombre });

		return res.status(201).json(nuevoEstado);
	} catch (error) {
		next(error);
	}
};
