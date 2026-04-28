import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { BaseInteraction } from 'discord.js';
import { PinoLogger } from 'nestjs-pino';
import { NecordExecutionContext } from 'necord';
import { finalize, Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  public constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const [interaction] = NecordExecutionContext.create(context).getContext<[unknown]>();
    let failed = false;

    return next.handle().pipe(
      tap({
        error: () => {
          failed = true;
        },
      }),
      finalize(() => {
        if (!(interaction instanceof BaseInteraction) || !interaction.isCommand()) {
          return;
        }

        this.logger.info(
          {
            commandName: interaction.commandName,
            guildId: interaction.guildId,
            userId: interaction.user.id,
            latencyMs: Date.now() - startedAt,
            failed,
          },
          'Discord command invoked',
        );
      }),
    );
  }
}
