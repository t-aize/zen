import { Module } from '@nestjs/common';

import { GuildConfigService } from './guild-config.service.js';

@Module({
  providers: [GuildConfigService],
  exports: [GuildConfigService],
})
export class GuildConfigModule {}
