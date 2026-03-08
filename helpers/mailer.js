// mailer.js
import nodemailer from "nodemailer";

function requireEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Falta variable de entorno: ${name}`);
    return v;
}

const host = requireEnv("SMTP_HOST");              // p.ej. smtp.gmail.com
const port = Number(process.env.SMTP_PORT || 465); // 465 TLS directo
const secure = (process.env.SMTP_SECURE || "true") === "true";
const user = requireEnv("SMTP_USER");
const pass = requireEnv("SMTP_PASS").replace(/\s+/g, ""); // App Password (16 chars, SIN espacios)
const fromDefault =
    process.env.MAIL_FROM || `Dormis <${user}>`;     // usa el gmail si no hay MAIL_FROM

// Permitir certificados autofirmados en desarrollo o cuando se habilite explícitamente
const allowSelfSigned = (
    process.env.SMTP_ALLOW_SELF_SIGNED ?? (process.env.NODE_ENV !== "production" ? "true" : "false")
) === "true";

const tlsOptions = allowSelfSigned
    ? { servername: host, rejectUnauthorized: false }
    : { servername: host };

const SMTP_FALLBACK_PORTS = (process.env.SMTP_FALLBACK_PORTS || "465,587,2525")
    .split(",")
    .map((p) => Number(String(p).trim()))
    .filter((p) => Number.isFinite(p) && p > 0);

function isTransientSmtpError(err) {
    const code = String(err?.code || "");
    const command = String(err?.command || "");
    return (
        code === "ETIMEDOUT" ||
        code === "ECONNECTION" ||
        code === "ECONNRESET" ||
        code === "ESOCKET" ||
        command === "CONN"
    );
}

function createTransportFor(targetPort) {
    const is465 = targetPort === 465;
    const targetSecure = is465 ? true : false;

    return nodemailer.createTransport({
        host,
        port: targetPort,
        secure: targetSecure,                 // 465=true, 587/2525=false
        requireTLS: !is465,                   // en 587/2525 forzamos STARTTLS
        auth: { user, pass },
        tls: tlsOptions,                      // SNI correcto (+ opción self-signed en dev)
        family: 4,                            // fuerza IPv4 (evita problemas IPv6)
        connectionTimeout: 12000,
        greetingTimeout: 12000,
        socketTimeout: 20000,
        pool: true,
        maxConnections: 2,
        maxMessages: 100,
    });
}

const uniquePorts = Array.from(new Set([port, ...SMTP_FALLBACK_PORTS]));
const transportsByPort = new Map(uniquePorts.map((p) => [p, createTransportFor(p)]));

// Mantiene compatibilidad con código existente que importa `transport`.
export const transport = transportsByPort.get(port) || createTransportFor(port);

export async function verifyEmailTransport() {
    // Verifica el primario y, si falla por timeout/conexión, prueba puertos alternativos.
    let lastError;
    for (const p of uniquePorts) {
        const t = transportsByPort.get(p);
        try {
            // eslint-disable-next-line no-await-in-loop
            await t.verify();
            return true;
        } catch (err) {
            lastError = err;
            if (!isTransientSmtpError(err)) throw err;
        }
    }
    throw lastError;
}

export async function sendEmail({ to, subject, html, text }) {
    if (!to) throw new Error("'to' requerido");

    let lastError;
    for (const p of uniquePorts) {
        const t = transportsByPort.get(p);
        try {
            // eslint-disable-next-line no-await-in-loop
            const info = await t.sendMail({
                from: fromDefault,
                to,
                subject,
                html,
                // mejora deliverability: versión texto (si no la pasan, generamos una simple)
                text: text ?? html?.replace(/<[^>]+>/g, " ").trim(),
            });
            return info; // por si querés guardar messageId/accepted/rejected
        } catch (err) {
            lastError = err;
            if (!isTransientSmtpError(err)) throw err;
            console.warn(`[mailer] fallo SMTP en puerto ${p}, probando fallback...`, {
                code: err?.code,
                command: err?.command,
                message: err?.message,
            });
        }
    }
    throw lastError;
}
