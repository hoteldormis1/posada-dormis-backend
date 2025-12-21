// src/models/habitacion.js
import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";
import { TipoHabitacion } from "./tipoHabitacion.js";

export const Habitacion = sequelize.define(
	"Habitacion",
	{
		idHabitacion: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		idTipoHabitacion: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		numero: {
			type: DataTypes.INTEGER,
			allowNull: false,
			unique: true,
		},
	},
	{
		tableName: "Habitacion",
		timestamps: false,
	}
);

// Asociaciones
Habitacion.belongsTo(TipoHabitacion, { foreignKey: "idTipoHabitacion" });
TipoHabitacion.hasMany(Habitacion, { foreignKey: "idTipoHabitacion" });
