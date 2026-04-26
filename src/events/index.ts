import type { Client, ClientEvents } from 'discord.js';

import { createLogger } from '../services/logger.js';
import { readyEvent } from './ready.js';
import type { AnyBotEvent, BotEvent, EventName } from './types.js';

const logger = createLogger('events');

const events = [readyEvent] as const satisfies readonly AnyBotEvent[];

function registerEvent<Name extends EventName>(client: Client, event: BotEvent<Name>): void {
  const listener = (...args: ClientEvents[Name]): void => {
    void (async () => {
      try {
        await event.execute(...args);
      } catch (error) {
        logger.error({ err: error, event: event.name }, 'Discord event handler failed');
      }
    })();
  };

  if (event.once === true) {
    client.once(event.name, listener);
    return;
  }

  client.on(event.name, listener);
}

export function registerEvents(client: Client): void {
  for (const event of events) {
    registerEvent(client, event);
  }

  logger.debug({ count: events.length }, 'Discord events registered');
}
