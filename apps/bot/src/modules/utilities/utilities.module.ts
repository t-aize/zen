import { Module } from '@nestjs/common';

import { CommonModule } from '#/common/common.module.js';
import { GuildConfigModule } from '#/modules/guild-config/guild-config.module.js';
import { UtilitiesCommands } from './utilities.commands.js';

@Module({
  imports: [CommonModule, GuildConfigModule],
  providers: [UtilitiesCommands],
})
export class UtilitiesModule {}
