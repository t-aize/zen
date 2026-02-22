<div align="center">

# 🧘 Zen — Simply powerful, purely open-source.

**The last Discord bot you'll ever need.**  
All-in-one, 100% free, forever. No paywalls. No premium tiers. Just Zen.

<img src="https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge" alt="Version">
<img src="https://img.shields.io/badge/license-Apache%202.0-green?style=for-the-badge" alt="License">
<img src="https://img.shields.io/badge/open%20source-♥-red?style=for-the-badge" alt="Open Source">
<img src="https://img.shields.io/badge/built%20with-Rust-orange?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">


[Invite Zen](#) · [Documentation](#) · [Support Server](#) · [Report a Bug](#)

</div>

---

## 🌟 Overview

Zen is a **multipurpose Discord bot** built in Rust for communities of all sizes. It replaces the pile of bots
cluttering your server with a single, blazing-fast solution — covering moderation, security, music, economy, leveling,
games, and much more.

Open-source at its core, Zen is built by the community, for the community. Every feature, for everyone, always.

---

## ✨ Features

### 🛡️ Security & Anti-Raid

Advanced real-time protection against raids, nuke attempts, and bot attacks. Configurable thresholds for join velocity,
mass mention, mass channel/role deletion, and token detection. Instant server lockdown with automatic recovery —
inspired by RaidProtect.

### 🔨 Moderation

Full moderation suite with warnings, mutes, timeouts, kicks, bans, and softbans. Infraction history, auto-mod with
custom word filters, spam/caps/link detection, and configurable punishments. Complete audit log with search and export.

### 📈 Leveling & XP

A rich leveling system with per-server XP rates, level-up announcements, role rewards, and leaderboards — everything
you'd expect from MEE6 and more, for free. Voice XP, message XP, and bonus XP events are all supported.

### 💰 Economy & RPG

A fully-fledged server economy with virtual currency, daily/weekly rewards, a shop, inventory, crafting, and trading.
Rob, gamble, work, and grind your way up. RPG-style profiles with customizable cards.

### 🎵 Music

High-quality music playback from YouTube, Spotify, SoundCloud, and more. Queue management, filters (bassboost,
nightcore, vaporwave…), looping, shuffle, volume control, and DJ roles. Powered by Lavalink for optimal performance.

### 🎫 Ticket System

Structured support tickets with staff roles, private threads, transcripts, category routing, ratings, and auto-close.
Perfect for communities needing clean and traceable support workflows.

### 🎉 Giveaways & Events

Host fully customizable giveaways with entry requirements (roles, invites, level), multiple winners, reroll, and
scheduled draws. Create server events with reminders and RSVP tracking.

### 🤝 Starboard

Automatically highlight the best messages in your community. Configurable emoji, threshold, and channel. Self-stars
prevention and NSFW channel filtering included.

### 📩 Welcome & Farewell

Rich welcome and farewell messages with fully customizable embed cards, background images, member counters, DM
greetings, and auto-role on join — like Koya but open.

### 🔢 Member Counter

Real-time voice channel counters for total members, humans, bots, online members, and custom stats — inspired by
DoubleCounter. Multiple counters per server, each with custom naming templates.

### ⚙️ Reaction Roles & Auto-Roles

Create unlimited reaction role menus with button, dropdown, or emoji styles. Unique, multiple, or verified mode.
Auto-assign roles on join, on verify, or on level milestones.

### 📊 Analytics & Statistics

Deep insights into your server's growth, message activity, peak hours, top contributors, command usage, and moderation
trends. Beautiful charts and exportable reports.

### 🃏 Custom Commands

Create personalized commands with rich text responses, embeds, variables, permission checks, cooldowns, and aliases —
like DraftBot's custom commands feature.

### 🎮 Games & Entertainment

Trivia with multiple categories and difficulty levels, word games, image manipulation commands, memes, 8ball, coinflip,
RPS, and more to keep your community entertained.

### 🌐 Multilingual Support

Zen speaks your members' language. Full support for multiple locales with per-server and per-user language preferences.

### 🗓️ Reminders & Polls

Set personal or public reminders, create polls with multiple choices, real-time vote tracking, and scheduled closing
with results announcement.

### 📋 Logging & Audit

Granular event logging for messages (edit, delete), members (join, leave, ban), roles, channels, voice activity, and
invites. Each log type routes to its own channel.

### 🔧 Deep Customization

Every module can be enabled, disabled, or configured independently. Per-channel and per-role overrides for nearly every
feature. Zen adapts to your server, not the other way around.

---

## 🚀 Why Zen?

|                      | Zen | MEE6 | DraftBot | Koya |
|----------------------|:---:|:----:|:--------:|:----:|
| 100% free            |  ✅  |  ❌   |    ❌     |  ❌   |
| Open source          |  ✅  |  ❌   |    ❌     |  ❌   |
| Self-hostable        |  ✅  |  ❌   |    ❌     |  ❌   |
| Built with Rust 🦀   |  ✅  |  ❌   |    ❌     |  ❌   |
| No ads or promotions |  ✅  |  ❌   |    ❌     |  ❌   |
| All-in-one           |  ✅  |  ⚠️  |    ⚠️    |  ⚠️  |

---

## 🛠️ Self-Hosting

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- A PostgreSQL database
- A Discord application with a bot token
- A [Lavalink](https://github.com/lavalink-devs/Lavalink) instance (for music)

### Quick Start

```bash
git clone https://github.com/t-aize/zen.git
cd zen

cp .env.example .env
# Edit .env with your values

cargo build --release
cargo run --release
```

### Environment Variables

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
DATABASE_URL=postgresql://user:password@localhost:5432/zen
LAVALINK_HOST=localhost
LAVALINK_PASSWORD=youshallnotpass
```

---

## 🤝 Contributing

Any contribution is welcome and appreciated!

1. Fork the repository
2. Create your feature branch — `git checkout -b feature/my-feature`
3. Commit your changes — `git commit -m 'feat: add my feature'`
4. Push to your branch — `git push origin feature/my-feature`
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting.

---

## 📜 License

Distributed under the **Apache License 2.0**. See [LICENSE](LICENSE) for more information.

---

<div align="center">

*Built with ❤️ and 🦀 for the Discord community.*

**[⭐ Star this repo](https://github.com/t-aize/zen)** if Zen helps your community!

</div>
