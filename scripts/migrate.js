/**
 * Script de migración manual — idempotente.
 * Aplica todos los cambios de esquema acumulados:
 *
 *   v1: Huesped y Habitacion — timestamps + paranoid + unique dni
 *   v2: Resto de tablas      — timestamps + paranoid
 *
 * Uso:
 *   node backend/scripts/migrate.js
 */

import { sequelize } from "../db.js";

// Helper: genera los 3 pasos estándar para una tabla
const timestampSteps = (table) => [
	{
		name: `${table} — createdAt`,
		sql: `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
	},
	{
		name: `${table} — updatedAt`,
		sql: `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
	},
	{
		name: `${table} — deletedAt (soft delete)`,
		sql: `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ DEFAULT NULL`,
	},
];

const steps = [
	...timestampSteps("Huesped"),
	...timestampSteps("Habitacion"),
	{
		name: 'Huesped — constraint UNIQUE en "dni"',
		sql: `
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint
					WHERE conname = 'Huesped_dni_key'
					  AND conrelid = '"Huesped"'::regclass
				) THEN
					ALTER TABLE "Huesped" ADD CONSTRAINT "Huesped_dni_key" UNIQUE ("dni");
				END IF;
			END $$
		`,
	},

	// ── v2: tablas nuevas ────────────────────────────────────────────────────
	...timestampSteps("Reserva"),
	...timestampSteps("TipoHabitacion"),
	...timestampSteps("EstadoReserva"),
	...timestampSteps("Usuario"),
	...timestampSteps("TipoUsuario"),
	...timestampSteps("Auditoria"),

	// HuespedNoDeseado ya tiene createdAt/updatedAt — solo falta deletedAt
	{
		name: 'HuespedNoDeseado — deletedAt (soft delete)',
		sql: `ALTER TABLE "HuespedNoDeseado" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ DEFAULT NULL`,
	},
];

async function migrate() {
	try {
		await sequelize.authenticate();
		console.log("✅ Conexión a la base de datos establecida.\n");

		for (const step of steps) {
			try {
				await sequelize.query(step.sql);
				console.log(`  ✔  ${step.name}`);
			} catch (err) {
				console.error(`  ✖  ${step.name}`);
				console.error(`     ${err.message}\n`);
				process.exit(1);
			}
		}

		console.log("\n✅ Migración completada exitosamente.");
	} catch (err) {
		console.error("❌ No se pudo conectar a la base de datos:", err.message);
		process.exit(1);
	} finally {
		await sequelize.close();
	}
}

migrate();
