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
			unique: true, 
		},
	},
	{
		tableName: "EstadoReserva",
		timestamps: true,
		paranoid: true,
		indexes: [
			{
				unique: true,
				fields: ["esDefault"],
				where: { esDefault: true }, 
			},
		],
	}
);
