import { Module } from '@nestjs/common';

import { ClientDiagnosticsEvent } from './client-diagnostics.event.js';
import { ClientReadyEvent } from './client-ready.event.js';

@Module({
  providers: [ClientDiagnosticsEvent, ClientReadyEvent],
})
export class EventsModule {}
