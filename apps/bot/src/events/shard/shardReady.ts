import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("shard");

defineEvent({
	name: "shardReady",
	once: false,
	execute: (shardId, unavailableGuilds) => {
		const unavailable = unavailableGuilds?.size ?? 0;
		log.info(
			{ shardId, unavailableGuilds: unavailable },
			`Shard #${shardId} ready${unavailable > 0 ? ` (${unavailable} unavailable guild(s))` : ""}`,
		);
	},
});
