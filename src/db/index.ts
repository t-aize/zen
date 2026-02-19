import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("db");

/** Ensure the data directory exists before opening the database file. */
mkdirSync("data", { recursive: true });

/**
 * Raw better-sqlite3 connection.
 * The database file is created automatically if it does not exist.
 * WAL mode is enabled for better read/write concurrency.
 */
const sqlite = new Database("data/zen.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

log.debug("SQLite connection established (WAL mode)");

/**
 * Drizzle ORM instance — the single entry point for all database operations.
 * Import `db` anywhere in the codebase to run queries.
 *
 * The full `schema` is passed so Drizzle can infer relation types and
 * provide complete TypeScript autocompletion on queries.
 *
 * @example
 * import { db } from "@/db/index.js";
 * const guilds = await db.select().from(schema.guilds);
 */
export const db = drizzle(sqlite, { schema, logger: false });
