import type { Client, ClientEvents } from 'discord.js';

import { clientDebugEvent } from './client/debug.js';
import { clientErrorEvent } from './client/error.js';
import { clientReadyEvent } from './client/clientReady.js';
import { clientWarnEvent } from './client/warn.js';
import { guildAvailableEvent } from './guild/guildAvailable.js';
import { interactionCreateEvent } from './interaction/interactionCreate.js';
import { shardDisconnectEvent } from './shard/shardDisconnect.js';
import { shardErrorEvent } from './shard/shardError.js';
import { shardReadyEvent } from './shard/shardReady.js';
import { shardReconnectingEvent } from './shard/shardReconnecting.js';
import { shardResumeEvent } from './shard/shardResume.js';
import type { AnyBotEvent, BotEvent, EventName } from './types.js';

const events = [
  clientReadyEvent,
  clientDebugEvent,
  clientErrorEvent,
  clientWarnEvent,
  guildAvailableEvent,
  interactionCreateEvent,
  shardDisconnectEvent,
  shardErrorEvent,
  shardReadyEvent,
  shardReconnectingEvent,
  shardResumeEvent,
] as const satisfies readonly AnyBotEvent[];

function registerEvent<Name extends EventName>(client: Client, event: BotEvent<Name>): void {
  if (event.once === true) {
    client.once(event.name, (...args) => void event.execute(...args));
    return;
  }

  client.on(event.name, (...args) => void event.execute(...args));
}

export function registerEvents(client: Client): void {
  for (const event of events) {
    registerEvent(client, event as BotEvent<keyof ClientEvents>);
  }
}
