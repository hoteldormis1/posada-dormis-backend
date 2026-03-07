// index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { sequelize } from "./db.js";
import routes from "./routes/index.js";
import swaggerUi from "swagger-ui-express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { ensureDefaultReservaStates, ensureDefaultRoles } from "./helpers/ensureDefaults.js";

dotenv.config();
const app = express();

app.set('trust proxy', 1);

// Resolver __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer y parsear manualmente swagger.json
const swaggerRaw = await fs.readFile(
	path.join(__dirname, "swagger.json"),
	"utf-8"
);
const swaggerDoc = JSON.parse(swaggerRaw);

// Solo en dev: Morgan + Swagger UI
if (process.env.NODE_ENV !== "production") {
	app.use(morgan("dev"));
	app.use(
		"/docs",
		swaggerUi.serve,
		swaggerUi.setup(swaggerDoc, { explorer: true })
	);
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

	app.listen(port, () => {
		console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
		if (process.env.NODE_ENV !== "production") {
			console.log(`📚 Swagger UI en ${process.env.URL}:${port}/api-docs`);
		}
	});
};

startServer().catch((err) => {
	console.error("❌ Error al conectar la DB:", err);
	process.exit(1);
});
