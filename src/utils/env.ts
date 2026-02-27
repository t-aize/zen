import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),

	// Discord
	DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),

	// Database
	DB_FILE_NAME: z
		.string()
		.regex(
			/^[a-zA-Z0-9_-]+\.db$/,
			"DB_FILE_NAME must be a valid filename ending with .db",
		),

	// Logging
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace"])
		.default("info"),
});

export const env = envSchema.parse(process.env);
