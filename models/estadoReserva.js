import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

export const EstadoReserva = sequelize.define(
	"EstadoReserva",
	{
		idEstadoReserva: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		nombre: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		descripcion: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		esDefault: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		prioridad: {
			type: DataTypes.INTEGER,
			allowNull: false,
			unique: true, // cada valor de prioridad debe ser único
		},
	},
	{
		tableName: "EstadoReserva",
		timestamps: false,
		indexes: [
			{
				unique: true,
				fields: ["esDefault"],
				where: { esDefault: true }, // solo uno puede ser default
			},
		],
	}
);
