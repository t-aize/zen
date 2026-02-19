import { ChannelType, type Guild, type TextChannel } from "discord.js";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/index.js";
import { type AuditLogCategory, auditLogConfig } from "@/db/schema/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("audit-log");

/**
 * Resolves the configured audit log channel for a given guild and category.
 *
 * Returns `null` if:
 * - No config row exists for this guild × category pair
 * - The category is disabled (`enabled = false`)
 * - The configured channel no longer exists or is not a GuildText channel
 * - The bot lacks `SendMessages`, `EmbedLinks` or `ViewChannel` in that channel
 */
export const getAuditLogChannel = async (guild: Guild, category: AuditLogCategory): Promise<TextChannel | null> => {
	let config: typeof auditLogConfig.$inferSelect | undefined;

	try {
		config = await db.query.auditLogConfig.findFirst({
			where: and(eq(auditLogConfig.guildId, guild.id), eq(auditLogConfig.category, category)),
		});
	} catch (err) {
		log.error({ err, guildId: guild.id, category }, "Failed to fetch audit log config");
		return null;
	}

	if (!config?.enabled) return null;

	const channel = guild.channels.cache.get(config.channelId);

	if (!channel || channel.type !== ChannelType.GuildText) {
		log.warn(
			{ guildId: guild.id, category, channelId: config.channelId },
			"Audit log channel not found or not a text channel — consider reconfiguring",
		);
		return null;
	}

	const me = guild.members.me;
	if (!me?.permissionsIn(channel).has(["SendMessages", "EmbedLinks", "ViewChannel"])) {
		log.warn(
			{ guildId: guild.id, category, channelId: config.channelId },
			"Missing permissions in audit log channel",
		);
		return null;
	}

	return channel as TextChannel;
};
