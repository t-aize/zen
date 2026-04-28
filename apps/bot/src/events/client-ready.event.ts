import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Context, Once, type ContextOf } from 'necord';

@Injectable()
export class ClientReadyEvent {
  public constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext(ClientReadyEvent.name);
  }

  @Once('clientReady')
  public onClientReady(@Context() [client]: ContextOf<'clientReady'>): void {
    this.logger.info(
      {
        userId: client.user.id,
        username: client.user.username,
        guildCount: client.guilds.cache.size,
      },
      'Discord client ready',
    );
  }
}
