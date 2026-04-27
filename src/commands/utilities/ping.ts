import type { APIEmbedField, ButtonInteraction } from 'discord.js';
import {
  ActionRowBuilder,
  blockQuote,
  bold,
  ButtonBuilder,
  ButtonStyle,
  codeBlock as code,
  ComponentType,
  EmbedBuilder,
  inlineCode,
  italic,
  MessageFlags,
  quote,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  underline,
} from 'discord.js';

import { defineSlashCommand } from '../types.js';

const refreshButtonPrefix = 'ping:refresh';
const refreshTimeout = 120_000;

interface PingMetrics {
  interactionLatency: number;
  websocketLatency: number;
  uptime: number;
  refreshedAt: Date;
}

function getLatencyLabel(latency: number): string {
  if (latency < 100) {
    return 'Excellent';
  }

  if (latency < 250) {
    return 'Good';
  }

  if (latency < 500) {
    return 'Stable';
  }

  return 'Degraded';
}

function createPingEmbed(metrics: PingMetrics, clientAvatarUrl: string | null): EmbedBuilder {
  const websocketStatus = getLatencyLabel(metrics.websocketLatency);
  const interactionStatus = getLatencyLabel(metrics.interactionLatency);
  const refreshedTimestamp = Math.floor(metrics.refreshedAt.getTime() / 1000);
  const uptime = Math.floor(metrics.uptime);
  const fields: APIEmbedField[] = [
    {
      name: 'Gateway',
      value: blockQuote(
        [
          `📡 Latency ${inlineCode(`${metrics.websocketLatency}ms`)}`,
          `Signal ${inlineCode(websocketStatus)}`,
        ].join('\n'),
      ),
      inline: true,
    },
    {
      name: 'Interaction',
      value: blockQuote(
        [
          `⚡ Ack ${inlineCode(`${metrics.interactionLatency}ms`)}`,
          `Flow ${inlineCode(interactionStatus)}`,
        ].join('\n'),
      ),
      inline: true,
    },
    {
      name: 'Runtime',
      value: blockQuote(
        [
          `🧭 Uptime ${inlineCode(`${uptime}s`)}`,
          `Updated ${time(refreshedTimestamp, TimestampStyles.RelativeTime)}`,
        ].join('\n'),
      ),
      inline: true,
    },
  ];

  const author =
    clientAvatarUrl === null
      ? { name: 'Zen diagnostics' }
      : { name: 'Zen diagnostics', iconURL: clientAvatarUrl };
  const footer =
    clientAvatarUrl === null
      ? {
          text: `Requested latency snapshot • Refresh expires in ${Math.floor(refreshTimeout / 1000)}s`,
        }
      : {
          text: `Requested latency snapshot • Refresh expires in ${Math.floor(refreshTimeout / 1000)}s`,
          iconURL: clientAvatarUrl,
        };

  return new EmbedBuilder()
    .setColor(
      metrics.websocketLatency < 250 && metrics.interactionLatency < 250 ? 0x2ecc71 : 0xf1c40f,
    )
    .setTitle('🏓 Pong')
    .setAuthor(author)
    .setThumbnail(clientAvatarUrl)
    .setDescription(
      [
        `${bold('Zen')} is online and responding normally.`,
        quote(italic('Gateway and interaction latency are refreshed independently.')),
        code(
          'yaml',
          [
            `gateway: ${metrics.websocketLatency}ms`,
            `interaction: ${metrics.interactionLatency}ms`,
            `status: ${websocketStatus.toLowerCase()}`,
          ].join('\n'),
        ),
      ].join('\n'),
    )
    .addFields(fields)
    .setFooter(footer)
    .setTimestamp(metrics.refreshedAt);
}

function createRefreshRow(customId: string, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setEmoji('🔄')
      .setLabel(disabled ? 'Refresh expired' : 'Refresh')
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

export const pingCommand = defineSlashCommand({
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency.'),

  async execute(interaction) {
    const customId = `${refreshButtonPrefix}:${interaction.id}`;
    const startedAt = Date.now();

    await interaction.deferReply();

    let metrics: PingMetrics = {
      interactionLatency: Date.now() - startedAt,
      websocketLatency: interaction.client.ws.ping,
      uptime: interaction.client.uptime / 1000,
      refreshedAt: new Date(),
    };
    const clientAvatarUrl = interaction.client.user.displayAvatarURL({ size: 256 });

    const message = await interaction.editReply({
      embeds: [createPingEmbed(metrics, clientAvatarUrl)],
      components: [createRefreshRow(customId)],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (componentInteraction) => componentInteraction.customId === customId,
      time: refreshTimeout,
    });

    collector.on('collect', (componentInteraction) => {
      void (async (buttonInteraction: ButtonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({
            content: underline('This refresh button belongs to another command run.'),
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const refreshedAt = Date.now();

        await buttonInteraction.deferUpdate();

        metrics = {
          interactionLatency: Date.now() - refreshedAt,
          websocketLatency: buttonInteraction.client.ws.ping,
          uptime: buttonInteraction.client.uptime / 1000,
          refreshedAt: new Date(),
        };

        await buttonInteraction.message.edit({
          embeds: [createPingEmbed(metrics, clientAvatarUrl)],
          components: [createRefreshRow(customId)],
        });
      })(componentInteraction);
    });

    collector.once('end', () => {
      void message.edit({
        embeds: [createPingEmbed(metrics, clientAvatarUrl)],
        components: [createRefreshRow(customId, true)],
      });
    });
  },
});
