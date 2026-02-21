import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("shard");

defineEvent({
	name: "shardReconnecting",
	once: false,
	execute: (shardId) => {
		log.warn({ shardId }, `Shard #${shardId} is reconnecting...`);
	},
});
