import "dotenv/config";

import { z } from "zod";

/**
 * Schema defining all required and optional environment variables.
 *
 * Validated at startup using Zod v4's `safeParse`. If any variable
 * is missing or malformed, the process exits immediately with a
 * human-readable error summary via {@link z.prettifyError}.
 *
 * To add a new env variable:
 * 1. Add it to this schema with the appropriate type and constraints.
 * 2. Update `.env.example` with a sensible default or placeholder.
 * 3. Access it anywhere via `env.YOUR_VARIABLE` (fully typed).
 */
const envSchema = z.object({
	/** Application environment. Defaults to `"development"`. */
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

	/** Bot token from the Discord Developer Portal. */
	DISCORD_TOKEN: z.string().min(1, { error: "DISCORD_TOKEN is required" }),

	/** Application ID from the Discord Developer Portal. */
	DISCORD_CLIENT_ID: z.string().min(1, { error: "DISCORD_CLIENT_ID is required" }),

	/** PostgreSQL connection string (e.g. `postgresql://postgres:postgres@localhost:5432/zen`). */
	DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid PostgreSQL URL" }).refine((value) => {
		const protocol = new URL(value).protocol;
		return protocol === "postgres:" || protocol === "postgresql:";
	}, "DATABASE_URL must use postgres:// or postgresql://"),

	/** Pino log level. Defaults to `"info"`. */
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

/**
 * Inferred type of the validated environment.
 *
 * Use this when you need to pass the env object
 * or individual values to functions with explicit signatures.
 *
 * @example
 * ```ts
 * function connectDatabase(url: Env["DATABASE_URL"]): void { ... }
 * ```
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validates `process.env` against {@link envSchema} and exits
 * the process with a non-zero code if validation fails.
 *
 * This runs **once** at import time — any module importing `env`
 * is guaranteed to receive a fully validated, typed object.
 */
const validateEnv = (): Env => {
	const result = envSchema.safeParse(process.env);

	if (!result.success) {
		throw result.error;
	}

	return result.data;
};

/** Validated and typed environment variables. */
export const env = validateEnv();
