import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Usuario } from "../models/usuario.js";
import { TipoUsuario } from "../models/index.js";
import { sendEmail } from "../helpers/mailer.js";

const ACCESS_SECRET = process.env.JWT_SECRET_ACCESS;
const REFRESH_SECRET = process.env.JWT_SECRET_REFRESH;
const EXP_ACCESS = process.env.JWT_EXPIRATION_ACCESS || "15m";
const EXP_REFRESH = process.env.JWT_EXPIRATION_REFRESH || "1d";

const IS_PROD = process.env.NODE_ENV === "production";
const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/auth";

export function generateTokens(userId) {
	const accessToken = jwt.sign({ userId }, ACCESS_SECRET, {
		expiresIn: EXP_ACCESS,
	});
	const refreshToken = jwt.sign({ userId }, REFRESH_SECRET, {
		expiresIn: EXP_REFRESH,
	});
	return { accessToken, refreshToken };
}

export async function login(req, res) {
	const { email, clave } = req.body;
	try {
		const user = await Usuario.findOne({ where: { email } });
		if (!user) {
			return res.status(401).json({ message: "Credenciales inválidas" });
		}

		if (!user.verificado) {
			return res.status(403).json({ message: "Cuenta no verificada" });
		}

		const isMatch = await bcrypt.compare(clave, user.clave);
		if (!isMatch) {
			return res.status(401).json({ message: "Credenciales inválidas" });
		}

	const { refreshToken } = generateTokens(user.idUsuario); // solo refresh

	// Primero limpiar cualquier cookie vieja
	res.clearCookie(REFRESH_COOKIE_NAME, {
		httpOnly: true,
		secure: IS_PROD,
		sameSite: IS_PROD ? "None" : "Lax",
		path: REFRESH_COOKIE_PATH,
	});

	// Luego setear la nueva cookie
	res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
		httpOnly: true,
		secure: IS_PROD, // requerido con SameSite=None
		sameSite: IS_PROD ? "None" : "Lax", // Lax en dev, None en prod
		path: REFRESH_COOKIE_PATH, // igual que en clearCookie
		maxAge: parseTimeToMs(EXP_REFRESH),
	});

	return res.status(200).json({ message: "Login exitoso" });
	} catch (err) {
		console.error("Error en login:", err);
		return res.status(500).json({ message: "Error interno del servidor" });
	}
}

export function refresh(req, res) {
	const token = req.cookies?.[REFRESH_COOKIE_NAME];
	
	if (!token) {
		return res.status(401).json({ error: "Falta el token de acceso" });
	}

	try {
		const payload = jwt.verify(token, REFRESH_SECRET);

		const accessToken = jwt.sign({ userId: payload.userId }, ACCESS_SECRET, {
			expiresIn: EXP_ACCESS,
		});

		return res.json({ accessToken });
	} catch (err) {
		console.error("Error en refresh token:", err.message);
		
		// Si el token es inválido, limpiar la cookie
		res.clearCookie(REFRESH_COOKIE_NAME, {
			httpOnly: true,
			secure: IS_PROD,
			sameSite: IS_PROD ? "None" : "Lax",
			path: REFRESH_COOKIE_PATH,
		});
		
		return res.status(403).json({ message: "Token inválido o expirado" });
	}
}

export function logout(req, res) {
	// *** Cambio clave: usar los mismos flags y path que al setearla ***
	res.clearCookie(REFRESH_COOKIE_NAME, {
		httpOnly: true,
		secure: IS_PROD,
		sameSite: IS_PROD ? "None" : "Lax",
		path: REFRESH_COOKIE_PATH,
	});
	return res.json({ message: "Cierre de sesión exitoso" });
}

export async function register(req, res) {
	const { nombre, email, clave, tipoUsuario } = req.body;
	if (!nombre || !email || !tipoUsuario) {
		return res.status(400).json({ message: "Faltan campos obligatorios" });
	}
	try {
		const existing = await Usuario.findOne({ where: { email } });
		if (existing) {
			return res.status(409).json({ message: "El correo ya está en uso" });
		}

		const tipo = await TipoUsuario.findOne({ where: { nombre: tipoUsuario } });
		if (!tipo) {
			return res.status(404).json({ message: "Tipo de usuario no encontrado" });
		}

		const tempPassword = clave || crypto.randomBytes(12).toString("hex");
		const hashed = await bcrypt.hash(tempPassword, 10);

		const verifyToken = crypto.randomBytes(32).toString("hex");
		const verifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

		const user = await Usuario.create({
			nombre,
			email,
			clave: hashed,
			idTipoUsuario: tipo.idTipoUsuario,
			verificado: false,
			verifyToken,
			verifyTokenExpires,
		});

		// Enviar email de verificación (no bloquear respuesta si falla)
		try {
			const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
			const verifyUrl = `${appBaseUrl}/verificarCuenta?code=${verifyToken}`;
			await sendEmail({
				to: email,
				subject: "Verificá tu cuenta",
				html: `<p>Hola ${nombre},</p>
<p>Tu cuenta fue creada por el administrador. Para activarla y establecer tu contraseña, hacé click en el siguiente enlace:</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>El enlace vence en 24 horas.</p>`,
			});
		} catch (mailErr) {
			console.error("No se pudo enviar el email de verificación:", mailErr);
		}

		return res.status(201).json({
			message: "Usuario creado exitosamente",
			user: {
				id: user.idUsuario,
				nombre: user.nombre,
				email: user.email,
				tipo: tipo.nombre,
			},
		});
	} catch (err) {
		console.error("Error en registro:", err);
		return res
			.status(500)
			.json({ message: "Error interno al registrar usuario" });
	}
}

export async function verifyGet(req, res) {
	const { code } = req.query;
	if (!code) return res.status(400).json({ valid: false });

	const user = await Usuario.findOne({ where: { verifyToken: code } });
	if (!user || !user.verifyTokenExpires || user.verifyTokenExpires < new Date()) {
		return res.json({ valid: false });
	}
	return res.json({ valid: true });
}

export async function verifyPost(req, res) {
	const { code, password } = req.body || {};
	if (!code || !password) return res.status(400).json({ message: "Datos inválidos" });

	const user = await Usuario.findOne({ where: { verifyToken: code } });
	if (!user || !user.verifyTokenExpires || user.verifyTokenExpires < new Date()) {
		return res.status(400).json({ message: "Código inválido o vencido" });
	}

	const hashed = await bcrypt.hash(password, 10);
	user.clave = hashed;
	user.verificado = true;
	user.verifyToken = null;
	user.verifyTokenExpires = null;
	await user.save();

	return res.json({ message: "Cuenta verificada" });
}

function parseTimeToMs(timeStr) {
	const match = String(timeStr).match(/^(\d+)([smhd])$/); // s|m|h|d
	if (!match) return null;
	const value = parseInt(match[1], 10);
	const unit = match[2];
	const multipliers = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
	};
	return value * multipliers[unit];
}

/**
 * Solicitar restablecimiento de contraseña
 * Genera un token y envía un email con el enlace de reseteo
 */
export async function requestPasswordReset(req, res) {
	const { email } = req.body;

	if (!email) {
		return res.status(400).json({ message: "El email es requerido" });
	}

	try {
		const user = await Usuario.findOne({ where: { email: email.toLowerCase().trim() } });

		// Por seguridad, siempre respondemos lo mismo aunque el usuario no exista
		if (!user) {
			return res.status(200).json({
				message: "Si el email existe en nuestro sistema, recibirás un correo con instrucciones para restablecer tu contraseña."
			});
		}

		// Generar token de reseteo
		const resetToken = crypto.randomBytes(32).toString("hex");
		const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

		// Guardar token en la base de datos
		user.resetToken = resetToken;
		user.resetTokenExpires = resetTokenExpires;
		await user.save();

		// Enviar email
		try {
			const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
			const resetUrl = `${appBaseUrl}/resetPassword?token=${encodeURIComponent(resetToken)}`;

			await sendEmail({
				to: email,
				subject: "Restablecimiento de contraseña",
				html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<h2 style="color: #43AC6A;">Restablecimiento de contraseña</h2>
						<p>Hola ${user.nombre},</p>
						<p>Recibimos una solicitud para restablecer tu contraseña. Si no fuiste vos, podés ignorar este correo.</p>
						<p>Para restablecer tu contraseña, hacé click en el siguiente enlace:</p>
						<p style="margin: 20px 0;">
							<a href="${resetUrl}" 
							   style="background-color: #43AC6A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
								Restablecer contraseña
							</a>
						</p>
						<p>O copiá y pegá este enlace en tu navegador:</p>
						<p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all;">
							${resetUrl}
						</p>
						<p><strong>Este enlace vence en 1 hora.</strong></p>
						<p>Saludos,<br>El equipo de Dormis</p>
					</div>
				`,
			});
		} catch (mailErr) {
			console.error("Error al enviar email de reseteo:", mailErr);
			// Eliminar el token si no se pudo enviar el email
			user.resetToken = null;
			user.resetTokenExpires = null;
			await user.save();

			return res.status(500).json({
				message: "No se pudo enviar el correo de restablecimiento. Intentá nuevamente más tarde."
			});
		}

		return res.status(200).json({
			message: "Si el email existe en nuestro sistema, recibirás un correo con instrucciones para restablecer tu contraseña."
		});

	} catch (err) {
		console.error("Error en requestPasswordReset:", err);
		return res.status(500).json({ message: "Error interno del servidor" });
	}
}

/**
 * Verificar token de reseteo (GET)
 * Valida si el token es válido y no ha expirado
 */
export async function verifyResetToken(req, res) {
	const { token } = req.query;

	if (!token || token.trim() === '') {
		return res.json({ valid: false, message: "Token no proporcionado" });
	}

	try {
		// Limpiar el token de espacios en blanco
		const cleanToken = token.trim();
		
		const user = await Usuario.findOne({ where: { resetToken: cleanToken } });

		if (!user) {
			console.log(`Token inválido recibido: ${cleanToken.substring(0, 10)}...`);
			return res.json({ valid: false, message: "Token inválido o ya fue utilizado" });
		}

		if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
			console.log(`Token expirado para usuario: ${user.email}`);
			return res.json({ valid: false, message: "Token expirado. Solicitá un nuevo enlace de restablecimiento." });
		}

		return res.json({
			valid: true,
			email: user.email,
			nombre: user.nombre
		});

	} catch (err) {
		console.error("Error en verifyResetToken:", err);
		return res.status(500).json({ valid: false, message: "Error al verificar token" });
	}
}

/**
 * Restablecer contraseña (POST)
 * Cambia la contraseña usando el token válido
 */
export async function resetPassword(req, res) {
	const { token, password } = req.body;

	if (!token || !password) {
		return res.status(400).json({ message: "Token y contraseña son requeridos" });
	}

	if (password.length < 6) {
		return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
	}

	try {
		// Limpiar el token de espacios en blanco
		const cleanToken = token.trim();
		
		const user = await Usuario.findOne({ where: { resetToken: cleanToken } });

		if (!user) {
			console.log(`Intento de reset con token inválido: ${cleanToken.substring(0, 10)}...`);
			return res.status(400).json({ message: "Token inválido o ya fue utilizado. Solicitá un nuevo enlace de restablecimiento." });
		}

		if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
			console.log(`Intento de reset con token expirado para usuario: ${user.email}`);
			return res.status(400).json({ message: "Token expirado. Solicitá un nuevo enlace de restablecimiento." });
		}

		// Cambiar la contraseña
		const hashedPassword = await bcrypt.hash(password, 10);
		user.clave = hashedPassword;
		user.resetToken = null;
		user.resetTokenExpires = null;

		// Si el usuario no estaba verificado, lo verificamos al cambiar la contraseña
		if (!user.verificado) {
			user.verificado = true;
			user.verifyToken = null;
			user.verifyTokenExpires = null;
		}

		await user.save();

		// Opcional: enviar email de confirmación
		try {
			await sendEmail({
				to: user.email,
				subject: "Contraseña restablecida exitosamente",
				html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<h2 style="color: #43AC6A;">Contraseña actualizada</h2>
						<p>Hola ${user.nombre},</p>
						<p>Tu contraseña fue restablecida exitosamente.</p>
						<p>Si no fuiste vos quien realizó este cambio, por favor contactanos inmediatamente.</p>
						<p>Saludos,<br>El equipo de Dormis</p>
					</div>
				`,
			});
		} catch (mailErr) {
			console.error("Error al enviar email de confirmación:", mailErr);
			// No fallar si no se puede enviar el email de confirmación
		}

		return res.json({ message: "Contraseña restablecida exitosamente. Ya podés iniciar sesión." });

	} catch (err) {
		console.error("Error en resetPassword:", err);
		return res.status(500).json({ message: "Error interno del servidor" });
	}
}