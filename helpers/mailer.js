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
const pass = requireEnv("SMTP_PASS");              // App Password (16 chars, SIN espacios)
const fromDefault =
    process.env.MAIL_FROM || `Dormis <${user}>`;     // usa el gmail si no hay MAIL_FROM

// Permitir certificados autofirmados en desarrollo o cuando se habilite explícitamente
const allowSelfSigned = (
    process.env.SMTP_ALLOW_SELF_SIGNED ?? (process.env.NODE_ENV !== "production" ? "true" : "false")
) === "true";

const tlsOptions = allowSelfSigned
    ? { servername: host, rejectUnauthorized: false }
    : { servername: host };

export const transport = nodemailer.createTransport({
    host,
    port,
    secure,                            // true en 465, false en 587
    auth: { user, pass },
    tls: tlsOptions,                   // SNI correcto (+ opción self-signed en dev)
    family: 4,                         // fuerza IPv4 (evita problemas IPv6)
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
});

export async function verifyEmailTransport() {
    // Útil para levantar el server y fallar rápido si no hay SMTP
    return transport.verify();
}

export async function sendEmail({ to, subject, html, text }) {
    if (!to) throw new Error("'to' requerido");

    const info = await transport.sendMail({
        from: fromDefault,
        to,
        subject,
        html,
        // mejora deliverability: versión texto (si no la pasan, generamos una simple)
        text: text ?? html?.replace(/<[^>]+>/g, " ").trim(),
    });

    return info; // por si querés guardar messageId/accepted/rejected
}
