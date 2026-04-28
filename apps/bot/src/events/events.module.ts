import { Module } from '@nestjs/common';

import { GuildConfigModule } from '#/modules/guild-config/guild-config.module.js';
import { ClientDiagnosticsEvent } from './client-diagnostics.event.js';
import { ClientReadyEvent } from './client-ready.event.js';
import { GuildCreateEvent } from './guild-create.event.js';

@Module({
  imports: [GuildConfigModule],
  providers: [ClientDiagnosticsEvent, ClientReadyEvent, GuildCreateEvent],
})
export class EventsModule {}
