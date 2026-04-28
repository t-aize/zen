import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '#/database/prisma.service.js';
import {
  Prisma,
  TicketEventType,
  TicketStatus,
  type Ticket,
  type TicketParticipant,
} from '#/prisma/client.js';

const DISCORD_ID_MIN_LENGTH = 17;
const DISCORD_ID_MAX_LENGTH = 20;
const OPEN_TICKET_NUMBER_RETRIES = 1;
const PRISMA_UNIQUE_CONSTRAINT_ERROR = 'P2002';
const PRISMA_TRANSACTION_CONFLICT_ERROR = 'P2034';
const MIN_TRANSCRIPT_MESSAGE_COUNT = 0;
const FIRST_TICKET_NUMBER = 1;
const TICKET_NUMBER_INCREMENT = 1;

@Injectable()
export class TicketService {
  public constructor(private readonly prisma: PrismaService) {}

  public async openTicket(input: {
    guildId: string;
    panelId: string;
    channelId: string;
    creatorId: string;
  }): Promise<Ticket> {
    validateDiscordId(input.guildId, 'guildId');
    validateDiscordId(input.channelId, 'channelId');
    validateDiscordId(input.creatorId, 'creatorId');

    for (let attempt = 0; attempt <= OPEN_TICKET_NUMBER_RETRIES; attempt += 1) {
      try {
        return await this.createOpenTicket(input);
      } catch (error) {
        if (
          attempt < OPEN_TICKET_NUMBER_RETRIES &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === PRISMA_UNIQUE_CONSTRAINT_ERROR ||
            error.code === PRISMA_TRANSACTION_CONFLICT_ERROR)
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException('Could not allocate a ticket number');
  }

  public async closeTicket(input: {
    ticketId: string;
    actorId: string;
    reason?: string | null;
  }): Promise<Ticket> {
    validateDiscordId(input.actorId, 'actorId');

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: {
          id: input.ticketId,
          deletedAt: null,
        },
      });

      if (ticket === null) {
        throw new NotFoundException('Ticket not found');
      }

      if (ticket.status === TicketStatus.CLOSED) {
        throw new ConflictException('Ticket is already closed');
      }

      const now = new Date();
      const updatedTicket = await tx.ticket.update({
        where: {
          id: input.ticketId,
        },
        data: {
          status: TicketStatus.CLOSED,
          closedById: input.actorId,
          closedAt: now,
          closeReason: input.reason ?? null,
        },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: input.ticketId,
          type: TicketEventType.CLOSED,
          actorId: input.actorId,
          reason: input.reason ?? null,
        },
      });

      return updatedTicket;
    });
  }

  public async reopenTicket(input: {
    ticketId: string;
    actorId: string;
    reason?: string | null;
  }): Promise<Ticket> {
    validateDiscordId(input.actorId, 'actorId');

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: {
          id: input.ticketId,
          deletedAt: null,
        },
      });

      if (ticket === null) {
        throw new NotFoundException('Ticket not found');
      }

      if (ticket.status === TicketStatus.OPEN) {
        throw new ConflictException('Ticket is already open');
      }

      const existingOpenTicket = await tx.ticket.findFirst({
        where: {
          panelId: ticket.panelId,
          creatorId: ticket.creatorId,
          status: TicketStatus.OPEN,
          deletedAt: null,
          id: {
            not: ticket.id,
          },
        },
      });

      if (existingOpenTicket !== null) {
        throw new ConflictException('User already has an open ticket for this panel');
      }

      const updatedTicket = await tx.ticket.update({
        where: {
          id: input.ticketId,
        },
        data: {
          status: TicketStatus.OPEN,
          closedById: null,
          closedAt: null,
          closeReason: null,
        },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: input.ticketId,
          type: TicketEventType.REOPENED,
          actorId: input.actorId,
          reason: input.reason ?? null,
        },
      });

      return updatedTicket;
    });
  }

  public async claimTicket(input: { ticketId: string; staffUserId: string }): Promise<Ticket> {
    validateDiscordId(input.staffUserId, 'staffUserId');

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: {
          id: input.ticketId,
          deletedAt: null,
        },
      });

      if (ticket === null) {
        throw new NotFoundException('Ticket not found');
      }

      if (ticket.status === TicketStatus.CLOSED) {
        throw new ConflictException('Ticket is closed');
      }

      if (ticket.claimedById !== null) {
        throw new ConflictException('Ticket is already claimed');
      }

      const updatedTicket = await tx.ticket.update({
        where: {
          id: input.ticketId,
        },
        data: {
          claimedById: input.staffUserId,
          claimedAt: new Date(),
        },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: input.ticketId,
          type: TicketEventType.CLAIMED,
          actorId: input.staffUserId,
          targetUserId: input.staffUserId,
        },
      });

      return updatedTicket;
    });
  }

  public async unclaimTicket(input: { ticketId: string; actorId: string }): Promise<Ticket> {
    validateDiscordId(input.actorId, 'actorId');

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: {
          id: input.ticketId,
          deletedAt: null,
        },
      });

      if (ticket === null) {
        throw new NotFoundException('Ticket not found');
      }

      if (ticket.claimedById === null) {
        throw new ConflictException('Ticket is not claimed');
      }

      const claimedById = ticket.claimedById;
      const updatedTicket = await tx.ticket.update({
        where: {
          id: input.ticketId,
        },
        data: {
          claimedById: null,
          claimedAt: null,
        },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: input.ticketId,
          type: TicketEventType.UNCLAIMED,
          actorId: input.actorId,
          targetUserId: claimedById,
        },
      });

      return updatedTicket;
    });
  }

  public async addParticipant(input: {
    ticketId: string;
    userId: string;
    addedById?: string | null;
  }): Promise<TicketParticipant> {
    validateDiscordId(input.userId, 'userId');
    validateMaybeDiscordId(input.addedById, 'addedById');

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: {
          id: input.ticketId,
          deletedAt: null,
        },
      });

      if (ticket === null) {
        throw new NotFoundException('Ticket not found');
      }

      const existingParticipant = await tx.ticketParticipant.findUnique({
        where: {
          ticketId_userId: {
            ticketId: input.ticketId,
            userId: input.userId,
          },
        },
      });

      if (existingParticipant?.removedAt === null) {
        throw new ConflictException('User is already a ticket participant');
      }

      const participant =
        existingParticipant === null
          ? await tx.ticketParticipant.create({
              data: {
                ticketId: input.ticketId,
                userId: input.userId,
                addedById: input.addedById ?? null,
              },
            })
          : await tx.ticketParticipant.update({
              where: {
                id: existingParticipant.id,
              },
              data: {
                addedById: input.addedById ?? null,
                addedAt: new Date(),
                removedAt: null,
              },
            });

      await tx.ticketEvent.create({
        data: {
          ticketId: input.ticketId,
          type: TicketEventType.PARTICIPANT_ADDED,
          actorId: input.addedById ?? null,
          targetUserId: input.userId,
        },
      });

      return participant;
    });
  }

  public async removeParticipant(input: {
    ticketId: string;
    userId: string;
    removedById?: string | null;
  }): Promise<TicketParticipant> {
    validateDiscordId(input.userId, 'userId');
    validateMaybeDiscordId(input.removedById, 'removedById');

    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.ticketParticipant.findUnique({
        where: {
          ticketId_userId: {
            ticketId: input.ticketId,
            userId: input.userId,
          },
        },
        include: {
          ticket: true,
        },
      });

      if (participant === null || participant.ticket.deletedAt !== null) {
        throw new NotFoundException('Ticket participant not found');
      }

      if (participant.removedAt !== null) {
        throw new ConflictException('User is not an active ticket participant');
      }

      const updatedParticipant = await tx.ticketParticipant.update({
        where: {
          id: participant.id,
        },
        data: {
          removedAt: new Date(),
        },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: input.ticketId,
          type: TicketEventType.PARTICIPANT_REMOVED,
          actorId: input.removedById ?? null,
          targetUserId: input.userId,
        },
      });

      return updatedParticipant;
    });
  }

  public async attachTranscript(input: {
    ticketId: string;
    generatedById: string;
    url?: string | null;
    path?: string | null;
    key?: string | null;
    sha256?: string | null;
    messageCount?: number | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<Ticket> {
    validateDiscordId(input.generatedById, 'generatedById');

    if (input.messageCount !== null && input.messageCount !== undefined) {
      validateTranscriptMessageCount(input.messageCount);
    }

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: {
          id: input.ticketId,
          deletedAt: null,
        },
      });

      if (ticket === null) {
        throw new NotFoundException('Ticket not found');
      }

      const generatedAt = new Date();
      const data: Prisma.TicketUpdateInput = {
        transcriptGeneratedById: input.generatedById,
        transcriptGeneratedAt: generatedAt,
      };

      if (input.url !== undefined) data.transcriptUrl = input.url;
      if (input.path !== undefined) data.transcriptPath = input.path;
      if (input.key !== undefined) data.transcriptKey = input.key;
      if (input.sha256 !== undefined) data.transcriptSha256 = input.sha256;
      if (input.messageCount !== undefined) data.transcriptMessageCount = input.messageCount;

      const updatedTicket = await tx.ticket.update({
        where: {
          id: input.ticketId,
        },
        data,
      });

      const eventData: Prisma.TicketEventUncheckedCreateInput = {
        ticketId: input.ticketId,
        type: TicketEventType.TRANSCRIPT_CREATED,
        actorId: input.generatedById,
      };

      if (input.metadata !== undefined) eventData.metadata = input.metadata;

      await tx.ticketEvent.create({
        data: eventData,
      });

      return updatedTicket;
    });
  }

  private async createOpenTicket(input: {
    guildId: string;
    panelId: string;
    channelId: string;
    creatorId: string;
  }): Promise<Ticket> {
    return this.prisma.$transaction(
      async (tx) => {
        const panel = await tx.ticketPanel.findFirst({
          where: {
            id: input.panelId,
            guildId: input.guildId,
            deletedAt: null,
          },
        });

        if (panel === null) {
          throw new NotFoundException('Ticket panel not found');
        }

        if (!panel.enabled) {
          throw new ConflictException('Ticket panel is disabled');
        }

        const existingOpenTicket = await tx.ticket.findFirst({
          where: {
            panelId: input.panelId,
            creatorId: input.creatorId,
            status: TicketStatus.OPEN,
            deletedAt: null,
          },
        });

        if (existingOpenTicket !== null) {
          throw new ConflictException('User already has an open ticket for this panel');
        }

        const lastTicket = await tx.ticket.findFirst({
          where: {
            guildId: input.guildId,
          },
          orderBy: {
            number: 'desc',
          },
          select: {
            number: true,
          },
        });
        const nextNumber =
          lastTicket === null ? FIRST_TICKET_NUMBER : lastTicket.number + TICKET_NUMBER_INCREMENT;

        return tx.ticket.create({
          data: {
            guildId: input.guildId,
            panelId: input.panelId,
            number: nextNumber,
            channelId: input.channelId,
            creatorId: input.creatorId,
            participants: {
              create: {
                userId: input.creatorId,
                addedById: input.creatorId,
              },
            },
            events: {
              create: {
                type: TicketEventType.CREATED,
                actorId: input.creatorId,
                targetUserId: input.creatorId,
              },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}

function validateMaybeDiscordId(value: string | null | undefined, fieldName: string): void {
  if (value === null || value === undefined) {
    return;
  }

  validateDiscordId(value, fieldName);
}

function validateDiscordId(value: string, fieldName: string): void {
  const hasValidLength =
    value.length >= DISCORD_ID_MIN_LENGTH && value.length <= DISCORD_ID_MAX_LENGTH;

  if (hasValidLength && /^\d+$/u.test(value)) {
    return;
  }

  throw new BadRequestException(`${fieldName} must be a Discord snowflake`);
}

function validateTranscriptMessageCount(value: number): void {
  if (Number.isInteger(value) && value >= MIN_TRANSCRIPT_MESSAGE_COUNT) {
    return;
  }

  throw new BadRequestException('messageCount must be a non-negative integer');
}
