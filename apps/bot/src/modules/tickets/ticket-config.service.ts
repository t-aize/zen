import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '#/database/prisma.service.js';
import type { Prisma, TicketPanel } from '#/prisma/client.js';

const DISCORD_ID_MIN_LENGTH = 17;
const DISCORD_ID_MAX_LENGTH = 20;

@Injectable()
export class TicketConfigService {
  public constructor(private readonly prisma: PrismaService) {}

  public async createPanel(input: {
    guildId: string;
    name: string;
    description?: string | null;
    enabled?: boolean;
    channelId?: string | null;
    messageId?: string | null;
    categoryId?: string | null;
    logChannelId?: string | null;
    staffRoleIds?: string[];
    buttonLabel?: string;
    buttonEmoji?: string | null;
    channelNameFormat?: string;
  }): Promise<TicketPanel> {
    validateDiscordId(input.guildId, 'guildId');
    validateMaybeDiscordId(input.channelId, 'channelId');
    validateMaybeDiscordId(input.messageId, 'messageId');
    validateMaybeDiscordId(input.categoryId, 'categoryId');
    validateMaybeDiscordId(input.logChannelId, 'logChannelId');
    validateDiscordIds(input.staffRoleIds ?? [], 'staffRoleIds');

    const data: Prisma.TicketPanelCreateInput = {
      guild: {
        connect: {
          id: input.guildId,
        },
      },
      name: input.name,
      staffRoleIds: input.staffRoleIds ?? [],
    };

    if (input.description !== undefined) data.description = input.description;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.channelId !== undefined) data.channelId = input.channelId;
    if (input.messageId !== undefined) data.messageId = input.messageId;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.logChannelId !== undefined) data.logChannelId = input.logChannelId;
    if (input.buttonLabel !== undefined) data.buttonLabel = input.buttonLabel;
    if (input.buttonEmoji !== undefined) data.buttonEmoji = input.buttonEmoji;
    if (input.channelNameFormat !== undefined) data.channelNameFormat = input.channelNameFormat;

    return this.prisma.ticketPanel.create({
      data,
    });
  }

  public async updatePanel(
    panelId: string,
    input: {
      name?: string;
      description?: string | null;
      enabled?: boolean;
      channelId?: string | null;
      messageId?: string | null;
      categoryId?: string | null;
      logChannelId?: string | null;
      staffRoleIds?: string[];
      buttonLabel?: string;
      buttonEmoji?: string | null;
      channelNameFormat?: string;
    },
  ): Promise<TicketPanel> {
    validateMaybeDiscordId(input.channelId, 'channelId');
    validateMaybeDiscordId(input.messageId, 'messageId');
    validateMaybeDiscordId(input.categoryId, 'categoryId');
    validateMaybeDiscordId(input.logChannelId, 'logChannelId');

    if (input.staffRoleIds !== undefined) {
      validateDiscordIds(input.staffRoleIds, 'staffRoleIds');
    }

    const data: Prisma.TicketPanelUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.channelId !== undefined) data.channelId = input.channelId;
    if (input.messageId !== undefined) data.messageId = input.messageId;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.logChannelId !== undefined) data.logChannelId = input.logChannelId;
    if (input.staffRoleIds !== undefined) data.staffRoleIds = input.staffRoleIds;
    if (input.buttonLabel !== undefined) data.buttonLabel = input.buttonLabel;
    if (input.buttonEmoji !== undefined) data.buttonEmoji = input.buttonEmoji;
    if (input.channelNameFormat !== undefined) data.channelNameFormat = input.channelNameFormat;

    return this.prisma.ticketPanel.update({
      where: {
        id: panelId,
      },
      data,
    });
  }

  public async getPanelById(panelId: string): Promise<TicketPanel | null> {
    return this.prisma.ticketPanel.findFirst({
      where: {
        id: panelId,
        deletedAt: null,
      },
    });
  }

  public async getPanelByMessage(
    channelId: string,
    messageId: string,
  ): Promise<TicketPanel | null> {
    validateDiscordId(channelId, 'channelId');
    validateDiscordId(messageId, 'messageId');

    return this.prisma.ticketPanel.findFirst({
      where: {
        channelId,
        messageId,
        deletedAt: null,
      },
    });
  }

  public async listPanels(guildId: string): Promise<TicketPanel[]> {
    validateDiscordId(guildId, 'guildId');

    return this.prisma.ticketPanel.findMany({
      where: {
        guildId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  public async disablePanel(panelId: string): Promise<TicketPanel> {
    return this.prisma.ticketPanel.update({
      where: {
        id: panelId,
      },
      data: {
        enabled: false,
      },
    });
  }
}

function validateMaybeDiscordId(value: string | null | undefined, fieldName: string): void {
  if (value === null || value === undefined) {
    return;
  }

  validateDiscordId(value, fieldName);
}

function validateDiscordIds(values: string[], fieldName: string): void {
  for (const value of values) {
    validateDiscordId(value, fieldName);
  }
}

function validateDiscordId(value: string, fieldName: string): void {
  const hasValidLength =
    value.length >= DISCORD_ID_MIN_LENGTH && value.length <= DISCORD_ID_MAX_LENGTH;

  if (hasValidLength && /^\d+$/u.test(value)) {
    return;
  }

  throw new BadRequestException(`${fieldName} must be a Discord snowflake`);
}
