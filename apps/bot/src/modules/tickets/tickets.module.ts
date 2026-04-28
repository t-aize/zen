import { Module } from '@nestjs/common';

import { TicketConfigService } from './ticket-config.service.js';
import { TicketService } from './ticket.service.js';

@Module({
  providers: [TicketConfigService, TicketService],
  exports: [TicketConfigService, TicketService],
})
export class TicketsModule {}
