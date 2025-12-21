import { Usuario } from "../models/usuario.js";
import { TipoUsuario } from "../models/tipoUsuario.js";

// Middleware de autorización basado en TipoUsuario.permisos
// Uso: authorize("usuario", "create" | "read" | "update" | "delete")
export function authorize(resource, action) {
    return async function authorizeMiddleware(req, res, next) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ message: "No autenticado" });
            }

            // Cargar usuario con su TipoUsuario (rol) solo si aún no está en req.auth
            if (!req.auth?.permisos) {
                const user = await Usuario.findByPk(userId, {
                    include: [{ model: TipoUsuario, attributes: ["idTipoUsuario", "nombre", "permisos", "activo"] }],
                });

                if (!user || !user.TipoUsuario || user.TipoUsuario.activo === false) {
                    return res.status(403).json({ message: "No autorizado" });
                }

                req.auth = {
                    userId,
                    rol: user.TipoUsuario.nombre,
                    permisos: user.TipoUsuario.permisos || {},
                };
            }

            const permisos = req.auth.permisos || {};
            const resourcePerms = permisos[resource] || {};
            const allowed = Boolean(resourcePerms?.[action]);

            if (!allowed) {
                return res
                    .status(403)
                    .json({ message: "No tenés permisos para realizar esta acción" });
            }

            return next();
        } catch (err) {
            console.error("Error en autorización:", err);
            return res.status(500).json({ message: "Error interno de autorización" });
        }
    };
}


