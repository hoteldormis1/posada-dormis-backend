import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

export const sequelize = new Sequelize(process.env.DATABASE_URL, {
	dialect: "postgres",
	logging: false, //hidding logs in console
	dialectOptions: {
		ssl: isProduction
			? {
				require: true,
				rejectUnauthorized: false, // Necesario para Supabase
			}
			: false,
	},
	pool: {
		max: 5,
		min: 0,
		acquire: 30000,
		idle: 10000,
	},
});
