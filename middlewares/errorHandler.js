import { AppError, ERROR_CODES } from "../errors/AppError.js";

/**
 * Middleware global de manejo de errores para Express.
 * Debe registrarse ÚLTIMO en index.js (después de todas las rutas).
 *
 * Mapea automáticamente errores de Sequelize a respuestas HTTP consistentes.
 * Respuesta siempre: { code, error, details? }
 */
export const errorHandler = (err, req, res, next) => {
	// ── Error de negocio conocido (lanzado con AppError) ──────────────────────
	if (err instanceof AppError) {
		return res.status(err.status).json({
			code: err.code,
			error: err.message,
			...(err.details ? { details: err.details } : {}),
		});
	}

	// ── Errores de Sequelize ──────────────────────────────────────────────────

	if (err.name === "SequelizeValidationError") {
		return res.status(400).json({
			code: ERROR_CODES.VALIDATION_ERROR,
			error: "Error de validación.",
			details: err.errors.map((e) => ({ field: e.path, message: e.message })),
		});
	}

	if (err.name === "SequelizeUniqueConstraintError") {
		const field = err.errors?.[0]?.path ?? "campo";
		return res.status(409).json({
			code: ERROR_CODES.UNIQUE_CONSTRAINT,
			error: `Ya existe un registro con ese valor en "${field}".`,
			details: err.errors.map((e) => ({ field: e.path, message: e.message })),
		});
	}

	if (err.name === "SequelizeForeignKeyConstraintError") {
		return res.status(409).json({
			code: ERROR_CODES.FK_CONSTRAINT,
			error: "No se puede realizar la operación porque existen datos relacionados.",
			details: { table: err.table ?? null, constraint: err.index ?? null },
		});
	}

	if (err.name === "SequelizeDatabaseError") {
		console.error("DB error:", err.message, err.sql);
		return res.status(500).json({
			code: ERROR_CODES.INTERNAL_ERROR,
			error: "Error interno de base de datos.",
		});
	}

	// ── Error inesperado ──────────────────────────────────────────────────────
	console.error(`[${new Date().toISOString()}] Error inesperado en ${req.method} ${req.originalUrl}:`, err);

	return res.status(500).json({
		code: ERROR_CODES.INTERNAL_ERROR,
		error: "Error interno del servidor.",
	});
};
