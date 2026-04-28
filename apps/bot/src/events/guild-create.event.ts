import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Context, On, type ContextOf } from 'necord';

import { GuildConfigService } from '#/modules/guild-config/guild-config.service.js';

@Injectable()
export class GuildCreateEvent {
  public constructor(
    private readonly guildConfigService: GuildConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GuildCreateEvent.name);
  }

  @On('guildCreate')
  public async onGuildCreate(@Context() [guild]: ContextOf<'guildCreate'>): Promise<void> {
    await this.guildConfigService.ensureGuild(guild.id);

    this.logger.info(
      {
        guildId: guild.id,
        guildName: guild.name,
      },
      'Guild configuration initialized',
    );
  }
}
