import type { Client, ClientEvents } from 'discord.js';

import { createLogger } from '../services/logger.js';
import { clientErrorEvent } from './client-error.js';
import { clientWarnEvent } from './client-warn.js';
import { readyEvent } from './ready.js';
import { shardDisconnectEvent } from './shard-disconnect.js';
import { shardErrorEvent } from './shard-error.js';
import { shardReadyEvent } from './shard-ready.js';
import { shardReconnectingEvent } from './shard-reconnecting.js';
import { shardResumeEvent } from './shard-resume.js';
import type { AnyBotEvent, BotEvent, EventName } from './types.js';

const logger = createLogger('events');

const events = [
  readyEvent,
  clientErrorEvent,
  clientWarnEvent,
  shardDisconnectEvent,
  shardErrorEvent,
  shardReadyEvent,
  shardReconnectingEvent,
  shardResumeEvent,
] as const satisfies readonly AnyBotEvent[];

const registeredEventsByClient = new WeakMap<Client, Set<EventName>>();

function getRegisteredEvents(client: Client): Set<EventName> {
  const registeredEvents = registeredEventsByClient.get(client);

  if (registeredEvents !== undefined) {
    return registeredEvents;
  }

  const nextRegisteredEvents = new Set<EventName>();
  registeredEventsByClient.set(client, nextRegisteredEvents);

  return nextRegisteredEvents;
}

async function executeEvent<Name extends EventName>(
  event: BotEvent<Name>,
  args: ClientEvents[Name],
): Promise<void> {
  try {
    await event.execute(...args);
  } catch (error) {
    logger.error({ err: error, event: event.name }, 'Discord event handler failed');
  }
}

function registerEvent<Name extends EventName>(client: Client, event: BotEvent<Name>): void {
  const registeredEvents = getRegisteredEvents(client);

  if (registeredEvents.has(event.name)) {
    logger.warn({ event: event.name }, 'Discord event already registered');
    return;
  }

  const listener = (...args: ClientEvents[Name]): void => {
    void executeEvent(event, args);
  };

  if (event.once === true) {
    client.once(event.name, listener);
    registeredEvents.add(event.name);
    return;
  }

  client.on(event.name, listener);
  registeredEvents.add(event.name);
}

export function registerEvents(client: Client): void {
  for (const event of events) {
    registerEvent(client, event);
  }

  logger.debug(
    {
      count: events.length,
      events: events.map((event) => event.name),
    },
    'Discord events registered',
  );
}
