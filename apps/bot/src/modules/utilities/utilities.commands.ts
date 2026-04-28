import { Inject, Injectable, UseGuards } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { PinoLogger } from 'nestjs-pino';
import { Context, SlashCommand, type SlashCommandContext } from 'necord';

import { RequirePermissions } from '#/common/decorators/require-permissions.decorator.js';
import { RequirePermissionsGuard } from '#/common/guards/require-permissions.guard.js';

const PING_COLLECTOR_TIME_MS = 30_000;

@Injectable()
export class UtilitiesCommands {
  public constructor(
    @Inject(Client) private readonly client: Client<true>,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UtilitiesCommands.name);
  }

  @SlashCommand({
    name: 'ping',
    description: 'Check bot latency',
  })
  @UseGuards(RequirePermissionsGuard)
  @RequirePermissions()
  public async ping(@Context() [interaction]: SlashCommandContext): Promise<void> {
    const customId = `ping:refresh:${interaction.id}`;
    const buildPayload = (createdTimestamp: number, disabled = false) => {
      const gatewayLatencyMs = Math.round(this.client.ws.ping);
      const roundTripLatencyMs = Date.now() - createdTimestamp;

      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0x2f80ed)
            .setTitle('Pong')
            .setDescription(
              [
                `**Gateway:** \`${String(gatewayLatencyMs)}ms\``,
                `**Round-trip:** \`${String(roundTripLatencyMs)}ms\``,
              ].join('\n'),
            )
            .setTimestamp(),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(customId)
              .setLabel(disabled ? 'Expired' : 'Refresh')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(disabled),
          ),
        ],
      };
    };

    const response = await interaction.reply({
      ...buildPayload(interaction.createdTimestamp),
      flags: MessageFlags.Ephemeral,
      withResponse: true,
    });

    const message = response.resource?.message;

    this.logger.debug(
      { userId: interaction.user.id, commandId: interaction.id },
      'Ping command executed',
    );

    if (!message) {
      this.logger.error({ commandId: interaction.id }, 'Ping reply message was not returned');
      return;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (buttonInteraction) =>
        buttonInteraction.customId === customId &&
        buttonInteraction.user.id === interaction.user.id,
      time: PING_COLLECTOR_TIME_MS,
    });

    collector.on('collect', (buttonInteraction) => {
      void buttonInteraction
        .update(buildPayload(buttonInteraction.createdTimestamp))
        .catch((error: unknown) => {
          this.logger.warn({ err: error }, 'Failed to refresh ping response');
        });
    });

    collector.on('end', () => {
      void interaction.editReply({
        components: buildPayload(interaction.createdTimestamp, true).components,
      });
    });
  }
}
