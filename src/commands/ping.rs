use std::sync::OnceLock;
use std::time::{Duration, Instant};

use anyhow::Result;
use serenity::all::{
    ButtonStyle, Colour, CommandInteraction, ComponentInteraction, Context, CreateActionRow,
    CreateButton, CreateCommand, CreateEmbed, CreateEmbedAuthor, CreateEmbedFooter,
    CreateInteractionResponse, EditInteractionResponse, InstallationContext, InteractionContext,
    Timestamp,
};
use tracing::debug;

use crate::data::ShardManagerContainer;

static START_TIME: OnceLock<Instant> = OnceLock::new();

pub const NAME: &str = "ping";
pub const PREFIX: &str = "ping:";
const REFRESH_ID: &str = "ping:refresh";

pub fn register() -> CreateCommand {
    CreateCommand::new(NAME)
        .description("Displays WebSocket gateway and REST API latency diagnostics.")
        .name_localized("id", "ping")
        .name_localized("da", "ping")
        .name_localized("de", "ping")
        .name_localized("en-GB", "ping")
        .name_localized("en-US", "ping")
        .name_localized("es-ES", "ping")
        .name_localized("es-419", "ping")
        .name_localized("fr", "ping")
        .name_localized("hr", "ping")
        .name_localized("it", "ping")
        .name_localized("lt", "ping")
        .name_localized("hu", "ping")
        .name_localized("nl", "ping")
        .name_localized("no", "ping")
        .name_localized("pl", "ping")
        .name_localized("pt-BR", "ping")
        .name_localized("ro", "ping")
        .name_localized("fi", "ping")
        .name_localized("sv-SE", "ping")
        .name_localized("vi", "ping")
        .name_localized("tr", "ping")
        .name_localized("cs", "ping")
        .name_localized("el", "ping")
        .name_localized("bg", "ping")
        .name_localized("ru", "ping")
        .name_localized("uk", "ping")
        .name_localized("hi", "ping")
        .name_localized("th", "ping")
        .name_localized("zh-CN", "ping")
        .name_localized("ja", "ping")
        .name_localized("zh-TW", "ping")
        .name_localized("ko", "ping")
        .description_localized(
            "id",
            "Menampilkan diagnostik latensi WebSocket gateway dan REST API.",
        )
        .description_localized(
            "da",
            "Viser WebSocket-gateway og REST API-latensdiagnostik.",
        )
        .description_localized(
            "de",
            "Zeigt Latenzdiagnosen für WebSocket-Gateway und REST-API an.",
        )
        .description_localized(
            "en-GB",
            "Displays WebSocket gateway and REST API latency diagnostics.",
        )
        .description_localized(
            "en-US",
            "Displays WebSocket gateway and REST API latency diagnostics.",
        )
        .description_localized(
            "es-ES",
            "Muestra diagnósticos de latencia del gateway WebSocket y la API REST.",
        )
        .description_localized(
            "es-419",
            "Muestra diagnósticos de latencia del gateway WebSocket y la API REST.",
        )
        .description_localized(
            "fr",
            "Affiche les diagnostics de latence du gateway WebSocket et de l'API REST.",
        )
        .description_localized(
            "hr",
            "Prikazuje dijagnostiku latencije WebSocket gatewaya i REST API-ja.",
        )
        .description_localized(
            "it",
            "Mostra la diagnostica della latenza del gateway WebSocket e dell'API REST.",
        )
        .description_localized(
            "lt",
            "Rodo WebSocket tinklų sietuvo ir REST API delsos diagnostiką.",
        )
        .description_localized(
            "hu",
            "Megjeleníti a WebSocket átjáró és REST API késleltetési diagnosztikáját.",
        )
        .description_localized(
            "nl",
            "Toont WebSocket-gateway en REST API-latentiediagnostiek.",
        )
        .description_localized(
            "no",
            "Viser diagnostikk for WebSocket-gateway og REST API-latens.",
        )
        .description_localized(
            "pl",
            "Wyświetla diagnostykę opóźnień bramy WebSocket i interfejsu REST API.",
        )
        .description_localized(
            "pt-BR",
            "Exibe diagnósticos de latência do gateway WebSocket e da API REST.",
        )
        .description_localized(
            "ro",
            "Afișează diagnosticarea latenței gateway-ului WebSocket și API-ului REST.",
        )
        .description_localized(
            "fi",
            "Näyttää WebSocket-yhdyskäytävän ja REST API:n latenssin diagnostiikan.",
        )
        .description_localized(
            "sv-SE",
            "Visar latensdiagnostik för WebSocket-gateway och REST API.",
        )
        .description_localized(
            "vi",
            "Hiển thị chẩn đoán độ trễ cổng WebSocket và REST API.",
        )
        .description_localized(
            "tr",
            "WebSocket ağ geçidi ve REST API gecikme tanılamalarını görüntüler.",
        )
        .description_localized(
            "cs",
            "Zobrazuje diagnostiku latence WebSocket brány a REST API.",
        )
        .description_localized(
            "el",
            "Εμφανίζει διαγνωστικά καθυστέρησης πύλης WebSocket και REST API.",
        )
        .description_localized(
            "bg",
            "Показва диагностика на латентността на WebSocket шлюза и REST API.",
        )
        .description_localized(
            "ru",
            "Отображает диагностику задержки шлюза WebSocket и REST API.",
        )
        .description_localized(
            "uk",
            "Відображає діагностику затримки шлюзу WebSocket та REST API.",
        )
        .description_localized(
            "hi",
            "WebSocket गेटवे और REST API विलंबता निदान प्रदर्शित करता है।",
        )
        .description_localized(
            "th",
            "แสดงการวินิจฉัยความหน่วงของ WebSocket gateway และ REST API",
        )
        .description_localized("zh-CN", "显示 WebSocket 网关和 REST API 延迟诊断。")
        .description_localized(
            "ja",
            "WebSocketゲートウェイとREST APIのレイテンシ診断を表示します。",
        )
        .description_localized("zh-TW", "顯示 WebSocket 閘道和 REST API 延遲診斷。")
        .description_localized(
            "ko",
            "WebSocket 게이트웨이 및 REST API 지연 시간 진단을 표시합니다.",
        )
        .integration_types(vec![InstallationContext::Guild, InstallationContext::User])
        .contexts(vec![
            InteractionContext::Guild,
            InteractionContext::BotDm,
            InteractionContext::PrivateChannel,
        ])
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

fn build_embed(
    ctx: &Context,
    ws_latency: Duration,
    rest_latency: Duration,
    timestamp: Timestamp,
) -> CreateEmbed {
    let ws_ms = ws_latency.as_millis() as u64;
    let rest_ms = rest_latency.as_millis() as u64;
    let avg_ms = (ws_ms + rest_ms) / 2;

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
