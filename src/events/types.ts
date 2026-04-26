import type { Awaitable, ClientEvents } from 'discord.js';

export type EventName = keyof ClientEvents;

export interface BotEvent<TName extends EventName> {
  name: TName;
  once?: boolean;

  execute(...args: ClientEvents[TName]): Awaitable<void>;
}

export type AnyBotEvent = {
  [TName in EventName]: BotEvent<TName>;
}[EventName];

export function defineEvent<TName extends EventName>(
  name: TName,
  execute: (...args: ClientEvents[TName]) => Awaitable<void>,
  once = false,
): BotEvent<TName> {
  return { name, execute, once };
}
