import { Injectable } from '@nestjs/common';

import { PrismaService } from '#/database/prisma.service.js';

@Injectable()
export class GuildConfigService {
  public constructor(private readonly prisma: PrismaService) {}

  public async ensureGuild(guildId: string): Promise<void> {
    await this.prisma.guild.upsert({
      where: { id: guildId },
      create: {
        id: guildId,
      },
      update: {},
    });

    await this.prisma.guildConfig.upsert({
      where: { guildId },
      create: {
        guildId,
      },
      update: {},
    });
  }
}
