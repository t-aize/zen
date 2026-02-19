/**
 * Schema barrel — re-export every table so Drizzle can resolve
 * relations across the full schema from a single import.
 *
 * Add a new export here whenever you create a new table file.
 */
export * from "@/db/schema/guilds.js";
