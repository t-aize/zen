import { env } from "@zen/utils/env";
import pino from "pino";

const isProduction = env.NODE_ENV === "production";

/**
 * Root application logger.
 *
 * - Development: human-readable output via `pino-pretty`.
 * - Production: structured JSON with ISO timestamps, suitable for log aggregators (Grafana, Datadog, ELK, etc.).
 *
 * Sensitive fields (`token`, `password`, `secret`, `authorization`, `cookie`)
 * are automatically redacted from all log output to prevent accidental credential leaks.
 *
 * Prefer {@link createLogger} over using this directly in modules.
 */
export const logger = pino({
	level: env.LOG_LEVEL,
	redact: {
		paths: ["token", "password", "secret", "authorization", "cookie"],
		censor: "[REDACTED]",
	},
	serializers: {
		error: pino.stdSerializers.err,
		req: pino.stdSerializers.req,
		res: pino.stdSerializers.res,
	},
	timestamp: isProduction ? pino.stdTimeFunctions.isoTime : true,
	formatters: {
		level: (label) => ({ level: label }),
	},
	...(!isProduction && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "HH:MM:ss.l",
				ignore: "pid,hostname",
			},
		},
	}),
	...(isProduction && {
		base: { pid: process.pid },
	}),
});

/**
 * Creates a child logger scoped to a specific module.
 *
 * Every log entry produced by the returned logger will include
 * a `module` field, making it easy to filter and search in production
 * (e.g. `jq 'select(.module == "moderation")'`).
 *
 * @param module - A short, lowercase identifier for the module (e.g. `"moderation"`, `"tickets"`, `"music"`).
 * @returns A child {@link pino.Logger} instance with the `module` field bound.
 *
 * @example
 * ```ts
 * import { createLogger } from "./logger.js";
 *
 * const log = createLogger("moderation");
 *
 * log.info({ guildId, userId }, "User banned");
 * log.error({ error, guildId }, "Failed to apply timeout");
 * ```
 */
export const createLogger = (module: string): pino.Logger => logger.child({ module });
