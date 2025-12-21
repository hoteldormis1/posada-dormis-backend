import { Usuario } from "../models/usuario.js";
import { TipoUsuario } from "../models/tipoUsuario.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { sendEmail } from "../helpers/mailer.js";

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
            subject: "Invitación: verificá tu cuenta",
            html: `<p>Hola ${nombre},</p>
<p>El administrador te creó una cuenta. Para activarla y establecer tu contraseña, hacé click:</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>El enlace vence en 24 horas.</p>`,
        });
    } catch (err) {
        console.error("Error enviando invitación", err);
    }

    return res.json({ message: "Invitación enviada" });
}


