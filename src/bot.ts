import {
  ActivityType,
  Client,
  GatewayIntentBits,
  Options,
  Partials,
  PresenceUpdateStatus,
} from 'discord.js';

import { env } from './config/env.js';
import { registerEvents } from './events/index.js';

export async function startBot(): Promise<Client> {
  const client = new Client({
    closeTimeout: 5_000,
    enforceNonce: false,
    failIfNotExists: false,
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildExpressions,
      GatewayIntentBits.GuildIntegrations,
      GatewayIntentBits.GuildWebhooks,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildScheduledEvents,
      GatewayIntentBits.AutoModerationConfiguration,
      GatewayIntentBits.AutoModerationExecution,
      GatewayIntentBits.GuildMessagePolls,
      GatewayIntentBits.DirectMessagePolls,
    ],
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 100,
      ReactionManager: 50,
    }),
    partials: [
      Partials.Channel,
      Partials.GuildMember,
      Partials.GuildScheduledEvent,
      Partials.Message,
      Partials.Poll,
      Partials.PollAnswer,
      Partials.Reaction,
      Partials.ThreadMember,
      Partials.User,
      Partials.SoundboardSound,
    ],
    presence: {
      activities: [
        {
          name: 'over servers',
          type: ActivityType.Watching,
        },
      ],
      status: PresenceUpdateStatus.Online,
    },
    rest: {
      invalidRequestWarningInterval: 100,
      retries: 3,
      timeout: 15_000,
    },
    shards: 'auto',
    sweepers: {
      ...Options.DefaultSweeperSettings,
      invites: {
        interval: 3_600,
        lifetime: 3_600,
      },
      messages: {
        interval: 300,
        lifetime: 1_800,
      },
    },
    waitGuildTimeout: 15_000,
    ws: {
      large_threshold: 50,
      version: 10,
    },
  });

  registerEvents(client);

  await client.login(env.DISCORD_TOKEN);

  return client;
}
