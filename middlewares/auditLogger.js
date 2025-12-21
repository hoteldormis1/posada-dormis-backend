import { Auditoria } from "../models/auditoria.js";

const SENSITIVE_KEYS = ["clave", "password", "token"]; // podés agregar más

function sanitize(obj) {
	if (!obj || typeof obj !== "object") return obj;

	const copy = Array.isArray(obj) ? [...obj] : { ...obj };

	for (const key in copy) {
		if (SENSITIVE_KEYS.includes(key)) {
			delete copy[key];
		} else if (typeof copy[key] === "object") {
			copy[key] = sanitize(copy[key]); // recursivo para objetos anidados
		}
	}

	return copy;
}

export const auditLogger = (action) => (req, res, next) => {
	const idUsuario = req?.user?.userId ?? null;

	res.on("finish", async () => {
		try {
			const safeBody = sanitize(req.body);
			const safeParams = sanitize(req.params);

			await Auditoria.create({
				idUsuario,
				ruta: req.originalUrl,
				metodo: req.method,
				accion: action,
				status: res.statusCode,
				fecha: new Date(),
				datos: {
					body: safeBody,
					params: safeParams,
				},
			});
		} catch (err) {
			console.error("Error guardando auditoría:", err);
		}
	});

	next();
};
