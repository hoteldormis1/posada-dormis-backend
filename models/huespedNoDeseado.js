import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

export const HuespedNoDeseado = sequelize.define(
	"HuespedNoDeseado",
	{
		idHuespedNoDeseado: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		dni: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		motivo: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		observaciones: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
	},
	{
		tableName: "HuespedNoDeseado",
		timestamps: true,
	}
);
