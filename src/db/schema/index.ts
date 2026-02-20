/**
 * Schema barrel — re-export every table so Drizzle can resolve
 * relations across the full schema from a single import.
 *
 * Add a new export here whenever you create a new table file.
 */

export * from "@/db/schema/auditLogConfig.js";
export * from "@/db/schema/giveaways.js";
export * from "@/db/schema/guilds.js";
export * from "@/db/schema/notes.js";
export * from "@/db/schema/tickets.js";
export * from "@/db/schema/warnings.js";
