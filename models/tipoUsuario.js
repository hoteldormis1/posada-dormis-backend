// src/models/tipoUsuario.js
import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

const defaultPerms = {
	usuario: { create: false, read: true, update: false, delete: false },
	tipoHabitacion: { create: false, read: true, update: false, delete: false },
	habitacion: { create: false, read: true, update: false, delete: false },
	reserva: { create: false, read: true, update: false, delete: false },
	huesped: { create: false, read: true, update: false, delete: false },
	estadoReserva: { create: false, read: true, update: false, delete: false },
	auditoria: { create: false, read: false, update: false, delete: false },
};

export const TipoUsuario = sequelize.define(
	"TipoUsuario",
	{
		idTipoUsuario: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		nombre: {
			type: DataTypes.STRING(50),
			allowNull: false,
			unique: true,
		},
		descripcion: {
			type: DataTypes.STRING(255),
			allowNull: true,
		},
		// JSONB de permisos por recurso
		permisos: {
			type: DataTypes.JSONB,
			allowNull: false,
			defaultValue: defaultPerms,
		},
		// extras útiles
		esSistema: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
		activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
		prioridad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
	},
	{
		tableName: "TipoUsuario",    // 👈 evita problemas de case
		timestamps: false,
		freezeTableName: true,
		indexes: [{ unique: true, fields: ["nombre"] }],
	}
);
