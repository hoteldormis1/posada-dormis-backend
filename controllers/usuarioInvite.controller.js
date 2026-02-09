import { Usuario } from "../models/usuario.js";
import { TipoUsuario } from "../models/tipoUsuario.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { sendEmail } from "../helpers/mailer.js";
import { baseTemplate } from "../helpers/emailTemplate.js";

export async function inviteUsuario(req, res) {
    const { nombre, email, tipoUsuario } = req.body || {};
    if (!nombre || !email || !tipoUsuario) {
        return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    const tipo = await TipoUsuario.findOne({ where: { nombre: tipoUsuario } });
    if (!tipo) return res.status(404).json({ message: "Tipo de usuario no encontrado" });

    let user = await Usuario.findOne({ where: { email } });
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tempPassword = crypto.randomBytes(12).toString("hex");
    const hashed = await bcrypt.hash(tempPassword, 10);

    if (!user) {
        user = await Usuario.create({
            nombre,
            email,
            clave: hashed,
            idTipoUsuario: tipo.idTipoUsuario,
            verificado: false,
            verifyToken,
            verifyTokenExpires,
        });
    } else {
        user.nombre = nombre;
        user.idTipoUsuario = tipo.idTipoUsuario;
        user.verificado = false;
        user.verifyToken = verifyToken;
        user.verifyTokenExpires = verifyTokenExpires;
        await user.save();
    }

    try {
        const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
        const verifyUrl = `${appBaseUrl}/verificarCuenta?code=${verifyToken}`;
        await sendEmail({
            to: email,
            subject: "Invitación: verificá tu cuenta — Posada Dormi's",
            html: baseTemplate({
                titulo: "Activá tu cuenta",
                color: "#43AC6A",
                contenido: `
                    <p style="font-size: 16px; color: #111827;">Hola <strong>${nombre}</strong>,</p>
                    <p style="font-size: 15px; color: #374151; line-height: 1.6;">
                        El administrador te creó una cuenta. Para activarla y establecer tu contraseña, hacé click en el siguiente botón:
                    </p>
                    <p style="margin: 24px 0; text-align: center;">
                        <a href="${verifyUrl}"
                           style="background-color: #43AC6A; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 15px;">
                            Activar cuenta
                        </a>
                    </p>
                    <p style="font-size: 13px; color: #6b7280; background: #f3f4f6; padding: 12px 16px; border-radius: 8px; word-break: break-all;">
                        O copiá y pegá este enlace: ${verifyUrl}
                    </p>
                    <p style="font-size: 14px; color: #6b7280; margin-top: 16px;"><strong>El enlace vence en 24 horas.</strong></p>
                `,
            }),
        });
    } catch (err) {
        console.error("Error enviando invitación", err);
    }

    return res.json({ message: "Invitación enviada" });
}
