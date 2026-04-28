# AGENTS.md

Instructions for AI coding agents (Codex, Claude Code, Cursor, etc.) working on
this repository.

These rules are non-negotiable. Read them at the start of every task.

## Core principle: do exactly what is asked. Nothing more.

If the task says "add a /ping command that returns latency", you write a /ping
command that returns latency. You do not add refresh buttons, embeds with
status indicators, uptime counters, color theming, or shard information unless
explicitly requested.

When in doubt about scope, ask one clarifying question. Never assume "the user
probably wants X too".

## Anti-bloat rules

### Don't fragment code that doesn't need fragmenting.

Do NOT extract a function unless BOTH of these are true:

1. The body is genuinely complex (multiple steps, branching logic, or >5 lines
   of meaningful work) OR it is called from at least 2 places.
2. Extracting it makes the calling site materially easier to read.

A one-line wrapper around a logger call is not a function. It's noise.

A function called once, only from inside the same class, that just renames an
expression, is not a function. It's noise.

### Don't create types you only use once.

Do NOT create custom type aliases or interfaces for objects that already have
a name in the upstream library. If discord.js exports `ButtonInteraction`,
use it directly. Don't create your own `PingButtonInteraction` type that
duplicates a subset of its fields.

### Don't add features the user didn't ask for.

This includes: buttons, modals, collectors, pagination, embed flourishes,
emoji decoration, color theming, status indicators, uptime displays,
informational fields, "nice to have" responses, retry logic, defensive checks
for impossible states.

If you think a feature would be valuable, write `// TODO: consider adding X`
in a comment. Do NOT implement it.

### Don't write defensive code for states that cannot occur.

If a slash command handler runs, the client is ready. Do not check
`client.uptime === null`. If you've awaited an interaction reply with
`withResponse: true`, do not silently early-return when the response is
missing — log it loudly, because if it happens it's a bug.

## Style rules

- No `any`. Use `unknown` and narrow.
- No magic numbers. Either name them with `const NAME = ...` at the top of the
  file, or use a documented constant.
- Prefer pino's native `err` serialization over custom error formatters.
  `logger.warn({ err: error }, 'message')` is correct.
- Use early returns over nested if/else.
- Prefer `import type` for type-only imports.
- ESM imports must include `.js` extensions where required by NodeNext.

## Discord.js / Necord rules

- Slash command handlers should be small. The handler validates input, calls
  a service, and returns a response. Business logic belongs in services, not
  in command classes.
- For utility / admin / moderation commands, default to `MessageFlags.Ephemeral`.
- Don't use deprecated APIs: no `Intents.FLAGS`, no string intents. Use
  `GatewayIntentBits.X`.
- For simple responses, use `interaction.reply({ content: '...' })`. Don't
  reach for `EmbedBuilder` unless the response actually benefits from
  structured visual formatting.

## NestJS rules

- One module per business feature, not one module per class.
- Services are stateless. Per-guild state goes in the database, not in
  service properties.
- Don't add `@Inject(SomeToken)` when constructor injection by class works.
- Don't subclass NestJS exceptions unless you need a new HTTP/Discord behavior.

## When you're unsure

Stop and ask. The user prefers one clarifying question over a 200-line file
that needs to be thrown away.

## When you're rewriting existing code

If a file already exists and you're being asked to modify it, do NOT also
"clean up" or refactor unrelated parts. Make the requested change. Note other
issues in your final summary, but do not silently change them.
