import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";
import { Usuario } from "./usuario.js";

export const Auditoria = sequelize.define(
	"Auditoria",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		idUsuario: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		status: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		ruta: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		metodo: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		accion: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		fecha: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
		datos: {
			type: DataTypes.JSONB,
			allowNull: true,
		},
	},
	{
		tableName: "Auditoria",
		freezeTableName: true,
		timestamps: false,
	}
);

Auditoria.belongsTo(Usuario, { foreignKey: "idUsuario" });

Usuario.hasMany(Auditoria, { foreignKey: "idUsuario" });
