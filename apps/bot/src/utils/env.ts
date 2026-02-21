import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Parsed and type-safe environment variables.
 *
 * Import this object anywhere in the codebase instead of accessing
 * `process.env` directly — you get full TypeScript autocomplete and the
 * guarantee that every value has already been validated.
 *
 * `parse` throws a `ZodError` with a human-readable message if any variable
 * is missing or invalid, crashing the process at boot rather than at runtime.
 *
 * @example
 * import { env } from "@/utils/env.js";
 * console.log(env.NODE_ENV); // "development" | "production"
 */
export const env = createEnv({
	server: {
		/** Bot token obtained from the Discord Developer Portal. Never commit this value. */
		DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN must not be empty"),

		/** Database connection URL. */
		DATABASE_URL: z.string().min(1, "DATABASE_URL must not be empty"),

		/**
		 * Runtime environment.
		 * Defaults to "development" when the variable is absent so that local
		 * development works out of the box without an .env entry.
		 */
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});

/**
 * Convenience flag — `true` when running outside of production.
 * Prefer this over comparing `env.NODE_ENV` directly throughout the codebase.
 */
export const isDev = env.NODE_ENV !== "production";
