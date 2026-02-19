/**
 * Command registry — import every command here.
 *
 * Importing a command file is enough to register it: each file calls
 * `defineCommand` at the module level, which immediately adds the command
 * to the central collection.
 *
 * To add a command: create its file and add its import below.
 */
import "@/commands/utility/ping.js";
