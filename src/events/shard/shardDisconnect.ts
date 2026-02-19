import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("shard");

defineEvent({
	name: "shardDisconnect",
	once: false,
	execute: (closeEvent, shardId) => {
		log.warn({ shardId, code: closeEvent.code, reason: closeEvent.reason }, `Shard #${shardId} disconnected`);
	},
});
