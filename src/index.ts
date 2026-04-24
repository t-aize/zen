import 'dotenv/config';

import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction, ClientOptions, InteractionReplyOptions } from 'discord.js';
import pino from 'pino';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().min(1).default('info'),
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
});

const env = envSchema.parse(process.env);

const logger = pino({
  level: env.LOG_LEVEL,
  redact: ['DISCORD_TOKEN', 'token', '*.token', 'authorization', '*.authorization'],
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'HH:MM:ss',
          },
        },
      }
    : {}),
});

const clientOptions: ClientOptions = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution,
    GatewayIntentBits.GuildMessagePolls,
    GatewayIntentBits.DirectMessagePolls,
  ],
  partials: [
    Partials.User,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
    Partials.GuildScheduledEvent,
    Partials.ThreadMember,
    Partials.SoundboardSound,
    Partials.Poll,
    Partials.PollAnswer,
  ],
};

const client = new Client(clientOptions);

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Check the bot latency.'),
  new SlashCommandBuilder().setName('status').setDescription('Show the current bot status.'),
  new SlashCommandBuilder().setName('help').setDescription('Show the available starter commands.'),
].map((command) => command.toJSON());

async function registerApplicationCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const route =
    env.DISCORD_GUILD_ID === undefined
      ? Routes.applicationCommands(env.DISCORD_CLIENT_ID)
      : Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID);

  logger.info(
    {
      scope: env.DISCORD_GUILD_ID === undefined ? 'global' : 'guild',
      guildId: env.DISCORD_GUILD_ID,
      commandCount: commands.length,
    },
    'Registering application commands',
  );

  await rest.put(route, { body: commands });
}

function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return [
    days > 0 ? `${days}d` : undefined,
    hours > 0 ? `${hours}h` : undefined,
    minutes > 0 ? `${minutes}m` : undefined,
    `${seconds}s`,
  ]
    .filter((part): part is string => part !== undefined)
    .join(' ');
}

function replyOptions(content: string, ephemeral = true): InteractionReplyOptions {
  return {
    content,
    ephemeral,
  };
}

async function handleChatInputCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case 'ping': {
      const websocketLatency = client.ws.ping;
      const createdAt = interaction.createdTimestamp;
      await interaction.reply(replyOptions('Pinging...'));
      const response = await interaction.fetchReply();
      const roundTripLatency = response.createdTimestamp - createdAt;

      await interaction.editReply(
        `Pong. Gateway: ${websocketLatency}ms. Round trip: ${roundTripLatency}ms.`,
      );
      return;
    }

    case 'status': {
      const guildCount = client.guilds.cache.size;
      const userTag = client.user?.tag ?? 'unknown';
      const uptime = formatDuration(Math.floor(process.uptime()));

      await interaction.reply(
        replyOptions(`Zen is online as ${userTag}. Guilds: ${guildCount}. Uptime: ${uptime}.`),
      );
      return;
    }

    case 'help': {
      await interaction.reply(
        replyOptions(
          [
            'Available starter commands:',
            '`/ping` - check gateway and round-trip latency.',
            '`/status` - show runtime status.',
            '`/help` - show this command list.',
          ].join('\n'),
        ),
      );
      return;
    }

    default: {
      logger.warn({ commandName: interaction.commandName }, 'Unknown command received');
      await interaction.reply(replyOptions('Unknown command.'));
    }
  }
}

async function handleInteractionError(
  interaction: ChatInputCommandInteraction,
  error: unknown,
): Promise<void> {
  logger.error(
    {
      error,
      commandName: interaction.commandName,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
    },
    'Command failed',
  );

  const message = replyOptions('The command failed. Please try again later.');

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(message);
    return;
  }

  await interaction.reply(message);
}

client.once(Events.ClientReady, (readyClient) => {
  logger.info(
    {
      user: readyClient.user.tag,
      guildCount: readyClient.guilds.cache.size,
    },
    'Discord client is ready',
  );
});

client.on(Events.InteractionCreate, (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  void handleChatInputCommand(interaction).catch((error: unknown) =>
    handleInteractionError(interaction, error).catch((replyError: unknown) => {
      logger.error({ error: replyError }, 'Failed to report command error');
    }),
  );
});

client.on(Events.Error, (error) => {
  logger.error({ error }, 'Discord client error');
});

client.on(Events.Warn, (message) => {
  logger.warn({ message }, 'Discord client warning');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  shutdown('uncaughtException', 1);
});

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals | 'uncaughtException', exitCode = 0): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  client.destroy();
  process.exitCode = exitCode;
}

process.once('SIGINT', () => {
  shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  shutdown('SIGTERM');
});

async function main(): Promise<void> {
  await registerApplicationCommands();
  await client.login(env.DISCORD_TOKEN);
}

await main().catch((error: unknown) => {
  logger.fatal({ error }, 'Failed to start Zen');
  process.exitCode = 1;
});
