import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Client,
	Colors,
	EmbedBuilder,
	inlineCode,
	MessageFlags,
	SlashCommandBuilder,
	TimestampStyles,
	time,
} from "discord.js";
import { defineCommand } from "@/commands/index.js";

const PING_REFRESH_ID = "ping:refresh";

const latencyBar = (ms: number): string => {
	if (ms < 80) return "🟢 Excellent";
	if (ms < 150) return "🟡 Good";
	if (ms < 250) return "🟠 Degraded";
	return "🔴 Poor";
};

const buildEmbed = (client: Client, triggeredAt: Date, restLatency: number) => {
	const wsLatency = client.ws.ping;

	return new EmbedBuilder()
		.setTitle("🏓 Pong!")
		.setDescription("Real-time latency diagnostics for the bot and Discord's infrastructure.")
		.setColor(
			wsLatency < 80
				? Colors.Green
				: wsLatency < 150
					? Colors.Yellow
					: wsLatency < 250
						? Colors.Orange
						: Colors.Red,
		)
		.addFields(
			{
				name: "🔌 WebSocket Gateway",
				value: `>>> ${inlineCode("Ping:")} **${wsLatency}ms**\n${inlineCode("Status:")} ${latencyBar(wsLatency)}`,
				inline: true,
			},
			{
				name: "🌐 REST API",
				value: `>>> ${inlineCode("Round-trip:")} **${restLatency}ms**\n${inlineCode("Status:")} ${latencyBar(restLatency)}`,
				inline: true,
			},
			{
				name: "🤖 Bot",
				value: `>>> ${inlineCode("Uptime:")} **${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s**\n${inlineCode("Heap:")} **${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB**`,
				inline: true,
			},
			{
				name: "🕐 Timestamp",
				value: `>>> ${inlineCode("Measured:")} ${time(triggeredAt, TimestampStyles.FullDateShortTime)} (${time(triggeredAt, TimestampStyles.RelativeTime)})`,
				inline: false,
			},
		)
		.setFooter({ text: "Zen • Latency Monitor" })
		.setTimestamp(triggeredAt);
};

const buildRow = (disabled = false) =>
	new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(PING_REFRESH_ID)
			.setLabel("Refresh")
			.setEmoji("🔄")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	);

defineCommand({
	data: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Displays WebSocket gateway and REST API latency diagnostics.")
		.setDefaultMemberPermissions(null)
		.setNSFW(false),
	execute: async (interaction) => {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const restLatency = Date.now() - interaction.createdTimestamp;
		const now = new Date();

		const message = await interaction.editReply({
			embeds: [buildEmbed(interaction.client, now, restLatency)],
			components: [buildRow()],
		});

		const collector = message.createMessageComponentCollector({
			time: 60_000,
		});

		collector.on("collect", async (btn) => {
			await btn.deferUpdate();
			const refreshLatency = Date.now() - btn.createdTimestamp;
			await btn.editReply({
				embeds: [buildEmbed(btn.client, new Date(), refreshLatency)],
				components: [buildRow()],
			});
		});

		collector.on("end", async () => {
			await interaction.editReply({ components: [buildRow(true)] }).catch(() => null);
		});
	},
});
