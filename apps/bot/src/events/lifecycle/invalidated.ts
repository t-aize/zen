import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("client");

defineEvent({
	name: "invalidated",
	once: true,
	execute: () => {
		/** Session has been invalidated by Discord — the bot must restart to reconnect. */
		log.error("Session invalidated by Discord — restart required.");
		process.exit(1);
	},
});
