import "dotenv/config";
import { z } from "zod";

/**
 * Zod schema describing every environment variable the application requires.
 * Validated once at startup — if any variable is missing or malformed the
 * process throws immediately with a clear message before anything else runs.
 */
const envSchema = z.object({
	/** Bot token obtained from the Discord Developer Portal. Never commit this value. */
	// biome-ignore lint/style/useNamingConvention: env convention
	DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN must not be empty"),

	/** Application (client) ID of the Discord bot. Found under General Information. */
	// biome-ignore lint/style/useNamingConvention: env convention
	DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID must not be empty"),

	/**
	 * Runtime environment.
	 * Defaults to "development" when the variable is absent so that local
	 * development works out of the box without an .env entry.
	 */
	// biome-ignore lint/style/useNamingConvention: env convention
	NODE_ENV: z.enum(["development", "production"]).default("development"),
});

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
export const env = envSchema.parse(process.env);

/**
 * Convenience flag — `true` when running outside of production.
 * Prefer this over comparing `env.NODE_ENV` directly throughout the codebase.
 */
export const isDev = env.NODE_ENV !== "production";
