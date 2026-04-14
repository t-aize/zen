<div align="center">

# 🧘 Zen

### One platform. Multiple modules. Open-source. Self-hostable.

**Zen** is a modular Discord platform built to unify moderation, tickets, music, leveling, utilities, anti-raid
protection, automations, and server management inside a single ecosystem.

It is designed as a **workspace-based monorepo** with a **Discord bot runtime**, a **web dashboard**, shared internal
packages, and optional background workers for scalable production deployments.

![Version](https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-Apache%202.0-green?style=for-the-badge)
![Open Source](https://img.shields.io/badge/open--source-yes-success?style=for-the-badge)
![Self Hostable](https://img.shields.io/badge/self--hostable-yes-purple?style=for-the-badge)

</div>

---

## Table of Contents

- [Why Zen Exists](#why-zen-exists)
- [What Zen Is](#what-zen-is)
- [Core Capabilities](#core-capabilities)
- [Architecture Overview](#architecture-overview)
- [Workspace Structure](#workspace-structure)
- [Module System](#module-system)
- [Configuration Model](#configuration-model)
- [Data & Persistence](#data--persistence)
- [Deployment Modes](#deployment-modes)
- [Security, Privacy & Reliability](#security-privacy--reliability)
- [Observability & Operations](#observability--operations)
- [Tech Stack](#tech-stack)
- [Development Setup](#development-setup)
- [Docker Compose](#docker-compose)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Project Goals](#project-goals)
- [Non-Goals](#non-goals)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## Why Zen Exists

Discord communities often stack multiple bots to cover moderation, tickets, music, reaction roles, XP systems,
automations, logging, and anti-raid protection.

That usually leads to the same problems:

- fragmented configuration across multiple dashboards
- inconsistent permissions and role access rules
- overlapping or duplicated features
- poor observability for moderators and admins
- vendor lock-in or premium-gated core features
- harder maintenance for communities that want control over their tooling

**Zen** exists to solve that by providing a **unified, modular, self-hostable platform** rather than another isolated
single-purpose bot.

The goal is not to be a gimmick bot with a long feature list.  
The goal is to build a platform that server admins can actually trust, operate, extend, and host.

---

## What Zen Is

Zen is an **all-in-one Discord platform** that combines multiple common server functions inside one coherent system.

It is designed to be:

- **Open-source**
- **Self-hostable**
- **Modular**
- **Extensible**
- **Production-oriented**
- **Privacy-conscious**
- **Admin-friendly**
- **Workspace-based from day one**

Zen is not meant to be a pile of commands glued together.  
It is intended to be a maintainable platform with clear boundaries between runtime, modules, persistence,
configuration, dashboard, and infrastructure.

---

## Core Capabilities

### 🛡️ Moderation & Enforcement

- ban / kick / timeout / unban workflows
- warning system
- bulk moderation actions
- role and channel lockdown tools
- mod logs and audit trails
- reason tracking and case history
- permission-safe moderation commands
- future escalation policies

### 🚨 Anti-Raid & AutoMod

- join flood detection
- anti-spam protections
- anti-mention spam
- anti-link and anti-invite filtering
- account age and server age gating
- auto quarantine / verification flow
- configurable protection thresholds
- safe defaults for fast incident response

### 🎫 Tickets & Support

- ticket panels and button-based flows
- category and channel routing
- claim / close / reopen / archive actions
- staff visibility controls
- transcript export
- optional SLA-oriented workflows
- future support analytics

### 🎵 Music

- voice playback queue
- play / pause / skip / stop / seek controls
- queue management
- loop modes
- permission-aware voice controls
- optional dedicated audio backend for larger deployments

### 📈 Levels, Engagement & Community Features

- XP and leveling
- reward roles
- rank display
- configurable progression rules
- anti-abuse safeguards
- activity-based engagement systems
- optional fun/community modules

### ⚙️ Utilities & Server Management

- server info and user info
- avatar / banner utilities
- polls
- reminders
- embeds
- custom commands
- slash-first interaction model
- configurable guild tools

### 🧩 Roles, Menus & Community Automation

- reaction roles
- role menus
- welcome / goodbye messages
- auto-role assignment
- scheduled announcements
- recurring server tasks
- simple automation primitives for common admin workflows

### 🌍 Internationalization

- per-guild language selection
- localized runtime responses
- localized dashboard UI
- localized command descriptions where supported
- fallback language strategy
- shared translation keys across services

### 🌐 Dashboard & Admin Experience

- Discord OAuth2 authentication
- guild-scoped admin access
- centralized module configuration
- role-aware settings pages
- safer editing than command-only configuration
- logs, health visibility, and future analytics

### 🔐 Auth & Access Control

- guild ownership and admin checks
- dashboard authorization layer
- permission-aware UI visibility
- internal access rules for sensitive actions
- future support for fine-grained role policy management

### 🧵 Jobs & Background Processing

- scheduled jobs
- retryable background tasks
- queue-driven workflows
- transcript generation
- maintenance jobs
- future digest / batch / cleanup pipelines

### 📊 Observability & Operations

- health checks
- structured logs
- metrics exposure
- audit events
- operational diagnostics
- future tracing support

### 🔌 Integrations

- Discord-native integrations first
- webhook support
- external service hooks
- optional third-party connectors over time
- internal event-driven integration points

---

## Architecture Overview

Zen is designed as a **workspace-based platform** with clear boundaries between application runtimes and shared
packages.

At a high level, Zen can include:

- a **bot runtime** for Discord gateway interactions
- an **API service** for dashboard and internal operations
- a **dashboard frontend**
- one or more **background workers**
- shared internal **packages** for business logic, contracts, config, permissions, localization, and data access

### High-Level Flow

1. A guild installs the bot.
2. Zen registers runtime capabilities and module availability.
3. Admins authenticate through Discord OAuth2 on the dashboard.
4. Guild-scoped configuration is loaded from persistent storage.
5. Modules execute against validated config and permission rules.
6. Sensitive actions emit logs and audit events.
7. Background jobs process asynchronous tasks when needed.

This separation makes Zen easier to:

- maintain
- test
- scale
- self-host
- extend over time without collapsing into monolithic spaghetti

---

## Workspace Structure

Zen is intended to grow as a **pnpm workspace / monorepo**.

```text
zen/
├─ apps/
│  ├─ bot/                  # Discord bot runtime
│  ├─ api/                  # Backend API for dashboard and internal services
│  ├─ dashboard/            # Web dashboard frontend
│  └─ worker/               # Background jobs, queues, scheduled tasks
│
├─ packages/
│  ├─ core/                 # Shared domain logic
│  ├─ db/                   # Database schema, migrations, repositories
│  ├─ config/               # Environment parsing and runtime config
│  ├─ logger/               # Structured logging utilities
│  ├─ i18n/                 # Localization system and translation keys
│  ├─ permissions/          # Role/access policy logic
│  ├─ contracts/            # Shared types, schemas, API contracts
│  ├─ modules/              # Reusable feature modules
│  ├─ ui/                   # Shared dashboard UI components
│  └─ utils/                # Low-level helpers
│
├─ services/
│  └─ music/                # Optional dedicated audio-related service
│
├─ infrastructure/
│  ├─ docker/
│  ├─ compose/
│  ├─ monitoring/
│  ├─ scripts/
│  └─ reverse-proxy/
│
├─ docs/
│  ├─ architecture/
│  ├─ modules/
│  ├─ deployment/
│  └─ contributing/
│
├─ .github/
├─ pnpm-workspace.yaml
├─ turbo.json
├─ package.json
├─ .env.example
└─ README.md
```

### Why this structure

This layout keeps Zen sane as it grows:

- **apps/** contains runnable services
- **packages/** contains shared internal building blocks
- **services/** isolates optional specialized runtimes
- **infrastructure/** holds deployment and ops concerns
- **docs/** keeps architecture and contributor documentation separate from code

This avoids mixing:

- command logic
- persistence
- dashboard code
- infrastructure scripts
- module internals

inside one giant codebase with no boundaries.

---

## Module System

Zen is built around a modular architecture.

A module is not just “a folder with commands”.
A proper Zen module can include several concerns:

- runtime commands
- Discord event handlers
- config schema
- validation rules
- permission requirements
- persistence needs
- audit hooks
- translation keys
- dashboard settings UI
- optional background jobs

### Example module candidates

- moderation
- automod
- anti-raid
- tickets
- music
- levels
- welcome
- reaction roles
- utilities
- reminders
- polls
- custom commands

### Module design principles

- modules should have **clear ownership**
- modules should expose **explicit capabilities**
- modules should not bypass shared permission or config systems
- modules should be **composable**, not tightly coupled
- module configuration should be validated before activation
- sensitive behavior should emit auditable events

Long-term, Zen may expose a more formal plugin or extension API.
But the internal module model must be stable first.

---

## Configuration Model

Zen needs configuration that is both safe and manageable.

### Configuration layers

- **environment configuration**
  tokens, secrets, service URLs, runtime flags

- **global system configuration**
  deployment-wide behavior and operational defaults

- **guild configuration**
  server-specific module settings, language, permissions, thresholds, channels, roles

- **feature flags**
  controlled rollout of unstable or optional features

### Principles

- validated at load time
- safe defaults
- per-module config ownership
- guild-scoped isolation
- dashboard-safe editing
- no silent invalid states

A platform like Zen dies quickly if config becomes ambiguous or inconsistent.
This layer must stay strict.

---

## Data & Persistence

Zen is designed around a clean persistence model.

### Primary storage responsibilities

#### PostgreSQL

Used for persistent application state such as:

- guild configuration
- moderation history
- warnings and cases
- ticket metadata
- localization preferences
- leveling data
- automation records
- dashboard-related metadata

#### Redis

Used for ephemeral or operational concerns such as:

- caching
- rate limiting
- queueing
- temporary locks
- distributed coordination where needed

#### Optional object/file storage

Can be used later for:

- ticket transcripts
- exported reports
- generated assets
- large audit-related artifacts

### Data design priorities

- guild isolation
- predictable schema evolution
- migrations under version control
- minimal ambiguity in ownership
- support for future analytics without polluting runtime paths

---

## Deployment Modes

Zen is intended to scale progressively rather than forcing complex infrastructure on day one.

### 1. Local Development

Recommended for contributors and early development.

Typical services:

- bot
- PostgreSQL
- optional dashboard
- optional Redis

Best for:

- local feature work
- debugging
- architecture iteration

---

### 2. Single-Node Self-Hosted

Best for personal communities and small to medium servers.

Typical services:

- bot
- PostgreSQL
- optional Redis
- optional dashboard

Best for:

- hobby hosting
- private communities
- simple production setups

---

### 3. Small Production Deployment

Adds more separation and reliability.

Typical services:

- bot
- API
- dashboard
- PostgreSQL
- Redis

Best for:

- communities that want safer operations
- teams with dashboard-based configuration needs
- cleaner service boundaries

---

### 4. Multi-Service Production

Separates background work from core runtime.

Typical services:

- sharded bot workers
- API
- dashboard
- dedicated worker
- PostgreSQL
- Redis

Best for:

- larger servers
- heavier automation
- better operational isolation

---

### 5. Horizontal Scale

For larger deployments and serious production hosting.

Possible additions:

- multiple shard groups
- queue worker pools
- dedicated music backend
- metrics stack
- alerting stack
- reverse proxy / ingress layer
- database tuning and replicas where justified

Zen should be able to grow into this model, but it should not require this complexity to be useful.

---

## Security, Privacy & Reliability

Zen is built with a security-first mindset.

### Security priorities

- least-privilege bot permissions
- strict dashboard auth boundaries
- guild-scoped access validation
- input validation on command and API boundaries
- rate limiting for abuse-prone surfaces
- safe secret handling
- secure defaults for anti-raid and automod systems
- auditable handling of sensitive actions

### Privacy principles

- no unnecessary data collection
- keep retained data purposeful
- avoid invasive defaults
- self-hosting support for communities that want control
- transparent storage responsibilities

### Reliability priorities

- explicit module boundaries
- predictable config validation
- resilient startup behavior
- background retry strategy where needed
- support for health checks and diagnostics
- architecture that can evolve without constant rewrites

---

## Observability & Operations

A platform meant for real communities needs more than commands.

Zen should support operational visibility through:

- structured application logs
- health check endpoints
- module-level diagnostics
- audit events for sensitive actions
- future metrics for:
  - command failures
  - moderation actions
  - queue health
  - job retries
  - API errors
  - runtime performance

This is not “nice to have”.
Without visibility, moderation and automation systems become dangerous to operate.

---

## Tech Stack

The exact implementation may evolve, but the intended direction is:

### Core stack

- **TypeScript**
- **Node.js**
- **pnpm workspaces**
- **Turbo** for monorepo task orchestration

### Runtime and platform

- Discord bot runtime
- REST API backend
- web dashboard frontend
- optional worker runtime for async tasks

### Data layer

- **PostgreSQL**
- **Drizzle ORM**
- **Redis** for cache / queue / coordination

### Frontend

- dashboard application with shared UI components
- Discord OAuth2 authentication

### Tooling

- **ESLint**
- **Prettier**
- testing stack to be defined consistently across apps/packages
- Docker for local and production-friendly packaging
- GitHub Actions for CI/CD later

The important point is consistency, not trendy tool collection.

---

## Development Setup

### Requirements

- Node.js 25+
- pnpm 10+
- PostgreSQL 16+
- Redis 7+ (recommended for some features)
- a Discord application and bot token

### Quick Start

```bash
git clone https://github.com/t-aize/zen.git
cd zen
pnpm install
cp .env.example .env
# Fill in your Discord / PostgreSQL / Redis credentials
pnpm db:migrate
pnpm dev
```

### Expected developer workflow

Typical local tasks may include:

```bash
pnpm lint
pnpm format
pnpm test
pnpm dev
pnpm build
pnpm db:migrate
```

As the workspace grows, task routing should stay predictable and centralized.

---

## Docker Compose

```bash
cp .env.example .env
# Fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, DATABASE_URL and Redis settings
docker compose up --build -d
```

Typical local Compose stack may include:

- `postgres`
- `redis`
- `bot`
- optional `api`
- optional `dashboard`
- optional `worker`

### Notes

- the bot should run migrations safely before startup where appropriate
- service-to-service networking should use Compose internal hostnames
- local non-Docker development should remain simple and documented

---

## Roadmap

## Phase 0 — Foundation

- [ ] workspace setup
- [ ] shared config package
- [ ] logging package
- [ ] database package with migrations
- [ ] contracts / schema package
- [ ] i18n foundation
- [ ] permission model foundation

## Phase 1 — Core Runtime

- [ ] Discord bot bootstrap
- [ ] slash command system
- [ ] guild registration and config loading
- [ ] localization support in runtime
- [ ] central error handling
- [ ] audit event pipeline

## Phase 2 — Moderation & Protection

- [ ] moderation commands
- [ ] warn/case system
- [ ] mod logs
- [ ] anti-spam
- [ ] anti-link / anti-invite
- [ ] raid detection and mitigation

## Phase 3 — Tickets & Support

- [ ] ticket creation flow
- [ ] claim / close / reopen flows
- [ ] transcript export
- [ ] support role routing
- [ ] dashboard configuration for ticket panels

## Phase 4 — Dashboard & Admin UX

- [ ] Discord OAuth2 authentication
- [ ] guild-scoped admin pages
- [ ] module configuration UI
- [ ] safer permission-aware settings editing
- [ ] dashboard audit/history views

## Phase 5 — Community Systems

- [ ] leveling
- [ ] reward roles
- [ ] welcome / goodbye
- [ ] reminders
- [ ] reaction roles
- [ ] lightweight automation tools

## Phase 6 — Music & Optional Services

- [ ] music playback system
- [ ] queue management
- [ ] optional dedicated audio backend
- [ ] operational constraints for scale

## Phase 7 — Operations & Scale

- [ ] health checks
- [ ] metrics
- [ ] worker queues
- [ ] sharding strategy
- [ ] deployment docs
- [ ] CI/CD pipeline

## Long-Term

- [ ] public extension or plugin API
- [ ] analytics surfaces
- [ ] stronger policy engine
- [ ] advanced operational tooling

---

## Contributing

Contributions are welcome, but Zen should stay coherent.

### Contribution expectations

- follow formatting and linting rules
- document behavior changes
- include tests where relevant
- avoid bypassing shared config / permissions / contracts
- keep module boundaries explicit
- discuss major architectural changes before implementation

### For larger changes

Please open an issue first if your change affects:

- architecture
- persistence model
- auth
- permissions
- module contracts
- public APIs
- deployment model

### Project standards

Zen aims to be:

- readable
- modular
- testable
- operationally sane
- serious about maintainability

That means “works on my machine” is not enough.

---

## Project Goals

Zen is being built to be:

- a coherent all-in-one Discord platform
- self-hostable without premium lock-in
- modular enough to grow safely
- maintainable by contributors over time
- useful for real communities, not just demo servers
- capable of scaling progressively when justified

---

## Non-Goals

Zen is **not** trying to be:

- a rushed mega-bot with no architecture
- a premium-bait SaaS clone
- an over-engineered enterprise system for day one
- a dependency pile of unrelated features
- a platform that requires huge infrastructure just to run locally

The goal is disciplined growth, not feature vanity.

---

## License

Zen is open-source under the **Apache-2.0 License**.

---

## Disclaimer

Zen is an independent open-source project and is **not affiliated with Discord** or any third-party bot provider.

It may offer features commonly found across the Discord bot ecosystem, but it is designed as its own platform with its
own architecture, goals, and implementation.

---

<div align="center">

### Zen — A serious open-source Discord platform, built to stay maintainable.

</div>
