import { Events, MessageFlags } from 'discord.js';

import { getCommand } from '../../commands/index.js';
import { createLogger } from '../../services/logger.js';
import { defineEvent } from '../types.js';

const logger = createLogger('events.interaction.create');

export const interactionCreateEvent = defineEvent(Events.InteractionCreate, async (interaction) => {
  const context = {
    interactionId: interaction.id,
    interactionType: interaction.type,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
  };

  const reply = async (
    content = 'This interaction was received, but no application handler is registered for it yet.',
  ): Promise<void> => {
    if (!interaction.isRepliable() || interaction.replied) {
      return;
    }

    if (interaction.deferred) {
      await interaction.editReply({ content });
      return;
    }

    await interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
    });
  };

  if (interaction.isChatInputCommand()) {
    const command = getCommand(interaction.commandName);

    logger.info(
      {
        ...context,
        commandId: interaction.commandId,
        commandName: interaction.commandName,
        commandGuildId: interaction.commandGuildId,
        options: interaction.options.data.map((option) => option.name),
      },
      'Discord chat input command interaction received',
    );

    if (command === undefined) {
      logger.warn(
        { ...context, commandName: interaction.commandName },
        'Unknown Discord slash command received',
      );
      await reply('This command is not available.');
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(
        { err: error, ...context, commandName: interaction.commandName },
        'Discord slash command failed',
      );
      await reply('Something went wrong while executing this command.');
    }

    return;
  }

  if (interaction.isUserContextMenuCommand()) {
    logger.info(
      {
        ...context,
        commandId: interaction.commandId,
        commandName: interaction.commandName,
        targetUserId: interaction.targetUser.id,
      },
      'Discord user context menu interaction received',
    );

    await reply();
    return;
  }

  if (interaction.isMessageContextMenuCommand()) {
    logger.info(
      {
        ...context,
        commandId: interaction.commandId,
        commandName: interaction.commandName,
        targetMessageId: interaction.targetMessage.id,
      },
      'Discord message context menu interaction received',
    );

    await reply();
    return;
  }

  if (interaction.isPrimaryEntryPointCommand()) {
    logger.info(
      {
        ...context,
        commandId: interaction.commandId,
        commandName: interaction.commandName,
        commandGuildId: interaction.commandGuildId,
      },
      'Discord primary entry point command interaction received',
    );

    await reply();
    return;
  }

  if (interaction.isAutocomplete()) {
    const focusedOption = interaction.options.getFocused(true);
    const command = getCommand(interaction.commandName);

    logger.debug(
      {
        ...context,
        commandId: interaction.commandId,
        commandName: interaction.commandName,
        focusedOptionName: focusedOption.name,
        focusedOptionValue: focusedOption.value,
      },
      'Discord autocomplete interaction received',
    );

    if (command?.autocomplete === undefined) {
      await interaction.respond([]);
      return;
    }

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      logger.error(
        { err: error, ...context, commandName: interaction.commandName },
        'Discord autocomplete failed',
      );
      await interaction.respond([]);
    }

    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('ping:refresh:')) {
      return;
    }

    logger.info(
      {
        ...context,
        customId: interaction.customId,
        componentType: interaction.componentType,
        messageId: interaction.message.id,
      },
      'Discord button interaction received',
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    return;
  }

  if (interaction.isAnySelectMenu()) {
    logger.info(
      {
        ...context,
        customId: interaction.customId,
        componentType: interaction.componentType,
        messageId: interaction.message.id,
        values: interaction.values,
      },
      'Discord select menu interaction received',
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    return;
  }

  if (interaction.isModalSubmit()) {
    logger.info(
      {
        ...context,
        customId: interaction.customId,
        fieldCount: interaction.fields.fields.size,
      },
      'Discord modal submit interaction received',
    );

    await reply('Form submitted.');
    return;
  }

  logger.warn(context, 'Unhandled Discord interaction received');
});
