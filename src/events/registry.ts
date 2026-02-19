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

// Guild — permissions, member events...
import "@/events/guild/applicationCommandPermissionsUpdate.js";

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

// Voice — state, effects, stage instances
import "@/events/voice/voiceStateUpdate.js";
import "@/events/voice/voiceChannelEffectSend.js";
import "@/events/voice/stageInstanceCreate.js";
import "@/events/voice/stageInstanceUpdate.js";
import "@/events/voice/stageInstanceDelete.js";
