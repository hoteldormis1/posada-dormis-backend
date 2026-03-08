import { sendEmail } from "./mailer.js";

const MAIL_ADMIN = process.env.MAIL_ADMIN || process.env.SMTP_USER;

function formatFecha(fecha) {
	return new Date(fecha).toLocaleDateString("es-AR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

function detalleReservaDark({ habitacion, fechaDesde, fechaHasta, montoTotal }) {
	const desde = formatFecha(fechaDesde);
	const hasta = formatFecha(fechaHasta);

	return `
	<div style="background: rgba(0,0,0,0.24); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:10px 20px; margin:18px 0;">
		<div style="display:flex; justify-content:space-between; align-items:center; gap:16px; padding:18px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
			<span style="font-size:13px; color:rgba(255,255,255,0.62); min-width:110px;">Habitación:</span>
			<span style="font-size:13.5px; color:rgba(255,255,255,0.9); font-weight:600; text-align:right;">${habitacion}</span>
		</div>
		<div style="display:flex; justify-content:space-between; align-items:center; gap:16px; padding:18px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
			<span style="font-size:13px; color:rgba(255,255,255,0.62); min-width:110px;">Check-in:</span>
			<span style="font-size:13.5px; color:rgba(255,255,255,0.9); font-weight:600; text-align:right;">${desde}</span>
		</div>
		<div style="display:flex; justify-content:space-between; align-items:center; gap:16px; padding:18px 0; ${montoTotal == null ? "" : "border-bottom:1px solid rgba(255,255,255,0.06);"}">
			<span style="font-size:13px; color:rgba(255,255,255,0.62); min-width:110px;">Check-out:</span>
			<span style="font-size:13.5px; color:rgba(255,255,255,0.9); font-weight:600; text-align:right;">${hasta}</span>
		</div>
		${montoTotal != null ? `
		<div style="display:flex; justify-content:space-between; align-items:center; gap:16px; padding:18px 0;">
			<span style="font-size:13px; color:rgba(255,255,255,0.68); font-weight:600; min-width:110px;">Total:</span>
			<span style="font-size:18px; color:#34D399; font-weight:700; letter-spacing:-0.4px; text-align:right;">$${Number(montoTotal).toLocaleString("es-AR")}</span>
		</div>` : ""}
	</div>`;
}

function reservaTemplateDark({
	titulo,
	badge,
	badgeColor = "#34D399",
	icono = "🏡",
	contenido,
}) {
	return `
	<div style="font-family:'DM Sans','Segoe UI',Arial,sans-serif;background:#0a1f14;padding:24px;">
		<div style="max-width:560px;margin:0 auto;">

			<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:22px;overflow:hidden;">
				<div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(52,211,153,0.05);">
					<div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${badgeColor};margin-bottom:6px;">${badge}</div>
					<h2 style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.4px;line-height:1.25;margin:0;">${titulo}</h2>
				</div>
				<div style="padding:22px 24px;">${contenido}</div>
			</div>

		<div style="text-align:center;margin-top:14px;font-size:11px;color:rgba(255,255,255,0.2);">
			© 2026 Posada Dormi's
		</div>
		</div>
	</div>`;
}

export async function enviarEmailAprobacion({ to, nombreHuesped, habitacion, fechaDesde, fechaHasta, montoTotal }) {
	const html = reservaTemplateDark({
		titulo: "Tu reserva fue confirmada",
		badge: "Reserva confirmada",
		badgeColor: "#34D399",
		icono: "✅",
		contenido: `
			<p style="font-size:14px;color:rgba(255,255,255,0.58);line-height:1.7;margin:0 0 14px;">
				Hola <strong style="color:#fff;">${nombreHuesped}</strong>, tu reserva fue <strong style="color:#34D399;">aprobada</strong>.
			</p>
			${detalleReservaDark({ habitacion, fechaDesde, fechaHasta, montoTotal })}
			<p style="font-size:14px;color:rgba(255,255,255,0.5);line-height:1.7;margin:12px 0 0;">Te esperamos en Posada Dormi's.</p>
		`,
	});

	return sendEmail({
		to,
		subject: "Reserva confirmada - Posada Dormi's",
		html,
	});
}

// Se conserva por compatibilidad, aunque ya no se usa en el nuevo flujo con doble confirmacion.
export async function enviarEmailSolicitudRecibida({ to, nombreHuesped, habitacion, fechaDesde, fechaHasta, montoTotal }) {
	const html = reservaTemplateDark({
		titulo: "Tu solicitud fue recibida",
		badge: "Reserva pendiente",
		badgeColor: "#60A5FA",
		icono: "📋",
		contenido: `
			<p style="font-size:14px;color:rgba(255,255,255,0.58);line-height:1.7;margin:0 0 14px;">
				Hola <strong style="color:#fff;">${nombreHuesped}</strong>, recibimos tu solicitud y quedo en estado pendiente.
			</p>
			${detalleReservaDark({ habitacion, fechaDesde, fechaHasta, montoTotal })}
		`,
	});

	return sendEmail({
		to,
		subject: "Tu solicitud fue recibida - Posada Dormi's",
		html,
	});
}

export async function enviarEmailNuevaSolicitudPosada({ nombreHuesped, dniHuesped, telefonoHuesped, emailHuesped, habitacion, fechaDesde, fechaHasta, montoTotal }) {
	if (!MAIL_ADMIN) return;

	const desde = formatFecha(fechaDesde);
	const hasta = formatFecha(fechaHasta);

	const html = reservaTemplateDark({
		titulo: "Nueva solicitud para revisar",
		badge: "Panel interno",
		badgeColor: "#F59E0B",
		icono: "🔔",
		contenido: `
			<div style="background: rgba(0,0,0,0.24); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:10px 16px;">
				${[
					["Huesped", nombreHuesped],
					["DNI", dniHuesped],
					["Telefono", telefonoHuesped],
					["Email", emailHuesped || "-"],
					["Habitacion", habitacion],
					["Check-in", desde],
					["Check-out", hasta],
					["Total estimado", montoTotal != null ? `$${Number(montoTotal).toLocaleString("es-AR")}` : "-"],
				].map(([k, v]) => `
					<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
						<span style="font-size:13px;color:rgba(255,255,255,0.62);min-width:110px;">${k}:</span>
						<span style="font-size:13.5px;color:rgba(255,255,255,0.9);font-weight:600;text-align:right;">${v}</span>
					</div>
				`).join("")}
			</div>
			<p style="font-size:13px;color:rgba(255,255,255,0.45);line-height:1.6;margin:14px 0 0;">Ingresa al sistema para confirmar o rechazar esta solicitud.</p>
		`,
	});

	return sendEmail({
		to: MAIL_ADMIN,
		subject: `Nueva solicitud de reserva - ${nombreHuesped}`,
		html,
	});
}

export async function enviarEmailCancelacion({ to, nombreHuesped, habitacion, fechaDesde, fechaHasta }) {
	const html = reservaTemplateDark({
		titulo: "Tu reserva fue cancelada",
		badge: "Reserva cancelada",
		badgeColor: "#EF4444",
		icono: "🚫",
		contenido: `
			<p style="font-size:14px;color:rgba(255,255,255,0.58);line-height:1.7;margin:0 0 14px;">
				Hola <strong style="color:#fff;">${nombreHuesped}</strong>, tu reserva fue cancelada.
			</p>
			${detalleReservaDark({ habitacion, fechaDesde, fechaHasta })}
		`,
	});

	return sendEmail({
		to,
		subject: "Reserva cancelada - Posada Dormi's",
		html,
	});
}

export async function enviarEmailRechazo({ to, nombreHuesped, habitacion, fechaDesde, fechaHasta, motivo }) {
	const html = reservaTemplateDark({
		titulo: "Solicitud no aprobada",
		badge: "Reserva rechazada",
		badgeColor: "#F59E0B",
		icono: "❌",
		contenido: `
			<p style="font-size:14px;color:rgba(255,255,255,0.58);line-height:1.7;margin:0 0 14px;">
				Hola <strong style="color:#fff;">${nombreHuesped}</strong>, tu solicitud no fue aprobada.
			</p>
			${detalleReservaDark({ habitacion, fechaDesde, fechaHasta })}
			${motivo ? `<p style="font-size:13px;color:#FCA5A5;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.22);padding:10px 12px;border-radius:10px;margin:10px 0 0;"><strong>Motivo:</strong> ${motivo}</p>` : ""}
		`,
	});

	return sendEmail({
		to,
		subject: "Reserva no aprobada - Posada Dormi's",
		html,
	});
}

export async function enviarEmailConfirmacionIdentidad({
	to,
	nombreHuesped,
	habitacion,
	fechaDesde,
	fechaHasta,
	montoTotal,
	urlConfirmar,
	urlCancelar,
}) {
	const html = reservaTemplateDark({
		titulo: "¿Solicitaste esta reserva?",
		badge: "Solicitud de reserva",
		badgeColor: "#F59E0B",
		icono: "🔐",
		contenido: `
			<p style="font-size:14px;color:rgba(255,255,255,0.55);line-height:1.7;margin:0 0 16px;">
				Hola <strong style="color:#fff;">${nombreHuesped}</strong>, recibimos una solicitud con tus datos.
				Si fuiste vos, confirmala. Si no reconoces esta solicitud, cancelala.
			</p>
			${detalleReservaDark({ habitacion, fechaDesde, fechaHasta, montoTotal })}

			<div style="display:flex;flex-direction:column;gap:10px;margin-top:18px;">
			<a href="${urlConfirmar}" style="display:block;width:100%;background:#34D399;color:#071910;border-radius:13px;padding:14px 16px;font-size:15px;font-weight:700;text-decoration:none;text-align:center;box-shadow:0 6px 24px rgba(52,211,153,0.25);">
				✓ &nbsp;Sí, confirmar mi reserva
				</a>
				<a href="${urlCancelar}" style="display:block;width:100%;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.22);border-radius:13px;padding:12px 16px;font-size:13.5px;font-weight:600;color:rgba(239,68,68,0.82);text-decoration:none;text-align:center;">
				✕ &nbsp;No fui yo, cancelar solicitud
				</a>
			</div>

		<p style="font-size:12px;color:rgba(255,255,255,0.28);margin-top:16px;text-align:center;line-height:1.6;">
			Este enlace expira en <strong style="color:rgba(255,255,255,0.45);">4 horas</strong>. Confirmalo cuanto antes ya que la disponibilidad no esta garantizada hasta que confirmes. Si el enlace ya expiro, podes volver a solicitar la reserva desde el sitio.
		</p>
		`,
	});

	return sendEmail({
		to,
		subject: "¿Solicitaste una reserva? Confirma tu identidad - Posada Dormi's",
		html,
	});
}
