/**
 * Template base compartido para todos los emails de la app.
 * @param {{ titulo: string, contenido: string, color: string }} opts
 */
export function baseTemplate({ titulo, contenido, color = "#43AC6A" }) {
	return `
	<div style="font-family:'DM Sans','Segoe UI',Arial,sans-serif;background:#0a1f14;padding:24px;">
		<div style="max-width:560px;margin:0 auto;">
			<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:22px;overflow:hidden;">
				<div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(52,211,153,0.05);">
					<div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${color};margin-bottom:6px;">Notificacion</div>
					<h1 style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.4px;line-height:1.25;margin:0;">${titulo}</h1>
				</div>
				<div style="padding:22px 24px;color:rgba(255,255,255,0.82);">
					${contenido}
				</div>
			</div>

			<div style="text-align:center;margin-top:14px;font-size:11px;color:rgba(255,255,255,0.22);">
				© 2026 Posada Dormi's
			</div>
		</div>
	</div>`;
}
