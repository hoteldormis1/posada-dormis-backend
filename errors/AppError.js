/**
 * Error de aplicación con código semántico, status HTTP y mensaje amigable.
 * Lanzar con: throw new AppError("ENTITY_NOT_FOUND", 404, "No existe la reserva")
 */
export class AppError extends Error {
	/**
	 * @param {string} code  - Código semántico (ej. "ENTITY_NOT_FOUND")
	 * @param {number} status - HTTP status (400, 404, 409, 403…)
	 * @param {string} message - Mensaje legible por el usuario
	 * @param {object} [details] - Info extra opcional (ej. entidades en conflicto)
	 */
	constructor(code, status, message, details = null) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.status = status;
		this.details = details;
	}
}

// ── Códigos estándar del sistema ────────────────────────────────────────────

export const ERROR_CODES = {
	// Entidad
	ENTITY_NOT_FOUND: "ENTITY_NOT_FOUND",
	ENTITY_IN_USE: "ENTITY_IN_USE",

	// Validación
	VALIDATION_ERROR: "VALIDATION_ERROR",
	MISSING_FIELDS: "MISSING_FIELDS",
	INVALID_DATE_RANGE: "INVALID_DATE_RANGE",

	// Conflictos de negocio
	DNI_DUPLICADO: "DNI_DUPLICADO",
	DNI_EXISTS: "DNI_EXISTS",
	DNI_BLACKLISTED: "DNI_BLACKLISTED",
	ROOM_UNAVAILABLE: "ROOM_UNAVAILABLE",
	ROOM_OUT_OF_SERVICE: "ROOM_OUT_OF_SERVICE",
	ESTADO_TRANSICION_INVALIDA: "ESTADO_TRANSICION_INVALIDA",
	MONTO_INVALIDO: "MONTO_INVALIDO",
	ESTADIA_MINIMA: "ESTADIA_MINIMA",

	// Autenticación / autorización
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	TOKEN_MISSING: "TOKEN_MISSING",
	TOKEN_INVALID: "TOKEN_INVALID",
	TOKEN_EXPIRED: "TOKEN_EXPIRED",

	// Integridad referencial
	FK_CONSTRAINT: "FK_CONSTRAINT",
	UNIQUE_CONSTRAINT: "UNIQUE_CONSTRAINT",

	// Servidor
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

/**
 * Helpers para errores frecuentes.
 * Ejemplo: throw notFound("Reserva")
 */
export const notFound = (entity) =>
	new AppError(ERROR_CODES.ENTITY_NOT_FOUND, 404, `${entity} no encontrada/o.`);

export const entityInUse = (entity, count, relacion) =>
	new AppError(
		ERROR_CODES.ENTITY_IN_USE,
		409,
		`No se puede eliminar ${entity} porque tiene ${count} ${relacion} asociada${count !== 1 ? "s" : ""}.`,
		{ count, relacion }
	);

export const missingFields = (fields) =>
	new AppError(
		ERROR_CODES.MISSING_FIELDS,
		400,
		`Faltan campos obligatorios: ${fields.join(", ")}.`,
		{ fields }
	);

export const dniExists = (dni, nombre, apellido, idHuesped) =>
	new AppError(
		ERROR_CODES.DNI_EXISTS,
		409,
		`El DNI ${dni} ya está registrado para ${nombre} ${apellido}. Usá el modo "Huésped existente" para seleccionarlo.`,
		{ idHuesped, nombre, apellido, dni }
	);
