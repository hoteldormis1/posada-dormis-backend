// index.js
import http from "http";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { sequelize } from "./db.js";
import routes from "./routes/index.js";
import path from "path";
import { fileURLToPath } from "url";
import { ensureDefaultReservaStates, ensureDefaultRoles } from "./helpers/ensureDefaults.js";
import { initWss } from "./ws.js";

dotenv.config();
const app = express();
const httpServer = http.createServer(app);

app.set('trust proxy', 1);

// Resolver __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Solo en dev: Morgan 
if (process.env.NODE_ENV !== "production") {
	app.use(morgan("dev"));
}

app.use(
	cors({
		origin: true,
		credentials: true,
	})
);

app.use(express.json());
app.use(cookieParser());
app.use("/api", routes);

const port = Number(process.env.PORT) || 4000;

const startServer = async () => {
	try {
		await sequelize.sync();
		console.log("✅ DB sincronizada");
	} catch (err) {
		throw err;
	}

	await ensureDefaultRoles();
	await ensureDefaultReservaStates();

	initWss(httpServer);

	httpServer.listen(port, () => {
		console.log(`🚀 Servidor corriendo en ${process.env.URL}`);
		if (process.env.NODE_ENV !== "production") {
			console.log(`📚 Swagger UI en ${process.env.URL}/api-docs`);
		}
	});
};

startServer().catch((err) => {
	console.error("❌ Error al conectar la DB:", err);
	process.exit(1);
});
