use std::sync::OnceLock;
use std::time::{Duration, Instant};

use anyhow::Result;
use serenity::all::{
    ButtonStyle, Colour, CommandInteraction, ComponentInteraction, Context, CreateActionRow,
    CreateButton, CreateCommand, CreateEmbed, CreateEmbedAuthor, CreateEmbedFooter,
    CreateInteractionResponse, EditInteractionResponse, Timestamp,
};
use tracing::debug;

use crate::data::ShardManagerContainer;
use crate::locales::Locales;

static START_TIME: OnceLock<Instant> = OnceLock::new();

pub const NAME: &str = "ping";
pub const PREFIX: &str = "ping:";
const REFRESH_ID: &str = "ping:refresh";

pub fn register() -> CreateCommand {
    let mut cmd = CreateCommand::new(NAME)
        .description("Displays WebSocket gateway and REST API latency diagnostics.");

    for locale in Locales::ALL {
        cmd = cmd.name_localized(locale.code(), NAME);
    }

    cmd
}

#[derive(Copy, Clone)]
struct PingSnapshot {
    ws_latency: Option<Duration>,
    rest_latency: Duration,
    measured_at: Timestamp,
}

impl PingSnapshot {
    async fn collect(ctx: &Context, start: Instant) -> Self {
        Self {
            rest_latency: start.elapsed(),
            ws_latency: get_shard_latency(ctx).await,
            measured_at: Timestamp::now(),
        }
    }
}

pub async fn run(ctx: &Context, cmd: &CommandInteraction) -> Result<()> {
    let start = Instant::now();

    cmd.defer_ephemeral(ctx).await?;

    let snapshot = PingSnapshot::collect(ctx, start).await;

    cmd.edit_response(ctx, build_response(ctx, snapshot))
        .await?;

    debug!(ws_ms = ?snapshot.ws_latency, rest_ms = ?snapshot.rest_latency, "Ping command executed");
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

    let snapshot = PingSnapshot::collect(ctx, start).await;

    component
        .edit_response(ctx, build_response(ctx, snapshot))
        .await?;

    debug!(ws_ms = ?snapshot.ws_latency, rest_ms = ?snapshot.rest_latency, "Ping refreshed");
    Ok(())
}

fn build_response(ctx: &Context, snapshot: PingSnapshot) -> EditInteractionResponse {
    EditInteractionResponse::new()
        .embed(build_embed(
            ctx,
            snapshot.ws_latency,
            snapshot.rest_latency,
            snapshot.measured_at,
        ))
        .components(vec![build_row()])
}

async fn get_shard_latency(ctx: &Context) -> Option<Duration> {
    let data = ctx.data.read().await;
    let shard_manager = data.get::<ShardManagerContainer>()?;
    let runners = shard_manager.runners.lock().await;
    runners.get(&ctx.shard_id).and_then(|runner| runner.latency)
}

fn latency_indicator(ms: u64) -> &'static str {
    match ms {
        0..=150 => "🟢",
        151..=300 => "🟡",
        301..=500 => "🟠",
        _ => "🔴",
    }
}

fn latency_status(ms: u64) -> &'static str {
    match ms {
        0..=150 => "Excellent",
        151..=300 => "Good",
        301..=500 => "Degraded",
        _ => "Poor",
    }
}

fn latency_color(ms: u64) -> Colour {
    match ms {
        0..=150 => Colour::from_rgb(87, 242, 135),
        151..=300 => Colour::from_rgb(254, 231, 92),
        301..=500 => Colour::from_rgb(230, 126, 34),
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

fn build_embed(
    ctx: &Context,
    ws_latency: Option<Duration>,
    rest_latency: Duration,
    timestamp: Timestamp,
) -> CreateEmbed {
    let rest_ms = rest_latency.as_millis() as u64;
    let ws_ms = ws_latency.map(|value| value.as_millis() as u64);
    let avg_ms = match ws_ms {
        Some(value) => (value + rest_ms) / 2,
        None => rest_ms,
    };

    let uptime = START_TIME
        .get()
        .map(|t| t.elapsed())
        .unwrap_or(Duration::ZERO);

    let current_user = ctx.cache.current_user().clone();
    let avatar_url = current_user
        .avatar_url()
        .unwrap_or_else(|| current_user.default_avatar_url());

    CreateEmbed::new()
        .author(CreateEmbedAuthor::new("Latency Monitor").icon_url(&avatar_url))
        .title("🏓 Pong!")
        .description("Real-time latency diagnostics for the bot and Discord's infrastructure.")
        .thumbnail(&avatar_url)
        .color(latency_color(avg_ms))
        .field(
            "⚡ WebSocket Gateway",
            match ws_ms {
                Some(value) => format!(
                    "> `Ping:` **{}ms**\n> `Status:` {} {}",
                    value,
                    latency_indicator(value),
                    latency_status(value)
                ),
                None => "> `Ping:` **N/A**\n> `Status:` ⚪ Waiting for heartbeat ACK".to_string(),
            },
            false,
        )
        .field(
            "🌐 REST API",
            format!(
                "> `Round-trip:` **{}ms**\n> `Status:` {} {}",
                rest_ms,
                latency_indicator(rest_ms),
                latency_status(rest_ms)
            ),
            false,
        )
        .field(
            "🤖 Bot",
            format!(
                "> `Uptime:` **{}**\n> `Memory:` **{:.1} MB**",
                format_uptime(uptime),
                memory_usage_mb()
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
            true,
        )
        .footer(CreateEmbedFooter::new("Zen • Latency Monitor").icon_url(&avatar_url))
        .timestamp(timestamp)
}

fn build_row() -> CreateActionRow {
    CreateActionRow::Buttons(vec![CreateButton::new(REFRESH_ID)
        .label("Refresh")
        .emoji('🔄')
        .style(ButtonStyle::Secondary)
        .disabled(false)])
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
