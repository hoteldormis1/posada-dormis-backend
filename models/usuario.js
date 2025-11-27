import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";
import { TipoUsuario } from "./tipoUsuario.js";

export const Usuario = sequelize.define(
	"Usuario",
	{
		idUsuario: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		email: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		nombre: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		clave: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		verificado: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		verifyToken: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		verifyTokenExpires: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		resetToken: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		resetTokenExpires: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		idTipoUsuario: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
	},
	{
		tableName: "Usuario",
		timestamps: false,
	}
);

Usuario.belongsTo(TipoUsuario, { foreignKey: "idTipoUsuario" });
TipoUsuario.hasMany(Usuario, { foreignKey: "idTipoUsuario" });