<div align="center">

# 🧘 Zen

### One bot. Full stack. Open-source. Self-hostable.

**Zen** is a multilingual, multifunction Discord bot platform that combines moderation, tickets, music, levels,
utilities, anti-raid protection, and server management — all in one ecosystem with a web dashboard.

![Version](https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-Apache%202.0-green?style=for-the-badge)
![Open Source](https://img.shields.io/badge/open--source-yes-success?style=for-the-badge)
![Self Hostable](https://img.shields.io/badge/self--hostable-yes-purple?style=for-the-badge)

</div>

---

## Vision

Discord servers often rely on multiple bots to cover moderation, tickets, music, XP systems, automations, anti-raid
protection, and utility commands.

That creates problems:

- fragmented configuration
- inconsistent permissions
- duplicated features
- reliability issues
- paid feature lock-in
- poor observability for server admins

**Zen** solves this by providing a **unified bot platform** with a **web dashboard**, **multilingual support**, and a \*
\*modular architecture\*\* designed for real-world hosting.

---

## What Zen Is

Zen is designed as an **all-in-one Discord bot platform** that can replace multiple bots in a server while remaining:

- **Open-source**
- **Self-hostable**
- **Extensible**
- **Production-ready**
- **Privacy-conscious**
- **Admin-friendly**

---

## Core Feature Pillars

### 🛡️ Moderation & Anti-Raid

- Ban / kick / timeout / unban / warn systems
- Bulk moderation actions
- Role / channel lock tools
- Anti-spam / anti-mention spam / anti-invite / anti-link filters
- Join flood detection and raid mitigation
- Account age / server age gating
- Auto quarantine / verification workflows
- Mod logs and audit trails

### 🎫 Tickets & Support

- Ticket panels and buttons
- Category / channel routing
- Ticket claim / close / reopen / archive flows
- Staff permission templates
- Ticket transcripts (text export)
- SLA-friendly workflows (optional)

### 🎵 Music

- Voice playback queue
- Basic controls (play, pause, skip, stop, volume)
- Queue management and loop modes
- Optional dedicated audio backend for scale
- Permission-aware voice controls

### 📈 Levels, Engagement & Automation

- XP / levels / rank cards
- Reward roles
- Message and activity triggers
- Scheduled announcements
- Welcome / goodbye messages
- Reaction roles / role menus
- Giveaways and utility automations (optional modules)

### ⚙️ Utilities & Server Management

- Server info, user info, avatar/banner tools
- Polls, reminders, embeds, custom commands
- Configurable prefixes (if text commands are enabled)
- Slash-first interaction design
- Permission-safe admin tooling

### 🌍 Multilingual Experience

- Multi-language commands, responses, and dashboard UI
- Per-guild language selection
- Fallback language strategy
- Localized command descriptions
- Translation-ready content pipeline

### 🌐 Web Dashboard

- Secure authentication (Discord OAuth2)
- Guild-scoped admin access
- Centralized configuration for all modules
- Role/permission-aware settings UI
- Logs, analytics, and system health visibility
- Safer config changes than in-chat command editing

---

## Principles

Zen is built around a few non-negotiable principles:

- **One platform, many modules**
- **No premium-only core features**
- **Clear permissions and auditability**
- **Production-first reliability**
- **Self-hosting as a first-class use case**
- **Composable architecture over monolithic spaghetti**

---

## Scalability Strategy

Zen is designed to scale progressively:

### Stage 1 — Single Instance (Small/Medium Servers)

- One bot process
- One API process
- One database
- Optional Redis

### Stage 2 — Multi-Process / Multi-Service

- Sharded bot gateway workers
- Separate API service
- Separate worker service
- Redis required
- Central database

### Stage 3 — Horizontal Scale (Large Deployment)

- Multiple shard groups
- Dedicated queue workers
- Dedicated audio infrastructure
- Read replicas / optimized DB tuning
- Full metrics + alerting stack

---

## Security Model (High-Level)

Zen is built with a security-first mindset:

- Least-privilege bot permissions
- Strict guild admin checks in dashboard
- Role/permission-aware settings access
- Input validation at API and command boundaries
- Rate limiting for abuse-prone endpoints
- Secure secret management (no hardcoded tokens)
- Audit trails for sensitive actions
- Safe defaults for anti-raid and automod features

---

## Multilingual Design

Zen treats localization as a platform feature, not an afterthought.

### Goals

- Localized slash command names/descriptions where supported
- Localized runtime responses
- Shared translation keys across bot + dashboard
- Per-guild language selection
- Fallback language behavior
- Contributor-friendly translation workflow

This avoids fragmented translations and inconsistent UX between modules.

---

## Open Source & Self-Hosting

Zen is built for communities that want control.

### Why self-host Zen?

- Full control over your infrastructure
- No feature paywalls
- Custom extensions and integrations
- Better transparency and privacy
- Suitable for hobby projects and serious deployments

### Open-source goals

- readable codebase
- modular contribution model
- clear standards and docs
- predictable release process

---

## Development Philosophy

Zen is not meant to be a “quick script bot.”

It is a **platform**:

- modular
- testable
- observable
- maintainable
- deployable

The goal is to build something that admins can trust on real communities.

---

## Status

> **Project status:** In active development (early stage)

Zen is currently being built with a production-ready foundation in mind.  
Core architecture and platform decisions are prioritized before feature expansion.

---

## Development Setup

### Requirements

- Node.js 25+
- pnpm 10+
- PostgreSQL 16+
- A Discord application and bot token

### Quick Start

```bash
git clone https://github.com/t-aize/zen.git
cd zen
pnpm install
cp .env.example .env
# Fill in your Discord and PostgreSQL credentials
pnpm db:migrate
pnpm dev
```

The project now uses `eslint` + `prettier` for formatting/linting and `drizzle` for PostgreSQL schema management.

---

## Docker Compose

```bash
cp .env.example .env
# Fill in DISCORD_TOKEN and DISCORD_CLIENT_ID
docker compose up --build -d
```

Services:

- `postgres` on `${POSTGRES_PORT:-5432}`
- `bot`, which runs `pnpm db:migrate` before starting

Inside Docker, the bot uses the Compose-internal PostgreSQL hostname automatically, so you can keep `DATABASE_URL` with
`localhost` for local non-Docker development.

---

## Roadmap (Example)

- [ ] Core bot runtime (gateway, commands, permissions, i18n)
- [ ] Guild configuration system
- [ ] Moderation module (warn/timeout/ban/logs)
- [ ] Anti-raid / automod protections
- [ ] Ticket system
- [ ] Dashboard authentication + guild settings pages
- [ ] Leveling / rewards module
- [ ] Music subsystem
- [ ] Metrics / health checks / observability
- [ ] Public plugin/module API (long-term)

---

## Contributing

Contributions are welcome.

Zen aims to be a clean and serious open-source project, so contributions should follow:

- coding standards
- testing expectations
- security review where relevant
- documentation updates for behavior changes

Please open an issue first for major changes to discuss architecture and scope.

---

## License

Zen is open-source under the **Apache-2.0 License**.

---

## Disclaimer

Zen is an independent open-source project and is **not affiliated with Discord** or with any third-party bot
brands/services.

Zen may provide features commonly found across the Discord bot ecosystem, but it is built as its own platform.

---

<div align="center">

### Zen — Simply powerful, purely open-source.

</div>
