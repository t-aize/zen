import type { Awaitable, ClientEvents } from "discord.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("events");

/**
 * Shape of every event handler registered via `defineEvent`.
 *
 * @typeParam K - A key of `ClientEvents`, ensuring `execute` receives the
 *   exact argument tuple Discord.js emits for that event.
 */
export interface Event<K extends keyof ClientEvents> {
	/** The Discord.js client event name to listen on (e.g. `"ready"`, `"interactionCreate"`). */
	name: K;

	/**
	 * Whether to register the listener with `client.once` instead of `client.on`.
	 * Use `true` for one-shot events like `"ready"`.
	 * Defaults to `false`.
	 */
	once?: boolean;

	/** Handler invoked every time (or once) the event fires. */
	execute: (...args: ClientEvents[K]) => Awaitable<void>;
}

/**
 * Registered event handlers.
 * Populated by `defineEvent` — one entry per registered handler.
 */
export const events: Event<keyof ClientEvents>[] = [];

/**
 * Defines a typed event handler and immediately registers it in the central
 * events array. Simply importing an event file is enough to register it.
 *
 * Safety checks performed at registration time:
 * - `name` must be a non-empty string
 * - Duplicate `once` handlers on the same event name are warned about
 *
 * @example
 * defineEvent({
 *   name: "ready",
 *   once: true,
 *   execute: (client) => {
 *     console.log(`Logged in as ${client.user.tag}`);
 *   },
 * });
 */
export const defineEvent = <K extends keyof ClientEvents>(event: Event<K>): Event<K> => {
	if (!event.name || event.name.trim().length === 0) {
		throw new Error("defineEvent: event name must not be empty");
	}

	const duplicate = events.find((e) => e.name === event.name && e.once === event.once);
	if (duplicate) {
		log.warn(`defineEvent: duplicate handler registered for "${event.name}" (once: ${event.once ?? false})`);
	}

	events.push(event as unknown as Event<keyof ClientEvents>);
	log.debug(`Registered event "${event.name}" (once: ${event.once ?? false})`);

	return event;
};
