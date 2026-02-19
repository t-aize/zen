import { defineEvent } from "@/events/index.js";
import { isDev } from "@/utils/env.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("client");

defineEvent({
	name: "debug",
	once: false,
	execute: (message) => {
		/** Only log debug events in development — they are extremely verbose in production. */
		if (isDev) log.debug(message);
	},
});
