import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("shard");

defineEvent({
	name: "shardError",
	once: false,
	execute: (error, shardId) => {
		log.error(
			{ err: error, shardId },
			`Shard #${shardId} encountered an error`,
		);
	},
});
