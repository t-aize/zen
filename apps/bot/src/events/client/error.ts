import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("client");

defineEvent({
	name: "error",
	once: false,
	execute: (error) => {
		log.error({ err: error }, "Client error");
	},
});
