/**
 * Store en memoria para reservas pendientes de confirmacion de identidad.
 * Cada entrada expira a las 4 horas.
 * En produccion se puede reemplazar por Redis o una tabla temporal en DB.
 */

const TTL_MS = 4 * 60 * 60 * 1000; // 4 horas

/** @type {Map<string, { data: object, expiresAt: number }>} */
const store = new Map();

export function guardarPendiente(token, data) {
	store.set(token, { data, expiresAt: Date.now() + TTL_MS });
}

export function obtenerPendiente(token) {
	const entry = store.get(token);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		store.delete(token);
		return null;
	}
	return entry.data;
}

export function eliminarPendiente(token) {
	store.delete(token);
}

// Limpiar entradas expiradas cada 15 minutos
setInterval(() => {
	const now = Date.now();
	for (const [key, val] of store.entries()) {
		if (now > val.expiresAt) store.delete(key);
	}
}, 15 * 60 * 1000);
