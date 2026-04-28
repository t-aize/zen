import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Context, On, type ContextOf } from 'necord';

@Injectable()
export class ClientDiagnosticsEvent {
  public constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext(ClientDiagnosticsEvent.name);
  }

  @On('debug')
  public onDebug(@Context() [message]: ContextOf<'debug'>): void {
    this.logger.debug({ message }, 'Discord client debug');
  }

  @On('warn')
  public onWarn(@Context() [message]: ContextOf<'warn'>): void {
    this.logger.warn({ message }, 'Discord client warning');
  }

  @On('error')
  public onError(@Context() [error]: ContextOf<'error'>): void {
    this.logger.error({ err: this.serializeError(error) }, 'Discord client error');
  }

  @On('shardError')
  public onShardError(@Context() [error, shardId]: ContextOf<'shardError'>): void {
    this.logger.error(
      {
        err: this.serializeError(error),
        shardId,
      },
      'Discord shard error',
    );
  }

  @On('shardDisconnect')
  public onShardDisconnect(@Context() [closeEvent, shardId]: ContextOf<'shardDisconnect'>): void {
    this.logger.warn(
      {
        shardId,
        code: closeEvent.code,
      },
      'Discord shard disconnected',
    );
  }

  @On('shardReconnecting')
  public onShardReconnecting(@Context() [shardId]: ContextOf<'shardReconnecting'>): void {
    this.logger.warn({ shardId }, 'Discord shard reconnecting');
  }

  @On('shardReady')
  public onShardReady(@Context() [shardId, unavailableGuilds]: ContextOf<'shardReady'>): void {
    this.logger.info(
      {
        shardId,
        unavailableGuildCount: unavailableGuilds?.size ?? 0,
      },
      'Discord shard ready',
    );
  }

  @On('shardResume')
  public onShardResume(@Context() [shardId, replayedEvents]: ContextOf<'shardResume'>): void {
    this.logger.info(
      {
        shardId,
        replayedEvents,
      },
      'Discord shard resumed',
    );
  }

  @On('invalidated')
  public onInvalidated(): void {
    this.logger.fatal('Discord session invalidated');
  }

  private serializeError(error: Error): Record<string, unknown> {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
}
