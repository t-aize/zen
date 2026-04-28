import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Client, MessageFlags } from 'discord.js';
import { Context, SlashCommand, type SlashCommandContext } from 'necord';

import { RequirePermissions } from '#/common/decorators/require-permissions.decorator.js';
import { RequirePermissionsGuard } from '#/common/guards/require-permissions.guard.js';

@Injectable()
export class UtilitiesCommands {
  public constructor(@Inject(Client) private readonly client: Client<true>) {}

  @SlashCommand({
    name: 'ping',
    description: 'Check bot latency',
  })
  @UseGuards(RequirePermissionsGuard)
  @RequirePermissions()
  public async ping(@Context() [interaction]: SlashCommandContext): Promise<void> {
    const latencyMs = Math.round(this.client.ws.ping);

    await interaction.reply({
      content: `Pong! ${String(latencyMs)}ms`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
