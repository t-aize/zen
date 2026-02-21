import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("shard");

defineEvent({
	name: "shardResume",
	once: false,
	execute: (shardId, replayedEvents) => {
		log.info(
			{ shardId, replayedEvents },
			`Shard #${shardId} resumed (${replayedEvents} event(s) replayed)`,
		);
	},
});
