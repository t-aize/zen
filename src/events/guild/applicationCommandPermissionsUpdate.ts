import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("guild");

defineEvent({
	name: "applicationCommandPermissionsUpdate",
	once: false,
	execute: (data) => {
		log.debug(
			{ applicationId: data.applicationId, guildId: data.guildId, commandId: data.id },
			`Application command permissions updated for command ${data.id}`,
		);
	},
});
