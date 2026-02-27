import { env } from "@zen/utils/env";
import pino from "pino";

export const logger = pino({
	level: env.LOG_LEVEL,
	transport:
		env.NODE_ENV === "development"
			? { target: "pino-pretty", options: { colorize: true } }
			: undefined,
});
