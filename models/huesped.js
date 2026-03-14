// src/models/huesped.js
import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

export const Huesped = sequelize.define(
	"Huesped",
	{
		idHuesped: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		nombre: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		apellido: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		dni: {
			type: DataTypes.INTEGER,
			allowNull: false,
			unique: true,
		},
		telefono: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		origen: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		email: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		direccion: {
			type: DataTypes.STRING,
			allowNull: true,
		},
	},
	{
		tableName: "Huesped",
		timestamps: true,
		paranoid: true, // Soft delete: agrega columna deletedAt; destroy() no borra físicamente
	}
);
