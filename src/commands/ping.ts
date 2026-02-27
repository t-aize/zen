import {defineCommand} from "@zen/commands";
import {
	ActionRowBuilder,
	blockQuote,
	bold,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	inlineCode,
	quote,
	SlashCommandBuilder,
	time,
	TimestampStyles,
} from "discord.js";

const DISCORD_STATUS_URL = "https://discordstatus.com";

function formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1_000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];

    if (days > 0) {
        parts.push(`${days}d`);
    }

    if (hours > 0 || parts.length > 0) {
        parts.push(`${hours}h`);
    }

    if (minutes > 0 || parts.length > 0) {
        parts.push(`${minutes}m`);
    }

    parts.push(`${seconds}s`);

    return parts.join(" ");
}

export const pingCommand = defineCommand({
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Display live latency and platform health diagnostics"),
    category: "utility",
    async execute(interaction) {
        await interaction.deferReply();

        const now = new Date();
        const responseLatency = Date.now() - interaction.createdTimestamp;
        const gatewayLatency = Math.max(0, Math.round(interaction.client.ws.ping));
        const shardId = interaction.guild?.shardId ?? 0;
        const uptime = formatDuration(interaction.client.uptime ?? 0);

        const embed = new EmbedBuilder()
            .setColor(0x2f855a)
            .setTitle("Pong - Platform Diagnostics")
            .setDescription(
                [
                    quote(`${bold("Realtime health check")} for the active gateway session.`),
                    blockQuote(`${bold("Tip")}: run ${inlineCode("/ping")} anytime for a fresh report.`),
                ].join("\n"),
            )
            .addFields(
                {
                    name: "Latency",
                    value: [
                        `${bold("Gateway")}: ${inlineCode(`${gatewayLatency}ms`)}`,
                        `${bold("Round-trip")}: ${inlineCode(`${responseLatency}ms`)}`,
                    ].join("\n"),
                    inline: true,
                },
                {
                    name: "Runtime",
                    value: [
                        `${bold("Shard")}: ${inlineCode(String(shardId))}`,
                        `${bold("Uptime")}: ${inlineCode(uptime)}`,
                    ].join("\n"),
                    inline: true,
                },
                {
                    name: "Generated",
                    value: `${time(now, TimestampStyles.FullDateShortTime)} (${inlineCode(now.toISOString())})`,
                },
            )
            .setFooter({text: "Zen Enterprise Diagnostics"})
            .setTimestamp(now);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel("Discord Status")
                .setStyle(ButtonStyle.Link)
                .setURL(DISCORD_STATUS_URL),
        );

        await interaction.editReply({
            embeds: [embed],
            components: [actionRow],
        });
    },
});
