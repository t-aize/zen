import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  BaseInteraction,
  GuildMember,
  PermissionsBitField,
  type PermissionResolvable,
} from 'discord.js';
import { NecordExecutionContext } from 'necord';

import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';

@Injectable()
export class RequirePermissionsGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<readonly PermissionResolvable[] | undefined>(
        REQUIRE_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const [interaction] = NecordExecutionContext.create(context).getContext<[unknown]>();

    if (!(interaction instanceof BaseInteraction) || !interaction.isChatInputCommand()) {
      return true;
    }

    const memberPermissions = this.getMemberPermissions(interaction.member);

    if (memberPermissions?.has(requiredPermissions) === true) {
      return true;
    }

    throw new ForbiddenException(
      'You do not have the required Discord permissions for this command.',
    );
  }

  private getMemberPermissions(
    member: GuildMember | { permissions?: unknown } | null,
  ): PermissionsBitField | null {
    if (member === null) {
      return null;
    }

    if (member instanceof GuildMember) {
      return member.permissions;
    }

    const permissions = member.permissions;

    if (typeof permissions === 'string') {
      return new PermissionsBitField(BigInt(permissions));
    }

    if (typeof permissions === 'number' && Number.isInteger(permissions)) {
      return new PermissionsBitField(BigInt(permissions));
    }

    if (typeof permissions === 'bigint') {
      return new PermissionsBitField(permissions);
    }

    return null;
  }
}
