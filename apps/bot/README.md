# Zen Bot

NestJS + Necord Discord bot for Zen.

## Prerequisites

- Node.js 22 LTS
- pnpm
- PostgreSQL
- Discord application with a bot token

## Development

Copy the example environment file and fill in the Discord and database values:

```bash
cp apps/bot/.env.example apps/bot/.env
```

Generate Prisma, run the initial migration, then start the bot:

```bash
pnpm --filter bot exec prisma generate
pnpm --filter bot exec prisma migrate dev --name init
pnpm --filter bot dev
```

## Scripts

```bash
pnpm --filter bot dev
pnpm --filter bot build
pnpm --filter bot start
pnpm --filter bot typecheck
pnpm --filter bot lint
pnpm --filter bot test
```
