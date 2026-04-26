import type { ClientEvents } from 'discord.js';

export type EventName = keyof ClientEvents;
export type EventResult = Promise<void> | void;

export interface BotEvent<Name extends EventName = EventName> {
  name: Name;
  once?: boolean;
  execute(...args: ClientEvents[Name]): EventResult;
}

export type AnyBotEvent = {
  [Name in EventName]: BotEvent<Name>;
}[EventName];
