import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("client");

defineEvent({
	name: "warn",
	once: false,
	execute: (message) => {
		log.warn(message);
	},
});
