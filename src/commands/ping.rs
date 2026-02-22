use std::sync::OnceLock;
use std::time::{Duration, Instant};

use anyhow::Result;
use serenity::all::{
    ButtonStyle, Colour, CommandInteraction, ComponentInteraction, Context, CreateActionRow,
    CreateButton, CreateCommand, CreateEmbed, CreateEmbedFooter, CreateInteractionResponse,
    EditInteractionResponse, Timestamp,
};
use tracing::debug;

use crate::data::ShardManagerContainer;

static START_TIME: OnceLock<Instant> = OnceLock::new();

pub const NAME: &str = "ping";
pub const PREFIX: &str = "ping:";
const REFRESH_ID: &str = "ping:refresh";

pub fn register() -> CreateCommand {
    CreateCommand::new(NAME).description(
        "Displays WebSocket gateway and REST API latency diagnostics.",
    )
}

pub async fn run(ctx: &Context, cmd: &CommandInteraction) -> Result<()> {
    let start = Instant::now();

    cmd.defer_ephemeral(ctx).await?;

    let rest_latency = start.elapsed();
    let ws_latency = get_shard_latency(ctx).await;
    let now = Timestamp::now();

    cmd.edit_response(
        ctx,
        EditInteractionResponse::new()
            .embed(build_embed(ctx, ws_latency, rest_latency, now))
            .components(vec![build_row(false)]),
    )
    .await?;

    debug!(ws_ms = ?ws_latency, rest_ms = ?rest_latency, "Ping command executed");
    Ok(())
}

pub async fn handle_component(ctx: &Context, component: &ComponentInteraction) -> Result<()> {
    if component.data.custom_id != REFRESH_ID {
        return Ok(());
    }

    let start = Instant::now();

    component
        .create_response(ctx, CreateInteractionResponse::Acknowledge)
        .await?;

    let rest_latency = start.elapsed();
    let ws_latency = get_shard_latency(ctx).await;
    let now = Timestamp::now();

    component
        .edit_response(
            ctx,
            EditInteractionResponse::new()
                .embed(build_embed(ctx, ws_latency, rest_latency, now))
                .components(vec![build_row(false)]),
        )
        .await?;

    debug!(ws_ms = ?ws_latency, rest_ms = ?rest_latency, "Ping refreshed");
    Ok(())
}

async fn get_shard_latency(ctx: &Context) -> Duration {
    let data = ctx.data.read().await;
    if let Some(shard_manager) = data.get::<ShardManagerContainer>() {
        let runners = shard_manager.runners.lock().await;
        if let Some(runner) = runners.get(&ctx.shard_id) {
            return runner.latency.unwrap_or(Duration::ZERO);
        }
    }
    Duration::ZERO
}

fn latency_indicator(ms: u64) -> &'static str {
    match ms {
        0..=79 => "🟢",
        80..=149 => "🟡",
        150..=249 => "🟠",
        _ => "🔴",
    }
}

fn latency_status(ms: u64) -> &'static str {
    match ms {
        0..=79 => "Excellent",
        80..=149 => "Good",
        150..=249 => "Degraded",
        _ => "Poor",
    }
}

fn latency_color(ms: u64) -> Colour {
    match ms {
        0..=79 => Colour::from_rgb(87, 242, 135),
        80..=149 => Colour::from_rgb(254, 231, 92),
        150..=249 => Colour::from_rgb(230, 126, 34),
        _ => Colour::from_rgb(237, 66, 69),
    }
}

fn format_uptime(duration: Duration) -> String {
    let total_secs = duration.as_secs();
    let days = total_secs / 86400;
    let hours = (total_secs % 86400) / 3600;
    let mins = (total_secs % 3600) / 60;
    let secs = total_secs % 60;

    match (days, hours, mins) {
        (0, 0, 0) => format!("{}s", secs),
        (0, 0, _) => format!("{}m {}s", mins, secs),
        (0, _, _) => format!("{}h {}m {}s", hours, mins, secs),
        _ => format!("{}d {}h {}m", days, hours, mins),
    }
}

fn build_embed(ctx: &Context, ws_latency: Duration, rest_latency: Duration, timestamp: Timestamp) -> CreateEmbed {
    let ws_ms = ws_latency.as_millis() as u64;
    let rest_ms = rest_latency.as_millis() as u64;

    let uptime = START_TIME
        .get()
        .map(|t| t.elapsed())
        .unwrap_or(Duration::ZERO);

    let shard_id = ctx.shard_id.0;
    let shard_count = ctx.cache.shard_count();

    CreateEmbed::new()
        .title("🏓 Pong!")
        .description("Real-time latency diagnostics for the bot and Discord's infrastructure.")
        .color(latency_color(ws_ms))
        .field(
            "⚡ WebSocket Gateway",
            format!(
                "> `Ping:` **{}ms**\n> `Status:` {} {}",
                ws_ms,
                latency_indicator(ws_ms),
                latency_status(ws_ms)
            ),
            true,
        )
        .field(
            "🌐 REST API",
            format!(
                "> `Round-trip:` **{}ms**\n> `Status:` {} {}",
                rest_ms,
                latency_indicator(rest_ms),
                latency_status(rest_ms)
            ),
            true,
        )
        .field(
            "🤖 Bot",
            format!(
                "> `Uptime:` **{}**\n> `Memory:` **{:.1} MB**\n> `Shard:` **{}/{}**",
                format_uptime(uptime),
                memory_usage_mb(),
                shard_id + 1,
                shard_count
            ),
            true,
        )
        .field(
            "🕐 Timestamp",
            format!(
                "> `Measured:` <t:{}:f> (<t:{}:R>)",
                timestamp.unix_timestamp(),
                timestamp.unix_timestamp()
            ),
            false,
        )
        .footer(CreateEmbedFooter::new("Zen • Latency Monitor"))
        .timestamp(timestamp)
}

fn build_row(disabled: bool) -> CreateActionRow {
    CreateActionRow::Buttons(vec![CreateButton::new(REFRESH_ID)
        .label("Refresh")
        .emoji('🔄')
        .style(ButtonStyle::Secondary)
        .disabled(disabled)])
}

fn memory_usage_mb() -> f64 {
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        fs::read_to_string("/proc/self/statm")
            .ok()
            .and_then(|s| s.split_whitespace().nth(1)?.parse::<u64>().ok())
            .map(|pages| (pages * 4096) as f64 / 1024.0 / 1024.0)
            .unwrap_or(0.0)
    }
    #[cfg(target_os = "windows")]
    {
        0.0
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        0.0
    }
}

pub fn init_start_time() {
    let _ = START_TIME.set(Instant::now());
}
