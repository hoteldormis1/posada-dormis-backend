import { sendEmail } from "./mailer.js";

/**
 * Genera el HTML base para emails de reserva.
 */
function baseTemplate({ titulo, contenido, color }) {
	return `
	<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px;">
		<div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
			<div style="background: ${color}; padding: 24px 32px;">
				<h1 style="color: white; margin: 0; font-size: 22px;">${titulo}</h1>
			</div>
			<div style="padding: 32px;">
				${contenido}
			</div>
			<div style="padding: 16px 32px; background: #f3f4f6; text-align: center;">
				<p style="margin: 0; color: #6b7280; font-size: 13px;">Posada Dormi's — Gracias por elegirnos</p>
			</div>
		</div>
	</div>`;
}

/**
 * Genera la tabla de detalle de reserva.
 */
function detalleReserva({ habitacion, fechaDesde, fechaHasta, montoTotal }) {
	const desde = new Date(fechaDesde).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
	const hasta = new Date(fechaHasta).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

	return `
	<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
		<tr>
			<td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Habitación</td>
			<td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 14px;">${habitacion}</td>
		</tr>
		<tr>
			<td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Check-in</td>
			<td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 14px;">${desde}</td>
		</tr>
		<tr>
			<td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Check-out</td>
			<td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 14px;">${hasta}</td>
		</tr>
		${montoTotal != null ? `
		<tr style="border-top: 1px solid #e5e7eb;">
			<td style="padding: 12px 0 8px; color: #6b7280; font-size: 14px; font-weight: 600;">Total</td>
			<td style="padding: 12px 0 8px; text-align: right; font-weight: 700; font-size: 16px;">$${Number(montoTotal).toLocaleString("es-AR")}</td>
		</tr>` : ""}
	</table>`;
}

/**
 * Envía email de reserva aprobada (confirmada).
 */
export async function enviarEmailAprobacion({ to, nombreHuesped, habitacion, fechaDesde, fechaHasta, montoTotal }) {
	const html = baseTemplate({
		titulo: "¡Reserva Confirmada!",
		color: "#16a34a",
		contenido: `
			<p style="font-size: 16px; color: #111827;">Hola <strong>${nombreHuesped}</strong>,</p>
			<p style="font-size: 15px; color: #374151; line-height: 1.6;">
				Tu reserva ha sido <strong style="color: #16a34a;">aprobada</strong>. Acá están los detalles:
			</p>
			${detalleReserva({ habitacion, fechaDesde, fechaHasta, montoTotal })}
			<p style="font-size: 15px; color: #374151; line-height: 1.6;">
				Te esperamos. Si necesitás hacer algún cambio, no dudes en contactarnos.
			</p>
		`,
	});

	return sendEmail({
		to,
		subject: "Reserva confirmada — Posada Dormi's",
		html,
	});
}

/**
 * Envía email de reserva rechazada.
 */
export async function enviarEmailRechazo({ to, nombreHuesped, habitacion, fechaDesde, fechaHasta, motivo }) {
	const html = baseTemplate({
		titulo: "Reserva No Aprobada",
		color: "#dc2626",
		contenido: `
			<p style="font-size: 16px; color: #111827;">Hola <strong>${nombreHuesped}</strong>,</p>
			<p style="font-size: 15px; color: #374151; line-height: 1.6;">
				Lamentamos informarte que tu solicitud de reserva <strong>no fue aprobada</strong>.
			</p>
			${detalleReserva({ habitacion, fechaDesde, fechaHasta })}
			${motivo ? `<p style="font-size: 14px; color: #6b7280; background: #fef2f2; padding: 12px 16px; border-radius: 8px;"><strong>Motivo:</strong> ${motivo}</p>` : ""}
			<p style="font-size: 15px; color: #374151; line-height: 1.6;">
				Podés intentar realizar una nueva reserva con otras fechas o habitación. ¡Gracias por tu interés!
			</p>
		`,
	});

	return sendEmail({
		to,
		subject: "Reserva no aprobada — Posada Dormi's",
		html,
	});
}
