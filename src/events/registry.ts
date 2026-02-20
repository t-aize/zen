/**
 * Event registry — import every event handler here.
 *
 * Importing an event file triggers its `defineEvent` call, which pushes
 * the handler into the central `events` array. The client then binds all
 * registered handlers on startup.
 *
 * To add an event: create its file in the appropriate category folder
 * and add its import below.
 */

// Lifecycle — clientReady, invalidated
import "@/events/lifecycle/clientReady.js";
import "@/events/lifecycle/invalidated.js";

// Interaction — interactionCreate, autocomplete...
import "@/events/interaction/interactionCreate.js";

// Client — error, warn, debug, cacheSweep
import "@/events/client/error.js";
import "@/events/client/warn.js";
import "@/events/client/debug.js";
import "@/events/client/cacheSweep.js";

// Shard — disconnect, error, ready, reconnecting, resume
import "@/events/shard/shardDisconnect.js";
import "@/events/shard/shardError.js";
import "@/events/shard/shardReady.js";
import "@/events/shard/shardReconnecting.js";
import "@/events/shard/shardResume.js";

// Guild — permissions, join, leave, available
import "@/events/guild/applicationCommandPermissionsUpdate.js";
import "@/events/guild/guildCreate.js";
import "@/events/guild/guildDelete.js";
import "@/events/guild/guildAvailable.js";

// Member — join, leave, update, user update
import "@/events/member/guildMemberAdd.js";
import "@/events/member/guildMemberRemove.js";
import "@/events/member/guildMemberUpdate.js";
import "@/events/member/userUpdate.js";

// Channel — create, delete, update, pins, webhooks
import "@/events/channel/channelCreate.js";
import "@/events/channel/channelDelete.js";
import "@/events/channel/channelUpdate.js";
import "@/events/channel/channelPinsUpdate.js";
import "@/events/channel/webhooksUpdate.js";

// Role — create, delete, update
import "@/events/role/roleCreate.js";
import "@/events/role/roleDelete.js";
import "@/events/role/roleUpdate.js";

// Message — create, delete, bulk delete, update, reactions
import "@/events/message/messageCreate.js";
import "@/events/message/messageDelete.js";
import "@/events/message/messageDeleteBulk.js";
import "@/events/message/messageUpdate.js";
import "@/events/message/messageReactionAdd.js";
import "@/events/message/messageReactionRemove.js";
import "@/events/message/messageReactionRemoveAll.js";
import "@/events/message/messageReactionRemoveEmoji.js";

// Voice — state, effects, stage instances
import "@/events/voice/voiceStateUpdate.js";
import "@/events/voice/voiceChannelEffectSend.js";
import "@/events/voice/stageInstanceCreate.js";
import "@/events/voice/stageInstanceUpdate.js";
import "@/events/voice/stageInstanceDelete.js";
