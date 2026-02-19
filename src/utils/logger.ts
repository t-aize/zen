import pino from "pino";
import { isDev } from "@/utils/env.js";

/**
 * In development, pipe logs through pino-pretty for human-readable output.
 * In production, skip the transport entirely — pino writes raw NDJSON to
 * stdout, which is the most performant option and plays nicely with log
 * aggregators (Datadog, Loki, CloudWatch, etc.).
 */
const transport = isDev
	? pino.transport({
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "SYS:HH:MM:ss.l",
				ignore: "pid,hostname",
				/** Injects the `scope` child-binding into the message prefix. */
				messageFormat: "[{scope}] {msg}",
			},
		})
	: undefined;

/**
 * Root pino logger instance shared across the whole application.
 *
 * Configuration highlights:
 * - `level`      — "debug" in dev so all log levels are visible; "info" in
 *                  production to reduce noise and I/O overhead.
 * - `base`       — pid and hostname stripped out; they add no value inside a
 *                  single-process bot and keep JSON payloads lean.
 * - `timestamp`  — ISO 8601 string (`"time":"2026-02-19T19:00:00.000Z"`)
 *                  instead of the default epoch integer, for readability.
 * - `formatters` — serialise the level as a string label ("info") rather
 *                  than pino's internal numeric code (30).
 */
export const logger = pino(
	{
		level: isDev ? "debug" : "info",
		base: { pid: false, hostname: false },
		timestamp: pino.stdTimeFunctions.isoTime,
		formatters: {
			level(label) {
				return { level: label };
			},
		},
	},
	transport,
);

/**
 * Creates a child logger bound to a specific `scope`.
 *
 * Every log line emitted by the child automatically includes `"scope":"<value>"`
 * in its JSON payload (and `[<value>]` prefix in pretty mode), without needing
 * to repeat the scope on each call.
 *
 * @example
 * const log = createLogger("deploy");
 * log.info("Registering commands..."); // → { scope: "deploy", msg: "..." }
 */
export const createLogger = (scope: string) => logger.child({ scope });
