// src/models/reserva.js
import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";
import { Huesped } from "./huesped.js";
import { Usuario } from "./usuario.js";
import { Habitacion } from "./habitacion.js";
import { EstadoReserva } from "./estadoReserva.js";

export const Reserva = sequelize.define(
	"Reserva",
	{
		idReserva: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		idHuesped: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		idEstadoReserva: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		idHabitacion: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		fechaDesde: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		fechaHasta: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		montoPagado: {
			type: DataTypes.FLOAT,
			allowNull: false,
		},
		montoTotal: {
			type: DataTypes.FLOAT,
			allowNull: false,
		},
	},
	{
		tableName: "Reserva",
		timestamps: false,
	}
);

Reserva.belongsTo(Huesped, { foreignKey: "idHuesped" });
Huesped.hasMany(Reserva, { foreignKey: "idHuesped" });

Reserva.belongsTo(Habitacion, { foreignKey: "idHabitacion" });
Habitacion.hasMany(Reserva, { foreignKey: "idHabitacion" });

Reserva.belongsTo(EstadoReserva, { foreignKey: "idEstadoReserva" });
EstadoReserva.hasMany(Reserva, { foreignKey: "idEstadoReserva" });
