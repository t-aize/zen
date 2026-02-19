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
import "@/commands/config/auditlog.js";
import "@/commands/moderation/clear.js";
import "@/commands/moderation/kick.js";
import "@/commands/moderation/ban.js";
import "@/commands/moderation/unban.js";
import "@/commands/moderation/purge.js";
import "@/commands/moderation/mute.js";
import "@/commands/moderation/unmute.js";
import "@/commands/moderation/nickname.js";
import "@/commands/moderation/warn.js";
