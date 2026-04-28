import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  Inject,
} from '@nestjs/common';
import {
  BaseInteraction,
  EmbedBuilder,
  MessageFlags,
  type InteractionReplyOptions,
  type RepliableInteraction,
} from 'discord.js';
import { PinoLogger } from 'nestjs-pino';
import { NecordArgumentsHost } from 'necord';

@Catch()
export class DiscordExceptionFilter implements ExceptionFilter {
  public constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext(DiscordExceptionFilter.name);
  }

  public async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const [interaction] = NecordArgumentsHost.create(host).getContext<[unknown]>();
    const message = this.getPublicMessage(exception);

    this.logger.error(
      {
        err: this.serializeException(exception),
        commandName: this.getCommandName(interaction),
        guildId: this.getGuildId(interaction),
        userId: this.getUserId(interaction),
      },
      'Discord command failed',
    );

    if (interaction instanceof BaseInteraction && interaction.isRepliable()) {
      await this.replyWithError(interaction, message);
    }
  }

  private async replyWithError(interaction: RepliableInteraction, message: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0xdc2626)
      .setTitle('Command failed')
      .setDescription(message);

    const payload: InteractionReplyOptions = {
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
      return;
    }

    await interaction.reply(payload);
  }

  private getPublicMessage(exception: unknown): string {
    if (exception instanceof ForbiddenException) {
      return exception.message;
    }

    if (exception instanceof HttpException && exception.getStatus() < 500) {
      return exception.message;
    }

    return 'An unexpected error occurred while running this command.';
  }

  private serializeException(exception: unknown): Record<string, unknown> {
    if (exception instanceof Error) {
      return {
        name: exception.name,
        message: exception.message,
        stack: exception.stack,
      };
    }

    return {
      value: exception,
    };
  }

  private getCommandName(value: unknown): string | null {
    if (value instanceof BaseInteraction && value.isCommand()) {
      return value.commandName;
    }

    return null;
  }

  private getGuildId(value: unknown): string | null {
    if (value instanceof BaseInteraction) {
      return value.guildId;
    }

    return null;
  }

  private getUserId(value: unknown): string | null {
    if (value instanceof BaseInteraction) {
      return value.user.id;
    }

    return null;
  }
}
