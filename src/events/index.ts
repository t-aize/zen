import { logger } from "@zen/utils/logger";
import type { Client, ClientEvents } from "discord.js";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Represents a fully-defined event listener.
 *
 * Each event consists of:
 * - `name`     — The Discord.js client event name (e.g. `"clientReady"`, `"messageCreate"`).
 * - `once`     — Whether the listener fires only once or on every emission.
 * - `execute`  — The async function invoked when the event fires.
 *
 * @typeParam E - A key of `ClientEvents` that determines the argument types
 *   passed to the `execute` handler. This ensures full type safety between
 *   the event name and the callback signature.
 *
 * @example
 * ```ts
 * import { defineEvent } from "@zen/events";
 *
 * export const readyEvent = defineEvent({
 *   name: "clientReady",
 *   once: true,
 *   async execute(client) {
 *     console.log(`Logged in as ${client.user.tag}`);
 *   },
 * });
 * ```
 */
export interface Event<E extends keyof ClientEvents = keyof ClientEvents> {
	/** The Discord.js client event name. */
	readonly name: E;

	/** Whether the listener fires on every emission or only once. */
	readonly once?: boolean;

	/**
	 * Executes the event logic.
	 *
	 * @param args - The arguments emitted by the Discord.js client for this event.
	 * @returns A promise that resolves when execution completes.
	 *
	 * @throws If the handler fails, the error should be caught by a
	 * top-level wrapper. Unhandled rejections are logged and reported.
	 */
	readonly execute: (...args: ClientEvents[E]) => Promise<void>;
}

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Internal event registry populated by {@link defineEvent}.
 * Each entry is a frozen event bound to the client at load time.
 */
const registry: Readonly<Event>[] = [];

// ─── defineEvent ─────────────────────────────────────────────────────────────

/**
 * Validates and registers an event listener.
 *
 * Performs the following validations:
 * 1. Event name is a non-empty string.
 * 2. Execute handler is a function.
 *
 * @typeParam E - A key of `ClientEvents` for type-safe event arguments.
 * @param event - The event definition to register.
 * @returns The registered event (frozen to prevent mutation).
 *
 * @throws {Error} If any validation rule is violated.
 *
 * @example
 * ```ts
 * export const messageCreateEvent = defineEvent({
 *   name: "messageCreate",
 *   async execute(message) {
 *     if (message.author.bot) return;
 *     // ... handle message
 *   },
 * });
 * ```
 */
export const defineEvent = <E extends keyof ClientEvents>(event: Event<E>): Readonly<Event<E>> => {
	const { name, execute } = event;

	if (typeof name !== "string" || name.length === 0) {
		throw new Error("Event name must be a non-empty string.");
	}

	if (typeof execute !== "function") {
		throw new Error(`Event "${name}" execute handler must be a function.`);
	}

	const frozen = Object.freeze(event);
	registry.push(frozen as unknown as Readonly<Event>);

	logger.debug({ event: name, once: event.once ?? false }, "Event registered");

	return frozen;
};

// ─── loadEvents ──────────────────────────────────────────────────────────────

/**
 * Dynamically imports every event module, then binds all registered
 * listeners to the provided client.
 *
 * Each module calls {@link defineEvent} at the top level, which
 * populates the internal registry. Using dynamic `import()` guarantees
 * that `defineEvent` is fully initialised before any event tries
 * to call it — no circular-init issues.
 *
 * **Must be called once at startup**, before the client logs in.
 */
export const loadEvents = async (client: Client): Promise<void> => {
	await import("@zen/events/client/ready");
	await import("@zen/events/client/interactionCreate");
	await import("@zen/events/client/channelCreate");

	for (const event of registry) {
		if (event.once) {
			client.once(event.name, (...args: unknown[]) =>
				(event.execute as (...a: unknown[]) => Promise<void>)(...args),
			);
		} else {
			client.on(event.name, (...args: unknown[]) =>
				(event.execute as (...a: unknown[]) => Promise<void>)(...args),
			);
		}
	}

	logger.info({ events: registry.length }, "Event listeners loaded and bound");
};
