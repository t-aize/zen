import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { GatewayIntentBits } from 'discord.js';
import { LoggerModule } from 'nestjs-pino';
import { NecordModule, type NecordModuleOptions } from 'necord';

import { CommonModule } from './common/common.module.js';
import type { Env } from './config/env.schema.js';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './database/prisma.module.js';
import { ModerationModule } from './modules/moderation/moderation.module.js';
import { UtilitiesModule } from './modules/utilities/utilities.module.js';

type EnvConfigService = ConfigService<Env, true>;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', 'apps/bot/.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: EnvConfigService) => {
        const nodeEnv = config.getOrThrow<Env['NODE_ENV']>('NODE_ENV');

        return {
          pinoHttp: {
            level: config.getOrThrow<Env['LOG_LEVEL']>('LOG_LEVEL'),
            ...(nodeEnv === 'prod'
              ? {}
              : {
                  transport: {
                    target: 'pino-pretty',
                    options: {
                      colorize: true,
                      singleLine: true,
                    },
                  },
                }),
          },
        };
      },
    }),
    NecordModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: EnvConfigService): NecordModuleOptions => {
        const developmentGuildId = config.get<Env['DISCORD_DEV_GUILD_ID']>('DISCORD_DEV_GUILD_ID');

        return {
          token: config.getOrThrow<Env['DISCORD_TOKEN']>('DISCORD_TOKEN'),
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildModeration,
          ],
          ...(developmentGuildId ? { development: [developmentGuildId] } : {}),
        };
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    ModerationModule,
    UtilitiesModule,
  ],
})
export class AppModule {}
