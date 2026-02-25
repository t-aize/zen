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
use crate::locales::Locales;

static START_TIME: OnceLock<Instant> = OnceLock::new();

pub const NAME: &str = "ping";
pub const PREFIX: &str = "ping:";
const REFRESH_ID: &str = "ping:refresh";

pub fn register() -> CreateCommand {
    const DEFAULT_DESCRIPTION: &'static str =
        "Displays WebSocket gateway and REST API latency diagnostics.";
    const DESCRIPTION_LOCALES: &[(Locales, &str)] = &[
        (
            Locales::Id,
            "Menampilkan diagnostik latensi WebSocket gateway dan REST API.",
        ),
        (
            Locales::Da,
            "Viser WebSocket-gateway og REST API-latensdiagnostik.",
        ),
        (
            Locales::De,
            "Zeigt Latenzdiagnosen für WebSocket-Gateway und REST-API an.",
        ),
        (
            Locales::EnGb,
            "Displays WebSocket gateway and REST API latency diagnostics.",
        ),
        (
            Locales::EnUs,
            "Displays WebSocket gateway and REST API latency diagnostics.",
        ),
        (
            Locales::EsEs,
            "Muestra diagnósticos de latencia del gateway WebSocket y la API REST.",
        ),
        (
            Locales::Es419,
            "Muestra diagnósticos de latencia del gateway WebSocket y la API REST.",
        ),
        (
            Locales::Fr,
            "Affiche les diagnostics de latence du gateway WebSocket et de l'API REST.",
        ),
        (
            Locales::Hr,
            "Prikazuje dijagnostiku latencije WebSocket gatewaya i REST API-ja.",
        ),
        (
            Locales::It,
            "Mostra la diagnostica della latenza del gateway WebSocket e dell'API REST.",
        ),
        (
            Locales::Lt,
            "Rodo WebSocket tinklų sietuvo ir REST API delsos diagnostiką.",
        ),
        (
            Locales::Hu,
            "Megjeleníti a WebSocket átjáró és REST API késleltetési diagnosztikáját.",
        ),
        (
            Locales::Nl,
            "Toont WebSocket-gateway en REST API-latentiediagnostiek.",
        ),
        (
            Locales::No,
            "Viser diagnostikk for WebSocket-gateway og REST API-latens.",
        ),
        (
            Locales::Pl,
            "Wyświetla diagnostykę opóźnień bramy WebSocket i interfejsu REST API.",
        ),
        (
            Locales::PtBr,
            "Exibe diagnósticos de latência do gateway WebSocket e da API REST.",
        ),
        (
            Locales::Ro,
            "Afișează diagnosticarea latenței gateway-ului WebSocket și API-ului REST.",
        ),
        (
            Locales::Fi,
            "Näyttää WebSocket-yhdyskäytävän ja REST API:n latenssin diagnostiikan.",
        ),
        (
            Locales::SvSe,
            "Visar latensdiagnostik för WebSocket-gateway och REST API.",
        ),
        (
            Locales::Vi,
            "Hiển thị chẩn đoán độ trễ cổng WebSocket và REST API.",
        ),
        (
            Locales::Tr,
            "WebSocket ağ geçidi ve REST API gecikme tanılamalarını görüntüler.",
        ),
        (
            Locales::Cs,
            "Zobrazuje diagnostiku latence WebSocket brány a REST API.",
        ),
        (
            Locales::El,
            "Εμφανίζει διαγνωστικά καθυστέρησης πύλης WebSocket και REST API.",
        ),
        (
            Locales::Bg,
            "Показва диагностика на латентността на WebSocket шлюза и REST API.",
        ),
        (
            Locales::Ru,
            "Отображает диагностику задержки шлюза WebSocket и REST API.",
        ),
        (
            Locales::Uk,
            "Відображає діагностику затримки шлюзу WebSocket та REST API.",
        ),
        (
            Locales::Hi,
            "WebSocket गेटवे और REST API विलंबता निदान प्रदर्शित करता है।",
        ),
        (
            Locales::Th,
            "แสดงการวินิจฉัยความหน่วงของ WebSocket gateway และ REST API",
        ),
        (Locales::ZhCn, "显示 WebSocket 网关和 REST API 延迟诊断。"),
        (
            Locales::Ja,
            "WebSocketゲートウェイとREST APIのレイテンシ診断を表示します。",
        ),
        (Locales::ZhTw, "顯示 WebSocket 閘道和 REST API 延遲診斷。"),
        (
            Locales::Ko,
            "WebSocket 게이트웨이 및 REST API 지연 시간 진단을 표시합니다.",
        ),
    ];

    let mut cmd = CreateCommand::new(NAME)
        .description(DEFAULT_DESCRIPTION)
        .integration_types(vec![InstallationContext::Guild, InstallationContext::User])
        .contexts(vec![
            InteractionContext::Guild,
            InteractionContext::BotDm,
            InteractionContext::PrivateChannel,
        ]);

    for locale in Locales::ALL {
        cmd = cmd.name_localized(locale.code(), NAME);
    }

    for &(locale, description) in DESCRIPTION_LOCALES {
        cmd = cmd.description_localized(locale.code(), description);
    }

    cmd
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
