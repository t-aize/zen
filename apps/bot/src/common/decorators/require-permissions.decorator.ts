import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { PermissionResolvable } from 'discord.js';

export const REQUIRE_PERMISSIONS_KEY = 'zen:require-permissions';

export const RequirePermissions = (...permissions: PermissionResolvable[]): CustomDecorator =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
