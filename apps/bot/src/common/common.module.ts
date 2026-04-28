import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { DiscordExceptionFilter } from './filters/discord-exception.filter.js';
import { RequirePermissionsGuard } from './guards/require-permissions.guard.js';
import { LoggingInterceptor } from './interceptors/logging.interceptor.js';

@Global()
@Module({
  providers: [
    RequirePermissionsGuard,
    {
      provide: APP_FILTER,
      useClass: DiscordExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [RequirePermissionsGuard],
})
export class CommonModule {}
