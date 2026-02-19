import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("client");

defineEvent({
	name: "cacheSweep",
	once: false,
	execute: (message) => {
		log.debug({ sweep: message }, "Cache swept");
	},
});
