import { Inject, Injectable, UseGuards } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  type User,
} from 'discord.js';
import { PinoLogger } from 'nestjs-pino';
import { Context, Options, SlashCommand, UserOption, type SlashCommandContext } from 'necord';

import { RequirePermissions } from '#/common/decorators/require-permissions.decorator.js';
import { RequirePermissionsGuard } from '#/common/guards/require-permissions.guard.js';
import { GuildConfigService } from '#/modules/guild-config/guild-config.service.js';

const PING_COLLECTOR_TIME_MS = 30_000;
const EMBED_COLOR = 0x2f80ed;
const AVATAR_IMAGE_SIZE = 1024 as const;
const MILLISECONDS_PER_SECOND = 1_000;

class TargetUserOptions {
  @UserOption({
    name: 'user',
    description: 'User to inspect',
    required: false,
  })
  public user?: User;
}

@Injectable()
export class UtilitiesCommands {
  public constructor(
    @Inject(Client) private readonly client: Client<true>,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
    private readonly guildConfigService: GuildConfigService,
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
    if (interaction.guildId) {
      await this.guildConfigService.ensureGuild(interaction.guildId);
    }

    const customId = `ping:refresh:${interaction.id}`;
    const buildPayload = (createdTimestamp: number, disabled = false) => {
      const gatewayLatencyMs = Math.round(this.client.ws.ping);
      const roundTripLatencyMs = Date.now() - createdTimestamp;

      return {
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLOR)
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
      void interaction
        .editReply({
          components: buildPayload(interaction.createdTimestamp, true).components,
        })
        .catch((error: unknown) => {
          this.logger.warn({ err: error }, 'Failed to disable ping refresh button');
        });
    });
  }

  @SlashCommand({
    name: 'server-info',
    description: 'Show server information',
  })
  @UseGuards(RequirePermissionsGuard)
  @RequirePermissions()
  public async serverInfo(@Context() [interaction]: SlashCommandContext): Promise<void> {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await this.guildConfigService.ensureGuild(guild.id);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle(guild.name)
          .setThumbnail(guild.iconURL({ size: AVATAR_IMAGE_SIZE }))
          .addFields(
            { name: 'ID', value: `\`${guild.id}\``, inline: true },
            { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
            { name: 'Members', value: `\`${String(guild.memberCount)}\``, inline: true },
            { name: 'Channels', value: `\`${String(guild.channels.cache.size)}\``, inline: true },
            { name: 'Roles', value: `\`${String(guild.roles.cache.size)}\``, inline: true },
            {
              name: 'Created',
              value: `<t:${String(Math.floor(guild.createdTimestamp / MILLISECONDS_PER_SECOND))}:F>`,
            },
          )
          .setTimestamp(),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  @SlashCommand({
    name: 'user-info',
    description: 'Show user information',
  })
  @UseGuards(RequirePermissionsGuard)
  @RequirePermissions()
  public async userInfo(
    @Context() [interaction]: SlashCommandContext,
    @Options() options: TargetUserOptions,
  ): Promise<void> {
    if (interaction.guildId) {
      await this.guildConfigService.ensureGuild(interaction.guildId);
    }

    const user = options.user ?? interaction.user;
    const member = interaction.guild
      ? await interaction.guild.members.fetch(user.id).catch((error: unknown) => {
          this.logger.debug({ err: error, userId: user.id }, 'Failed to fetch guild member');
          return null;
        })
      : null;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle(user.tag)
          .setThumbnail(user.displayAvatarURL({ size: AVATAR_IMAGE_SIZE }))
          .addFields(
            { name: 'ID', value: `\`${user.id}\``, inline: true },
            { name: 'Bot', value: user.bot ? '`Yes`' : '`No`', inline: true },
            {
              name: 'Created',
              value: `<t:${String(Math.floor(user.createdTimestamp / MILLISECONDS_PER_SECOND))}:F>`,
            },
            {
              name: 'Joined',
              value: member?.joinedTimestamp
                ? `<t:${String(Math.floor(member.joinedTimestamp / MILLISECONDS_PER_SECOND))}:F>`
                : '`Not available`',
            },
          )
          .setTimestamp(),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  @SlashCommand({
    name: 'avatar',
    description: 'Show a user avatar',
  })
  @UseGuards(RequirePermissionsGuard)
  @RequirePermissions()
  public async avatar(
    @Context() [interaction]: SlashCommandContext,
    @Options() options: TargetUserOptions,
  ): Promise<void> {
    if (interaction.guildId) {
      await this.guildConfigService.ensureGuild(interaction.guildId);
    }

    const user = options.user ?? interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: AVATAR_IMAGE_SIZE });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle(`${user.username}'s avatar`)
          .setImage(avatarUrl)
          .setURL(avatarUrl)
          .setTimestamp(),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
