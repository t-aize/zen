import { defineConfig } from "drizzle-kit";

export default defineConfig({
	/**
	 * Schema location — drizzle-kit reads all table definitions from here
	 * to generate migrations and push changes to the database.
	 */
	/**
	 * Schema files listed explicitly — drizzle-kit runs in CJS and cannot
	 * resolve ESM `.js` extensions used in the barrel (`schema/index.ts`).
	 * Add every new table file here as well as in `src/db/schema/index.ts`.
	 */
	schema: ["./src/db/schema/guilds.ts"],

	/**
	 * Output directory for generated SQL migration files.
	 * Commit these files to version control — they are the source of truth
	 * for the database structure.
	 */
	out: "./drizzle",

	/** SQLite dialect via better-sqlite3. */
	dialect: "sqlite",

	dbCredentials: {
		/** Path to the SQLite database file. Created automatically if absent. */
		url: "./data/zen.db",
	},

	/**
	 * Print every SQL statement executed by drizzle-kit commands.
	 * Useful during development; safe to keep enabled.
	 */
	verbose: true,

	/**
	 * Enforce strict mode — drizzle-kit will error on ambiguous or
	 * potentially destructive operations instead of silently proceeding.
	 */
	strict: true,
});
