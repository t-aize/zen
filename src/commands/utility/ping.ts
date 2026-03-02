import os from "node:os";
import { defineCommand } from "@zen/commands";
import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonStyle,
	blockQuote,
	bold,
	type Client,
	ComponentType,
	version as djsVersion,
	EmbedBuilder,
	InteractionContextType,
	inlineCode,
	italic,
	MessageFlags,
	SlashCommandBuilder,
	TimestampStyles,
	time,
} from "discord.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const DISCORD_STATUS_URL = "https://discordstatus.com";
const BOT_INVITE_URL = "https://discord.com/developers/applications";
const COLLECTOR_IDLE_MS = 180_000;

const EMBED_COLOR_OK = 0x22c55e;
const EMBED_COLOR_WARN = 0xf59e0b;
const EMBED_COLOR_CRITICAL = 0xef4444;

const BUTTON_ID_REFRESH = "ping:refresh";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Formats a duration in milliseconds into a human-readable string.
 * Outputs compact notation: `2d 5h 32m 8s`.
 */
const formatDuration = (milliseconds: number): string => {
	const totalSeconds = Math.floor(milliseconds / 1_000);
	const days = Math.floor(totalSeconds / 86_400);
	const hours = Math.floor((totalSeconds % 86_400) / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);
	const seconds = totalSeconds % 60;

	const parts: string[] = [];

	if (days > 0) parts.push(`${days}d`);
	if (hours > 0 || parts.length > 0) parts.push(`${hours}h`);
	if (minutes > 0 || parts.length > 0) parts.push(`${minutes}m`);
	parts.push(`${seconds}s`);

	return parts.join(" ");
};

/**
 * Returns a latency rating emoji based on the value in ms.
 */
const latencyIndicator = (ms: number): string => {
	if (ms < 100) return "🟢";
	if (ms < 250) return "🟡";
	return "🔴";
};

/**
 * Returns a text label for the latency tier.
 */
const latencyLabel = (ms: number): string => {
	if (ms < 100) return "Excellent";
	if (ms < 250) return "Fair";
	return "Poor";
};

/**
 * Returns an embed accent colour based on the worst latency value.
 */
const embedColorFromLatency = (gateway: number, roundTrip: number): number => {
	const worst = Math.max(gateway, roundTrip);
	if (worst < 150) return EMBED_COLOR_OK;
	if (worst < 400) return EMBED_COLOR_WARN;
	return EMBED_COLOR_CRITICAL;
};

/**
 * Formats bytes into a compact human-readable string (e.g. `42.7 MB`).
 */
const formatMemory = (bytes: number): string => {
	const mb = bytes / 1_024 / 1_024;
	return `${mb.toFixed(1)} MB`;
};

/**
 * Returns a percentage string for memory usage.
 */
const memoryPercent = (used: number, total: number): string => {
	if (total === 0) return "0%";
	return `${((used / total) * 100).toFixed(1)}%`;
};

// ─── Snapshot ────────────────────────────────────────────────────────────────

interface DiagnosticSnapshot {
	gatewayLatency: number;
	roundTripLatency: number;
	shardId: number;
	shardCount: number;
	uptime: string;
	guildCount: number;
	userCount: number;
	channelCount: number;
	emojiCount: number;
	heapUsed: number;
	heapTotal: number;
	rss: number;
	external: number;
	cpuModel: string;
	cpuCores: number;
	platform: string;
	arch: string;
	pid: number;
	nodeVersion: string;
	djsVersion: string;
	timestamp: Date;
}

const collectDiagnostics = (client: Client<true>, roundTripMs: number): DiagnosticSnapshot => {
	const mem = process.memoryUsage();
	const cpus = os.cpus();
	const wsPing = client.ws.ping;

	return {
		gatewayLatency: wsPing >= 0 ? Math.round(wsPing) : roundTripMs,
		roundTripLatency: roundTripMs,
		shardId: client.ws.shards.first()?.id ?? 0,
		shardCount: client.ws.shards.size,
		uptime: formatDuration(client.uptime ?? 0),
		guildCount: client.guilds.cache.size,
		userCount: client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
		channelCount: client.channels.cache.size,
		emojiCount: client.emojis.cache.size,
		heapUsed: mem.heapUsed,
		heapTotal: mem.heapTotal,
		rss: mem.rss,
		external: mem.external,
		cpuModel: cpus[0]?.model.trim() ?? "Unknown",
		cpuCores: cpus.length,
		platform: process.platform,
		arch: process.arch,
		pid: process.pid,
		nodeVersion: process.version,
		djsVersion,
		timestamp: new Date(),
	};
};

// ─── Footer Helper ───────────────────────────────────────────────────────────

const buildFooter = (text: string, avatarUrl?: string) =>
	avatarUrl ? { text, iconURL: avatarUrl } : { text };

// ─── Embed Builders ──────────────────────────────────────────────────────────

const buildPingEmbed = (
	snapshot: DiagnosticSnapshot,
	refreshCount: number,
	avatarUrl?: string,
): EmbedBuilder => {
	const gwIndicator = latencyIndicator(snapshot.gatewayLatency);
	const rtIndicator = latencyIndicator(snapshot.roundTripLatency);
	const color = embedColorFromLatency(snapshot.gatewayLatency, snapshot.roundTripLatency);

	const footerParts = ["Diagnostics"];
	if (refreshCount > 0) {
		footerParts.push(`Refreshed ${refreshCount}×`);
	}

	return new EmbedBuilder()
		.setColor(color)
		.setTitle("🏓  Pong — Diagnostics")
		.setThumbnail(avatarUrl ?? null)
		.setDescription(
			blockQuote(
				[
					`${bold("Real-time health check")} for the active gateway session.`,
					`${bold("💡 Tip")} — Hit the ${inlineCode("🔄 Refresh")} button or run ${inlineCode("/ping")} anytime`,
					`to get a ${italic("fresh diagnostic snapshot")}.`,
				].join("\n"),
			),
		)
		.addFields(
			{
				name: "⚙️  Runtime",
				value: blockQuote(
					[
						`🔢 Shard:  ${inlineCode(`#${snapshot.shardId}`)} / ${inlineCode(String(snapshot.shardCount))}`,
						`⏱️ Uptime:  ${inlineCode(snapshot.uptime)}`,
						`🔑 PID:  ${inlineCode(String(snapshot.pid))}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "📡  Latency",
				value: blockQuote(
					[
						`${gwIndicator} Gateway:  ${inlineCode(`${snapshot.gatewayLatency} ms`)}  ${italic(latencyLabel(snapshot.gatewayLatency))}`,
						`${rtIndicator} Round-trip:  ${inlineCode(`${snapshot.roundTripLatency} ms`)}  ${italic(latencyLabel(snapshot.roundTripLatency))}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🧠  Memory",
				value: blockQuote(
					[
						`📦 Heap:  ${inlineCode(formatMemory(snapshot.heapUsed))} / ${inlineCode(formatMemory(snapshot.heapTotal))}  ${italic(`(${memoryPercent(snapshot.heapUsed, snapshot.heapTotal)})`)}`,
						`💾 RSS:  ${inlineCode(formatMemory(snapshot.rss))}`,
						`📎 External:  ${inlineCode(formatMemory(snapshot.external))}`,
					].join("\n"),
				),
				inline: false,
			},
			{
				name: "🔧  Environment",
				value: blockQuote(
					[
						`🟢 Node.js:  ${inlineCode(snapshot.nodeVersion)}`,
						`📘 discord.js:  ${inlineCode(`v${snapshot.djsVersion}`)}`,
						`🖥️ OS:  ${inlineCode(`${snapshot.platform} ${snapshot.arch}`)}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🕐  Generated",
				value: blockQuote(
					`${time(snapshot.timestamp, TimestampStyles.RelativeTime)}  —  ${italic(inlineCode(snapshot.timestamp.toISOString()))}`,
				),
				inline: false,
			},
		)
		.setFooter(buildFooter(footerParts.join("  •  "), avatarUrl))
		.setTimestamp(snapshot.timestamp);
};

// ─── Action Row ──────────────────────────────────────────────────────────────

const buildMainRow = (disabled = false): ActionRowBuilder<ButtonBuilder> => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(BUTTON_ID_REFRESH)
			.setLabel("Refresh")
			.setEmoji("🔄")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setLabel("Discord Status")
			.setEmoji("📋")
			.setStyle(ButtonStyle.Link)
			.setURL(DISCORD_STATUS_URL),
		new ButtonBuilder()
			.setLabel("Invite")
			.setEmoji("🔗")
			.setStyle(ButtonStyle.Link)
			.setURL(BOT_INVITE_URL),
	);
};

// ─── Command Definition ──────────────────────────────────────────────────────

defineCommand({
	data: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Display live latency, runtime metrics, and platform health diagnostics")
		.setContexts(
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		)
		.setIntegrationTypes(
			ApplicationIntegrationType.GuildInstall,
			ApplicationIntegrationType.UserInstall,
		),
	category: "utility",
	execute: async (interaction) => {
		const start = Date.now();
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		let roundTripMs = Date.now() - start;

		let refreshCount = 0;
		const avatarUrl = interaction.client.user?.displayAvatarURL({ size: 256 });

		const snapshot = collectDiagnostics(interaction.client as Client<true>, roundTripMs);

		const reply = await interaction.editReply({
			embeds: [buildPingEmbed(snapshot, refreshCount, avatarUrl)],
			components: [buildMainRow()],
		});

		// ── Button collector ─────────────────────────────────────────────

		const collector = reply.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (i) => i.customId === BUTTON_ID_REFRESH,
			idle: COLLECTOR_IDLE_MS,
		});

		collector.on("collect", async (buttonInteraction) => {
			refreshCount++;

			const preliminarySnapshot = collectDiagnostics(
				interaction.client as Client<true>,
				roundTripMs,
			);

			const refreshStart = Date.now();
			await buttonInteraction.update({
				embeds: [buildPingEmbed(preliminarySnapshot, refreshCount, avatarUrl)],
				components: [buildMainRow()],
			});
			roundTripMs = Date.now() - refreshStart;

			const measuredSnapshot = collectDiagnostics(interaction.client as Client<true>, roundTripMs);

			await interaction.editReply({
				embeds: [buildPingEmbed(measuredSnapshot, refreshCount, avatarUrl)],
				components: [buildMainRow()],
			});
		});

		collector.on("end", async () => {
			const finalSnapshot = collectDiagnostics(interaction.client as Client<true>, roundTripMs);

			await interaction
				.editReply({
					embeds: [
						buildPingEmbed(finalSnapshot, refreshCount, avatarUrl).setFooter(
							buildFooter("Diagnostics  •  Session expired", avatarUrl),
						),
					],
					components: [buildMainRow(true)],
				})
				.catch(() => {
					/* message deleted or interaction expired */
				});
		});
	},
});
