/**
 * Template base compartido para todos los emails de la app.
 * @param {{ titulo: string, contenido: string, color: string }} opts
 */
export function baseTemplate({ titulo, contenido, color = "#43AC6A" }) {
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
