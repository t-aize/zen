import { db } from "@zen/db";
import {
	automodExemptions,
	automodIncidents,
	automodRules,
	guildSettings,
	logChannelBindings,
	logConfigs,
	logEntries,
	logEventSettings,
	modCases,
	panelCategories,
	raidStates,
	ticketActions,
	ticketCategories,
	ticketConfigs,
	ticketMessages,
	ticketPanels,
	ticketParticipants,
	tickets,
	warnThresholds,
} from "@zen/db/schema";
import { createLogger } from "@zen/utils/logger";
import { ChannelType, type Guild, type NonThreadGuildBasedChannel } from "discord.js";

const log = createLogger("devGuildSeed");

export const DEVELOPMENT_SEED_GUILD_ID = "936969912600121384";

const SEED_IDS = {
	automodExemptionGlobal: "10000000-0000-0000-0000-000000000001",
	automodIncident: "10000000-0000-0000-0000-000000000002",
	automodRuleMentions: "10000000-0000-0000-0000-000000000003",
	automodRuleSpam: "10000000-0000-0000-0000-000000000004",
	logBindingAutomod: "10000000-0000-0000-0000-000000000005",
	logBindingChannels: "10000000-0000-0000-0000-000000000006",
	logBindingModeration: "10000000-0000-0000-0000-000000000007",
	logBindingTickets: "10000000-0000-0000-0000-000000000008",
	logConfig: "10000000-0000-0000-0000-000000000009",
	logEntry: "10000000-0000-0000-0000-000000000010",
	modCase: "10000000-0000-0000-0000-000000000011",
	raidState: "10000000-0000-0000-0000-000000000012",
	ticketAction: "10000000-0000-0000-0000-000000000013",
	ticketCategorySupport: "10000000-0000-0000-0000-000000000014",
	ticketCategoryReport: "10000000-0000-0000-0000-000000000015",
	ticketConfig: "10000000-0000-0000-0000-000000000016",
	ticketMessage: "10000000-0000-0000-0000-000000000017",
	ticketPanel: "10000000-0000-0000-0000-000000000018",
	ticketRecord: "10000000-0000-0000-0000-000000000019",
	warnThreshold: "10000000-0000-0000-0000-000000000020",
} as const;

const fakeSnowflake = (guildId: string, offset: bigint): string =>
	(BigInt(guildId) + offset).toString();

const getGuildChannels = async (guild: Guild): Promise<NonThreadGuildBasedChannel[]> => {
	const channels = await guild.channels.fetch();

	return channels
		.filter(
			(channel): channel is NonThreadGuildBasedChannel => channel !== null && !channel.isThread(),
		)
		.map((channel) => channel);
};

const pickSeedContext = async (guild: Guild) => {
	const channels = await getGuildChannels(guild);

	const textChannels = channels.filter(
		(channel) =>
			channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement,
	);
	const categoryChannel =
		channels.find((channel) => channel.type === ChannelType.GuildCategory) ?? null;
	const voiceChannel =
		channels.find(
			(channel) =>
				channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice,
		) ?? null;
	const staffRole =
		guild.roles.cache.find((role) => role.id !== guild.id && !role.managed) ?? guild.roles.everyone;

	const primaryTextChannel = textChannels[0] ?? null;
	const transcriptChannel = textChannels[1] ?? primaryTextChannel;
	const panelChannel = textChannels[2] ?? transcriptChannel ?? primaryTextChannel;

	if (!(primaryTextChannel && transcriptChannel && panelChannel)) {
		throw new Error("Development seed requires at least one guild text or announcement channel.");
	}

	const ownerMember = guild.members.cache.get(guild.ownerId) ?? null;
	const moderatorId = guild.members.me?.id ?? guild.client.user.id;
	const moderatorUsername = guild.client.user.username;

	return {
		categoryChannel,
		moderatorId,
		moderatorUsername,
		ownerId: guild.ownerId,
		ownerUsername: ownerMember?.user.username ?? "guild-owner",
		panelChannel,
		primaryTextChannel,
		staffRole,
		transcriptChannel,
		voiceChannel,
	};
};

export const seedDevelopmentGuildData = async (guild: Guild): Promise<void> => {
	if (guild.id !== DEVELOPMENT_SEED_GUILD_ID) {
		return;
	}

	const now = new Date();
	const context = await pickSeedContext(guild);

	await db.transaction(async (tx) => {
		await tx
			.insert(guildSettings)
			.values({
				guildId: guild.id,
				locale: "fr",
				modules: {
					automod: true,
					logs: true,
					moderation: true,
					raid: true,
					tickets: true,
				},
				prefix: "!",
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: guildSettings.guildId,
				set: {
					locale: "fr",
					modules: {
						automod: true,
						logs: true,
						moderation: true,
						raid: true,
						tickets: true,
					},
					prefix: "!",
					updatedAt: now,
				},
			});

		await tx
			.insert(logConfigs)
			.values({
				createdAt: now,
				discordCategoryId: context.categoryChannel?.id ?? null,
				guildId: guild.id,
				id: SEED_IDS.logConfig,
				retentionDays: 30,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: logConfigs.guildId,
				set: {
					discordCategoryId: context.categoryChannel?.id ?? null,
					retentionDays: 30,
					updatedAt: now,
				},
			});

		for (const binding of [
			{ id: SEED_IDS.logBindingChannels, logGroup: "channels" },
			{ id: SEED_IDS.logBindingModeration, logGroup: "moderation" },
			{ id: SEED_IDS.logBindingTickets, logGroup: "tickets" },
			{ id: SEED_IDS.logBindingAutomod, logGroup: "automod" },
		]) {
			await tx
				.insert(logChannelBindings)
				.values({
					createdAt: now,
					discordChannelId: context.primaryTextChannel.id,
					guildId: guild.id,
					id: binding.id,
					logGroup: binding.logGroup,
				})
				.onConflictDoUpdate({
					target: logChannelBindings.id,
					set: {
						discordChannelId: context.primaryTextChannel.id,
						logGroup: binding.logGroup,
					},
				});
		}

		for (const eventType of [
			"channel_create",
			"channel_delete",
			"channel_update",
			"automod_incident",
			"ticket_opened",
			"moderation_case_created",
		]) {
			await tx
				.insert(logEventSettings)
				.values({
					enabled: true,
					eventType,
					guildId: guild.id,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [logEventSettings.guildId, logEventSettings.eventType],
					set: {
						enabled: true,
						updatedAt: now,
					},
				});
		}

		await tx
			.insert(ticketConfigs)
			.values({
				createdAt: now,
				guildId: guild.id,
				id: SEED_IDS.ticketConfig,
				logChannelId: context.primaryTextChannel.id,
				maxOpenPerUser: 2,
				transcriptChannelId: context.transcriptChannel.id,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: ticketConfigs.guildId,
				set: {
					logChannelId: context.primaryTextChannel.id,
					maxOpenPerUser: 2,
					transcriptChannelId: context.transcriptChannel.id,
					updatedAt: now,
				},
			});

		await tx
			.insert(ticketPanels)
			.values({
				channelId: context.panelChannel.id,
				createdAt: now,
				description: "Development ticket panel seeded automatically.",
				guildId: guild.id,
				id: SEED_IDS.ticketPanel,
				messageId: fakeSnowflake(guild.id, 10_001n),
				title: "Support Panel",
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: ticketPanels.id,
				set: {
					channelId: context.panelChannel.id,
					description: "Development ticket panel seeded automatically.",
					guildId: guild.id,
					messageId: fakeSnowflake(guild.id, 10_001n),
					title: "Support Panel",
					updatedAt: now,
				},
			});

		for (const category of [
			{
				description: "General support requests.",
				emoji: "🎫",
				id: SEED_IDS.ticketCategorySupport,
				maxOpenPerUser: 2,
				name: "Support",
				position: 0,
			},
			{
				description: "Reports and moderation appeals.",
				emoji: "🚨",
				id: SEED_IDS.ticketCategoryReport,
				maxOpenPerUser: 1,
				name: "Reports",
				position: 1,
			},
		]) {
			await tx
				.insert(ticketCategories)
				.values({
					channelType: "text",
					createdAt: now,
					description: category.description,
					emoji: category.emoji,
					guildId: guild.id,
					id: category.id,
					maxOpenPerUser: category.maxOpenPerUser,
					name: category.name,
					namingTemplate: `dev-${category.name.toLowerCase()}-{ticketNumber}`,
					parentChannelId: context.categoryChannel?.id ?? null,
					staffRoleId: context.staffRole.id,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [ticketCategories.guildId, ticketCategories.name],
					set: {
						channelType: "text",
						description: category.description,
						emoji: category.emoji,
						maxOpenPerUser: category.maxOpenPerUser,
						namingTemplate: `dev-${category.name.toLowerCase()}-{ticketNumber}`,
						parentChannelId: context.categoryChannel?.id ?? null,
						staffRoleId: context.staffRole.id,
						updatedAt: now,
					},
				});
		}

		for (const panelCategory of [
			{ buttonStyle: "primary" as const, categoryId: SEED_IDS.ticketCategorySupport, position: 0 },
			{ buttonStyle: "danger" as const, categoryId: SEED_IDS.ticketCategoryReport, position: 1 },
		]) {
			await tx
				.insert(panelCategories)
				.values({
					buttonStyle: panelCategory.buttonStyle,
					categoryId: panelCategory.categoryId,
					panelId: SEED_IDS.ticketPanel,
					position: panelCategory.position,
				})
				.onConflictDoUpdate({
					target: [panelCategories.panelId, panelCategories.categoryId],
					set: {
						buttonStyle: panelCategory.buttonStyle,
						position: panelCategory.position,
					},
				});
		}

		await tx
			.insert(tickets)
			.values({
				categoryId: SEED_IDS.ticketCategorySupport,
				channelId: fakeSnowflake(guild.id, 20_001n),
				channelType: "text",
				claimedById: context.moderatorId,
				createdAt: now,
				guildId: guild.id,
				id: SEED_IDS.ticketRecord,
				openMethod: "panel",
				openerId: context.ownerId,
				status: "open",
				ticketNumber: 900_001,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [tickets.guildId, tickets.ticketNumber],
				set: {
					categoryId: SEED_IDS.ticketCategorySupport,
					channelId: fakeSnowflake(guild.id, 20_001n),
					channelType: "text",
					claimedById: context.moderatorId,
					openMethod: "panel",
					openerId: context.ownerId,
					status: "open",
					updatedAt: now,
				},
			});

		await tx
			.insert(ticketParticipants)
			.values({
				addedAt: now,
				addedById: context.moderatorId,
				ticketId: SEED_IDS.ticketRecord,
				userId: context.ownerId,
			})
			.onConflictDoUpdate({
				target: [ticketParticipants.ticketId, ticketParticipants.userId],
				set: {
					addedAt: now,
					addedById: context.moderatorId,
				},
			});

		await tx
			.insert(ticketMessages)
			.values({
				attachments: [],
				authorId: context.ownerId,
				authorUsername: context.ownerUsername,
				content: "Seeded ticket message for development.",
				discordMessageId: fakeSnowflake(guild.id, 30_001n),
				embeds: [],
				id: SEED_IDS.ticketMessage,
				isBot: false,
				sentAt: now,
				ticketId: SEED_IDS.ticketRecord,
			})
			.onConflictDoUpdate({
				target: ticketMessages.id,
				set: {
					authorId: context.ownerId,
					authorUsername: context.ownerUsername,
					content: "Seeded ticket message for development.",
					discordMessageId: fakeSnowflake(guild.id, 30_001n),
					sentAt: now,
					ticketId: SEED_IDS.ticketRecord,
				},
			});

		await tx
			.insert(ticketActions)
			.values({
				action: "opened",
				actorId: context.moderatorId,
				createdAt: now,
				id: SEED_IDS.ticketAction,
				metadata: {
					note: "Development seed action",
					source: "guildAvailable",
				},
				ticketId: SEED_IDS.ticketRecord,
			})
			.onConflictDoUpdate({
				target: ticketActions.id,
				set: {
					action: "opened",
					actorId: context.moderatorId,
					createdAt: now,
					metadata: {
						note: "Development seed action",
						source: "guildAvailable",
					},
					ticketId: SEED_IDS.ticketRecord,
				},
			});

		await tx
			.insert(warnThresholds)
			.values({
				actionType: "timeout",
				createdAt: now,
				durationSeconds: 3_600,
				guildId: guild.id,
				id: SEED_IDS.warnThreshold,
				warnCount: 99,
			})
			.onConflictDoUpdate({
				target: [warnThresholds.guildId, warnThresholds.warnCount],
				set: {
					actionType: "timeout",
					durationSeconds: 3_600,
				},
			});

		await tx
			.insert(modCases)
			.values({
				actionType: "warn",
				active: true,
				caseNumber: 900_001,
				createdAt: now,
				durationSeconds: null,
				expiresAt: null,
				guildId: guild.id,
				id: SEED_IDS.modCase,
				metadata: {
					seeded: true,
					source: "development-bootstrap",
				},
				moderatorId: context.moderatorId,
				reason: "Development seeded moderation case",
				targetId: context.ownerId,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [modCases.guildId, modCases.caseNumber],
				set: {
					actionType: "warn",
					active: true,
					metadata: {
						seeded: true,
						source: "development-bootstrap",
					},
					moderatorId: context.moderatorId,
					reason: "Development seeded moderation case",
					targetId: context.ownerId,
					updatedAt: now,
				},
			});

		for (const rule of [
			{
				actionDurationSeconds: null,
				actionType: "delete",
				config: { burstCount: 6, burstWindowSeconds: 10 },
				id: SEED_IDS.automodRuleSpam,
				ruleType: "spam",
			},
			{
				actionDurationSeconds: 600,
				actionType: "timeout",
				config: { mentionLimit: 8, mentionWindowSeconds: 15 },
				id: SEED_IDS.automodRuleMentions,
				ruleType: "mention_spam",
			},
		]) {
			await tx
				.insert(automodRules)
				.values({
					actionDurationSeconds: rule.actionDurationSeconds,
					actionType: rule.actionType,
					config: rule.config,
					createdAt: now,
					enabled: true,
					guildId: guild.id,
					id: rule.id,
					ruleType: rule.ruleType,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [automodRules.guildId, automodRules.ruleType],
					set: {
						actionDurationSeconds: rule.actionDurationSeconds,
						actionType: rule.actionType,
						config: rule.config,
						enabled: true,
						updatedAt: now,
					},
				});
		}

		await tx
			.insert(automodExemptions)
			.values({
				createdAt: now,
				guildId: guild.id,
				id: SEED_IDS.automodExemptionGlobal,
				ruleType: null,
				targetId: context.staffRole.id,
				targetType: "role",
			})
			.onConflictDoUpdate({
				target: automodExemptions.id,
				set: {
					ruleType: null,
					targetId: context.staffRole.id,
					targetType: "role",
				},
			});

		await tx
			.insert(raidStates)
			.values({
				active: false,
				guildId: guild.id,
				id: SEED_IDS.raidState,
				metadata: {
					lastKnownSafeAt: now.toISOString(),
					seeded: true,
				},
				resolvedAt: now,
				resolvedById: context.moderatorId,
				triggerReason: null,
				triggeredAt: null,
			})
			.onConflictDoUpdate({
				target: raidStates.guildId,
				set: {
					active: false,
					metadata: {
						lastKnownSafeAt: now.toISOString(),
						seeded: true,
					},
					resolvedAt: now,
					resolvedById: context.moderatorId,
					triggerReason: null,
					triggeredAt: null,
				},
			});

		await tx
			.insert(automodIncidents)
			.values({
				actionTaken: "delete",
				caseId: SEED_IDS.modCase,
				channelId: context.primaryTextChannel.id,
				createdAt: now,
				guildId: guild.id,
				id: SEED_IDS.automodIncident,
				metadata: {
					matchedContent: "seeded spam payload",
					seeded: true,
				},
				ruleType: "spam",
				targetId: context.ownerId,
			})
			.onConflictDoUpdate({
				target: automodIncidents.id,
				set: {
					actionTaken: "delete",
					caseId: SEED_IDS.modCase,
					channelId: context.primaryTextChannel.id,
					metadata: {
						matchedContent: "seeded spam payload",
						seeded: true,
					},
					ruleType: "spam",
					targetId: context.ownerId,
				},
			});

		await tx
			.insert(logEntries)
			.values({
				actorId: context.moderatorId,
				channelId: context.primaryTextChannel.id,
				createdAt: now,
				discordMessageId: null,
				eventType: "seed_bootstrap",
				expiresAt: null,
				guildId: guild.id,
				id: SEED_IDS.logEntry,
				logGroup: "system",
				metadata: {
					moderatorUsername: context.moderatorUsername,
					seeded: true,
					source: "guildAvailable",
				},
				targetId: context.primaryTextChannel.id,
				targetType: "channel",
			})
			.onConflictDoUpdate({
				target: logEntries.id,
				set: {
					actorId: context.moderatorId,
					channelId: context.primaryTextChannel.id,
					createdAt: now,
					eventType: "seed_bootstrap",
					expiresAt: null,
					logGroup: "system",
					metadata: {
						moderatorUsername: context.moderatorUsername,
						seeded: true,
						source: "guildAvailable",
					},
					targetId: context.primaryTextChannel.id,
					targetType: "channel",
				},
			});
	});

	log.info({ guild: guild.id }, "Development guild seed applied");
};
