<div align="center">

# 🧘 Zen

### A clean, modular Discord bot built in TypeScript.

**Zen** is an open-source Discord bot focused on moderation, utilities, tickets, automations, and server management.

For now, Zen is intentionally built as a **single-package project** with a simple `src/` architecture.  
No workspace, no dashboard, no API service, no worker, no shared packages.

The goal is to build a solid Discord bot first, then only move toward a larger monorepo if the project actually needs
it.

![Version](https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-Apache%202.0-green?style=for-the-badge)
![Open Source](https://img.shields.io/badge/open--source-yes-success?style=for-the-badge)
![Self Hostable](https://img.shields.io/badge/self--hostable-yes-purple?style=for-the-badge)

</div>

---

## Table of Contents

- [Why Zen Exists](#why-zen-exists)
- [What Zen Is](#what-zen-is)
- [Current Scope](#current-scope)
- [Core Capabilities](#core-capabilities)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Command System](#command-system)
- [Event System](#event-system)
- [Module System](#module-system)
- [Configuration Model](#configuration-model)
- [Data & Persistence](#data--persistence)
- [Security, Privacy & Reliability](#security-privacy--reliability)
- [Tech Stack](#tech-stack)
- [Development Setup](#development-setup)
- [Scripts](#scripts)
- [Roadmap](#roadmap)
- [Future Monorepo Direction](#future-monorepo-direction)
- [Contributing](#contributing)
- [Project Goals](#project-goals)
- [Non-Goals](#non-goals)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## Why Zen Exists

Discord communities often stack multiple bots to handle moderation, tickets, utilities, anti-raid protection, role
menus, logging, reminders, and automations.

That creates recurring problems:

- fragmented configuration
- inconsistent permissions
- duplicated features
- poor visibility for moderators
- unclear audit logs
- premium-gated basic features
- unnecessary dependency on third-party bots

**Zen** exists to provide a cleaner alternative: one maintainable Discord bot that can grow module by module.

The goal is not to create a bloated mega-bot immediately.  
The goal is to build a serious, self-hostable Discord bot with a clean internal structure.

---

## What Zen Is

Zen is a TypeScript Discord bot designed to be:

- **open-source**
- **self-hostable**
- **modular**
- **maintainable**
- **permission-aware**
- **privacy-conscious**
- **simple to run locally**
- **ready to evolve without becoming spaghetti code**

Zen starts as a single runtime: the Discord bot.

Later, the project may evolve toward a dashboard, API, workers, or a full monorepo.  
But those are not part of the current architecture.

---

## Current Scope

The current version of Zen focuses on a **simple single-package codebase**.

### Included for now

- Discord bot runtime
- slash command system
- event handlers
- internal module organization
- environment configuration
- logging
- basic permission helpers
- moderation foundation
- utility commands
- optional database layer when persistence becomes necessary

### Not included yet

- web dashboard
- API backend
- background worker
- pnpm workspace
- Turbo monorepo
- shared packages
- dedicated music service
- complex Docker production infrastructure
- public plugin marketplace

This is intentional.

A project should not start with five applications if the first useful product is one Discord bot.

---

## Core Capabilities

Zen is designed to grow progressively.

### 🛡️ Moderation

Planned moderation features:

- ban
- kick
- timeout
- unban
- warnings
- moderation cases
- mod logs
- reason tracking
- permission-safe moderation actions

### 🚨 Protection & Anti-Abuse

Planned protection features:

- anti-spam
- anti-link filtering
- anti-invite filtering
- mention spam detection
- basic anti-raid rules
- configurable thresholds
- safe emergency lockdown commands

### 🎫 Tickets

Planned ticket features:

- ticket creation buttons
- staff-only ticket channels
- claim / close / reopen actions
- transcript generation
- ticket logs
- category routing

### ⚙️ Utilities

Planned utility features:

- ping
- server info
- user info
- avatar
- polls
- reminders
- embeds
- role tools

### 🧩 Roles & Automation

Planned role and automation features:

- reaction roles
- button role menus
- welcome messages
- goodbye messages
- auto-role assignment
- scheduled announcements
- simple server automation rules

### 🌍 Internationalization

Potential future i18n support:

- default language configuration
- per-guild language
- typed translation keys
- fallback language
- localized command responses

This is not a Phase 1 priority unless the bot quickly needs multilingual support.

---

## Architecture Overview

Zen currently follows a **single-process bot architecture**.

```text
Discord
  │
  ▼
Bot Runtime
  │
  ├─ loads environment config
  ├─ starts Discord client
  ├─ registers event handlers
  ├─ loads slash commands
  ├─ routes interactions
  ├─ executes module logic
  └─ writes logs / optional database records
```

The important rule:

> Keep the project simple, but not messy.

Zen should avoid two traps:

1. **Over-engineering**: starting with a huge monorepo before the bot works.
2. **Under-engineering**: dumping every command and event into random files with no boundaries.

The current architecture is the middle ground.

---

## Command System

Zen uses a slash-first command model.

A command should define:

- name
- description
- options
- permission requirements
- execution handler
- error behavior where needed

Example command shape:

```ts
export interface Command {
  name: string;
  description: string;

  execute(context: CommandContext): Promise<void>;
}
```

A command should stay thin.

Bad pattern:

```text
command file
└─ 300 lines of validation, permissions, database writes, business logic, embeds
```

Preferred pattern:

```text
command file
├─ validate input
├─ call module/service
└─ send response
```

The real logic belongs in `modules/` or `services/`.

---

## Event System

Events are loaded from `src/events`.

Examples:

- `ready`
- `interactionCreate`
- `guildCreate`
- `guildDelete`
- `messageCreate`
- `error`

Event handlers should also stay thin.

An event handler should:

- receive the Discord event
- ignore irrelevant cases early
- call the correct module/service
- log errors properly
- avoid hidden side effects

This keeps runtime behavior easier to debug.

---

## Module System

Zen is modular, but not a plugin platform yet.

A module is a feature area with clear responsibility.

Example modules:

- `moderation`
- `tickets`
- `automod`
- `utilities`
- `roles`
- `welcome`
- `reminders`

A module may contain:

- services
- types
- policies
- validators
- repository usage
- module-specific config logic

Example:

```text
src/modules/moderation/
├─ moderation.service.ts
├─ moderation.policy.ts
├─ moderation.types.ts
└─ moderation.errors.ts
```

### Module design principles

- one module = one clear responsibility
- no direct coupling between unrelated modules
- shared logic goes in `lib/` or `services/`
- persistence goes through repositories
- commands call modules, not the opposite
- permission checks must be explicit
- sensitive actions should be logged

---

## Configuration Model

Zen uses environment variables for runtime configuration.

Configuration should be validated at startup.  
The bot should fail fast if required values are missing.

### Required environment variables

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_DEV_GUILD_ID=
NODE_ENV=development
LOG_LEVEL=info
```

### Optional future variables

```env
DATABASE_URL=
REDIS_URL=
DEFAULT_LANGUAGE=en
```

### Principles

- no hardcoded secrets
- no silent fallback for required secrets
- clear `.env.example`
- validation before starting the bot
- separate development and production behavior

---

## Data & Persistence

Zen should not start with a heavy database model unless the first features require it.

### No database needed for early utilities

Commands like these do not require persistence:

- ping
- server info
- user info
- avatar
- simple embeds

### Database becomes useful for

- moderation cases
- warnings
- ticket metadata
- guild configuration
- audit logs
- reminders
- role menus
- leveling

### Recommended direction

When persistence is needed, use one clear database layer.

Possible stack:

- PostgreSQL for persistent data
- Prisma or Drizzle for schema and queries
- migrations committed to the repository

The choice should be made once the first persistent feature is implemented.  
Do not add a database just to look serious.

---

## Security, Privacy & Reliability

Zen should be strict with moderation and server-management features.

### Security priorities

- least-privilege bot permissions
- explicit permission checks
- guild-scoped behavior
- safe command defaults
- input validation
- rate limiting for abuse-prone commands
- no secrets committed to the repository
- no dangerous owner-only commands without checks

### Privacy principles

- collect only useful operational data
- avoid unnecessary user tracking
- make stored data understandable
- allow server owners to control bot configuration
- avoid invasive defaults

### Reliability priorities

- fail fast on invalid config
- log command errors
- keep command handlers thin
- avoid global mutable state where possible
- keep module boundaries clear
- add tests around critical logic

---

## Tech Stack

Current intended stack:

- **TypeScript**
- **Node.js LTS**
- **pnpm**
- **Discord bot runtime library**
- **ESLint**
- **Prettier**
- **tsx** for local development
- **tsup** or **esbuild** for production builds
- **Vitest** for tests when needed

Optional later:

- **PostgreSQL**
- **Prisma** or **Drizzle**
- **Redis**
- **Docker**
- **GitHub Actions**

The stack should stay boring and reliable.

Zen does not need a complex toolchain before the bot has useful features.

---

## Development Setup

### Requirements

- Node.js LTS
- pnpm
- a Discord application
- a Discord bot token

### Installation

```bash
git clone https://github.com/t-aize/zen.git
cd zen
pnpm install
cp .env.example .env
```

Fill in `.env`:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_DEV_GUILD_ID=your_test_guild_id
NODE_ENV=development
LOG_LEVEL=info
```

Slash commands are synchronized automatically when a guild becomes available. If `DISCORD_DEV_GUILD_ID` is set, only that guild is synchronized.

### Start in development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Start in production

```bash
pnpm start
```

---

## Scripts

Recommended scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsup src/main.ts --format esm --target node20 --out-dir dist --clean",
    "start": "node dist/main.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "test": "vitest run"
  }
}
```

Adjust the Node target based on the version used by the project.

---

## Roadmap

## Phase 0 — Project Foundation

- [ ] initialize TypeScript project
- [ ] configure ESLint
- [ ] configure Prettier
- [ ] configure `.env.example`
- [ ] add typed environment validation
- [ ] add basic logger
- [ ] add CI workflow for lint and typecheck
- [ ] add clean `src/` architecture

## Phase 1 — Discord Runtime

- [ ] create Discord client bootstrap
- [ ] handle `ready` event
- [ ] add command registry
- [ ] add event registry
- [ ] add interaction routing
- [ ] add central error handling
- [ ] add slash command deployment script

## Phase 2 — Utility Commands

- [ ] `/ping`
- [ ] `/server-info`
- [ ] `/user-info`
- [ ] `/avatar`
- [ ] basic embed helpers
- [ ] basic permission helpers

## Phase 3 — Moderation V1

- [ ] `/ban`
- [ ] `/kick`
- [ ] `/timeout`
- [ ] `/unban`
- [ ] reason support
- [ ] permission checks
- [ ] moderation log channel support
- [ ] basic case model if database is added

## Phase 4 — Tickets V1

- [ ] ticket panel command
- [ ] button-based ticket creation
- [ ] private ticket channel creation
- [ ] close ticket action
- [ ] reopen ticket action
- [ ] transcript strategy
- [ ] ticket logs

## Phase 5 — Configuration & Persistence

- [ ] choose database stack
- [ ] add guild configuration model
- [ ] add repositories
- [ ] add migrations
- [ ] persist moderation cases
- [ ] persist ticket metadata
- [ ] add config commands for admins

## Phase 6 — Automod & Protection

- [ ] anti-spam rules
- [ ] anti-link rules
- [ ] anti-invite rules
- [ ] basic raid detection
- [ ] lockdown command
- [ ] configurable thresholds

## Phase 7 — Community Features

- [ ] welcome messages
- [ ] goodbye messages
- [ ] reaction roles
- [ ] role menus
- [ ] reminders
- [ ] polls

## Phase 8 — Stabilization

- [ ] tests for critical modules
- [ ] better error messages
- [ ] production logging
- [ ] Dockerfile
- [ ] deployment notes
- [ ] first stable release

---

## Future Monorepo Direction

Zen may become a monorepo later, but only when the project has a real reason.

A monorepo may become justified if Zen adds:

- a web dashboard
- an API backend
- shared contracts between bot and API
- background workers
- shared UI packages
- a public plugin system
- deployment infrastructure

Possible future structure:

```text
zen/
├─ apps/
│  ├─ bot/
│  ├─ api/
│  └─ dashboard/
│
├─ packages/
│  ├─ config/
│  ├─ db/
│  ├─ contracts/
│  ├─ permissions/
│  └─ ui/
│
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

But this is not the current target.

For now, the correct architecture is:

```text
one bot
one package.json
one src/
clear modules
clean execution
```

---

## Contributing

Contributions are welcome, but Zen should stay coherent.

### Contribution expectations

- follow formatting rules
- keep command handlers small
- avoid unrelated changes in one pull request
- document behavior changes
- add tests for important logic
- do not bypass permission helpers
- do not hardcode guild-specific behavior
- do not introduce a workspace without a real reason

### Larger changes

Open an issue first if the change affects:

- project architecture
- persistence model
- command system
- permission system
- moderation behavior
- public configuration
- deployment model

---

## Project Goals

Zen is being built to be:

- a useful Discord bot first
- simple to run locally
- cleanly structured
- modular without being over-engineered
- self-hostable
- serious about permissions and moderation safety
- able to evolve into a larger platform later if justified

---

## Non-Goals

Zen is not currently trying to be:

- a full Discord platform
- a dashboard-first product
- a multi-service monorepo
- a SaaS
- a music infrastructure project
- a public plugin marketplace
- an enterprise-grade distributed system
- a bot with every feature added at once

Feature quantity is not the priority.

A smaller bot with clean foundations is better than a huge bot that becomes unmaintainable.

---

## License

Zen is open-source under the **Apache-2.0 License**.

---

## Disclaimer

Zen is an independent open-source project and is **not affiliated with Discord** or any third-party bot provider.

It may offer features commonly found across the Discord bot ecosystem, but it is designed as its own bot with its own
architecture, goals, and implementation.

---

<div align="center">

### Zen — A clean Discord bot first. A larger platform later, only if justified.

</div>
