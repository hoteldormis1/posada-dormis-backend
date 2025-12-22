import rateLimit from "express-rate-limit";

// 🔐 Limit login attempts: max 5 per minute per IP
export const loginLimiter = rateLimit({
	windowMs: 1 * 60 * 1000, // ⏰ 1 minute
	max: 5,
	message: {
		error: "Too many login attempts. Please try again in 1 minute.",
	},
	standardHeaders: true,
	legacyHeaders: false,

	// ✅ Evita error en proxies como Render
	validate: {
		xForwardedForHeader: false,
	},
});
