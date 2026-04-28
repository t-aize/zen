import { Module } from '@nestjs/common';

import { CommonModule } from '#/common/common.module.js';
import { UtilitiesCommands } from './utilities.commands.js';

@Module({
  imports: [CommonModule],
  providers: [UtilitiesCommands],
})
export class UtilitiesModule {}
