use anyhow::Result;
use serenity::all::{
    ButtonStyle, ChannelId, Colour, CommandInteraction, CommandOptionType, ComponentInteraction,
    Context, CreateActionRow, CreateButton, CreateCommand, CreateCommandOption, CreateEmbed,
    CreateEmbedAuthor, CreateEmbedFooter, CreateInteractionResponse,
    CreateInteractionResponseMessage, EditInteractionResponse, GetMessages, MessageId, Permissions,
    Timestamp, UserId,
};
use tracing::{debug, warn};

pub const NAME: &str = "clear";
pub const PREFIX: &str = "clear:";

const ACTION_CONFIRM: &str = "confirm";
const ACTION_CANCEL: &str = "cancel";

const AMOUNT_OPTION: &str = "amount";
const USER_OPTION: &str = "user";
const INCLUDE_PINNED_OPTION: &str = "include_pinned";
const MAX_MESSAGES_PER_RUN: usize = 100;
const MAX_SCAN_MESSAGES: usize = 1000;
const BULK_DELETE_WINDOW_SECS: i64 = 14 * 24 * 60 * 60;

#[derive(Clone, Copy, Debug)]
struct ClearOptions {
    amount: usize,
    target_user: Option<UserId>,
    include_pinned: bool,
}

#[derive(Debug)]
struct CollectedMessages {
    ids: Vec<MessageId>,
    scanned: usize,
}

#[derive(Default, Debug)]
struct DeleteOutcome {
    deleted: usize,
    failed: usize,
    older_than_bulk_window: usize,
}

#[derive(Clone, Copy, Debug)]
struct ClearComponentPayload {
    action: ClearAction,
    invoker_id: UserId,
    options: ClearOptions,
}

#[derive(Clone, Copy, Debug)]
enum ClearAction {
    Confirm,
    Cancel,
}

impl ClearAction {
    fn as_str(self) -> &'static str {
        match self {
            Self::Confirm => ACTION_CONFIRM,
            Self::Cancel => ACTION_CANCEL,
        }
    }
}

pub fn register() -> CreateCommand {
    CreateCommand::new(NAME)
        .description("Delete recent messages with safety checks and filters.")
        .default_member_permissions(Permissions::MANAGE_MESSAGES)
        .add_option(
            CreateCommandOption::new(
                CommandOptionType::Integer,
                AMOUNT_OPTION,
                "Number of messages to delete (1-100)",
            )
            .required(true)
            .min_int_value(1)
            .max_int_value(MAX_MESSAGES_PER_RUN as u64),
        )
        .add_option(
            CreateCommandOption::new(
                CommandOptionType::User,
                USER_OPTION,
                "Only delete messages from this user",
            )
            .required(false),
        )
        .add_option(
            CreateCommandOption::new(
                CommandOptionType::Boolean,
                INCLUDE_PINNED_OPTION,
                "Include pinned messages (default: false)",
            )
            .required(false),
        )
}

pub async fn run(ctx: &Context, cmd: &CommandInteraction) -> Result<()> {
    cmd.defer_ephemeral(ctx).await?;

    if cmd.guild_id.is_none() {
        return respond_with_embed(
            ctx,
            cmd,
            build_error_embed(
                ctx,
                "This command is server-only.",
                "Use `/clear` inside a server text channel or thread.",
                Timestamp::now(),
            ),
        )
        .await;
    }

    let invoker_permissions = cmd
        .member
        .as_ref()
        .and_then(|member| member.permissions)
        .unwrap_or_else(Permissions::empty);

    if !invoker_permissions.contains(Permissions::MANAGE_MESSAGES) {
        return respond_with_embed(
            ctx,
            cmd,
            build_error_embed(
                ctx,
                "Missing permission",
                "You need `Manage Messages` to use this command.",
                Timestamp::now(),
            ),
        )
        .await;
    }

    let bot_permissions = cmd.app_permissions.unwrap_or_else(Permissions::empty);
    let required_bot_permissions = Permissions::VIEW_CHANNEL
        | Permissions::READ_MESSAGE_HISTORY
        | Permissions::MANAGE_MESSAGES;

    if !bot_permissions.contains(required_bot_permissions) {
        let missing_permissions = missing_bot_permissions(bot_permissions).join(", ");
        return respond_with_embed(
            ctx,
            cmd,
            build_error_embed(
                ctx,
                "Bot is missing channel permissions",
                &format!(
                    "I need the following permissions here: `{}`.",
                    missing_permissions
                ),
                Timestamp::now(),
            ),
        )
        .await;
    }

    let options = parse_options(cmd);
    let preview = match collect_message_ids(ctx, cmd.channel_id, options).await {
        Ok(collected) => collected,
        Err(error) => {
            warn!(error = %error, channel_id = %cmd.channel_id, "Failed to collect messages for clear command preview");
            return respond_with_embed(
                ctx,
                cmd,
                build_error_embed(
                    ctx,
                    "Unable to read channel history",
                    "Please try again in a few seconds. If it keeps failing, verify my channel permissions.",
                    Timestamp::now(),
                ),
            )
            .await;
        }
    };

    if preview.ids.is_empty() {
        return respond_with_embed(
            ctx,
            cmd,
            build_info_embed(
                ctx,
                "No messages matched your filters.",
                &format!(
                    "I scanned **{}** recent messages but found nothing to delete.",
                    preview.scanned
                ),
                Timestamp::now(),
            ),
        )
        .await;
    }

    let timestamp = Timestamp::now();

    cmd.edit_response(
        ctx,
        EditInteractionResponse::new()
            .embed(build_confirmation_embed(
                ctx,
                cmd.channel_id,
                cmd.user.id,
                options,
                &preview,
                timestamp,
            ))
            .components(vec![build_confirmation_row(cmd.user.id, options)]),
    )
    .await?;

    debug!(
        requested = options.amount,
        preview_matched = preview.ids.len(),
        preview_scanned = preview.scanned,
        target_user = ?options.target_user,
        include_pinned = options.include_pinned,
        "Clear confirmation prompt sent"
    );

    Ok(())
}

pub async fn handle_component(ctx: &Context, component: &ComponentInteraction) -> Result<()> {
    let Some(payload) = parse_component_payload(&component.data.custom_id) else {
        return Ok(());
    };

    if component.user.id != payload.invoker_id {
        component
            .create_response(
                ctx,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content(
                            "Only the moderator who initiated this clear can use these buttons.",
                        )
                        .ephemeral(true),
                ),
            )
            .await?;
        return Ok(());
    }

    component
        .create_response(ctx, CreateInteractionResponse::Acknowledge)
        .await?;

    if matches!(payload.action, ClearAction::Cancel) {
        component
            .edit_response(
                ctx,
                EditInteractionResponse::new()
                    .embed(build_cancelled_embed(
                        ctx,
                        component.channel_id,
                        component.user.id,
                        payload.options,
                        Timestamp::now(),
                    ))
                    .components(vec![]),
            )
            .await?;

        debug!(
            requested = payload.options.amount,
            target_user = ?payload.options.target_user,
            include_pinned = payload.options.include_pinned,
            "Clear command cancelled"
        );

        return Ok(());
    }

    if component.guild_id.is_none() {
        return edit_component_with_embed(
            ctx,
            component,
            build_error_embed(
                ctx,
                "This confirmation is no longer valid",
                "The command context is not available anymore.",
                Timestamp::now(),
            ),
        )
        .await;
    }

    let invoker_permissions = component
        .member
        .as_ref()
        .and_then(|member| member.permissions)
        .unwrap_or_else(Permissions::empty);

    if !invoker_permissions.contains(Permissions::MANAGE_MESSAGES) {
        return edit_component_with_embed(
            ctx,
            component,
            build_error_embed(
                ctx,
                "Missing permission",
                "You need `Manage Messages` to confirm this action.",
                Timestamp::now(),
            ),
        )
        .await;
    }

    let bot_permissions = component.app_permissions.unwrap_or_else(Permissions::empty);
    let required_bot_permissions = Permissions::VIEW_CHANNEL
        | Permissions::READ_MESSAGE_HISTORY
        | Permissions::MANAGE_MESSAGES;

    if !bot_permissions.contains(required_bot_permissions) {
        let missing_permissions = missing_bot_permissions(bot_permissions).join(", ");
        return edit_component_with_embed(
            ctx,
            component,
            build_error_embed(
                ctx,
                "Bot is missing channel permissions",
                &format!(
                    "I need the following permissions here: `{}`.",
                    missing_permissions
                ),
                Timestamp::now(),
            ),
        )
        .await;
    }

    let options = payload.options;
    let collected = match collect_message_ids(ctx, component.channel_id, options).await {
        Ok(collected) => collected,
        Err(error) => {
            warn!(error = %error, channel_id = %component.channel_id, "Failed to collect messages for clear execution");
            return edit_component_with_embed(
                ctx,
                component,
                build_error_embed(
                    ctx,
                    "Unable to read channel history",
                    "Please try again in a few seconds.",
                    Timestamp::now(),
                ),
            )
            .await;
        }
    };

    if collected.ids.is_empty() {
        return edit_component_with_embed(
            ctx,
            component,
            build_info_embed(
                ctx,
                "Nothing to delete anymore",
                "No messages currently match this request.",
                Timestamp::now(),
            )
            .field(
                "🧠 Scan details",
                format!("> `Scanned:` **{}** messages", collected.scanned),
                false,
            ),
        )
        .await;
    }

    let report_timestamp = Timestamp::now();
    let outcome =
        delete_messages(ctx, component.channel_id, &collected.ids, report_timestamp).await;

    debug!(
        requested = options.amount,
        matched = collected.ids.len(),
        deleted = outcome.deleted,
        failed = outcome.failed,
        scanned = collected.scanned,
        target_user = ?options.target_user,
        include_pinned = options.include_pinned,
        "Clear command executed"
    );

    edit_component_with_embed(
        ctx,
        component,
        build_success_embed(
            ctx,
            component.channel_id,
            component.user.id,
            options,
            &collected,
            &outcome,
            report_timestamp,
        ),
    )
    .await
}

async fn respond_with_embed(
    ctx: &Context,
    cmd: &CommandInteraction,
    embed: CreateEmbed,
) -> Result<()> {
    cmd.edit_response(ctx, EditInteractionResponse::new().embed(embed))
        .await?;
    Ok(())
}

async fn edit_component_with_embed(
    ctx: &Context,
    component: &ComponentInteraction,
    embed: CreateEmbed,
) -> Result<()> {
    component
        .edit_response(
            ctx,
            EditInteractionResponse::new()
                .embed(embed)
                .components(vec![]),
        )
        .await?;
    Ok(())
}

fn parse_options(cmd: &CommandInteraction) -> ClearOptions {
    let mut options = ClearOptions {
        amount: 10,
        target_user: None,
        include_pinned: false,
    };

    for option in &cmd.data.options {
        match option.name.as_str() {
            AMOUNT_OPTION => {
                if let Some(value) = option.value.as_i64() {
                    options.amount = value.clamp(1, MAX_MESSAGES_PER_RUN as i64) as usize;
                }
            }
            USER_OPTION => {
                options.target_user = option.value.as_user_id();
            }
            INCLUDE_PINNED_OPTION => {
                if let Some(value) = option.value.as_bool() {
                    options.include_pinned = value;
                }
            }
            _ => {}
        }
    }

    options
}

fn build_confirmation_row(invoker_id: UserId, options: ClearOptions) -> CreateActionRow {
    CreateActionRow::Buttons(vec![
        CreateButton::new(build_component_id(
            ClearAction::Confirm,
            invoker_id,
            options,
        ))
        .label("Confirm")
        .emoji('✅')
        .style(ButtonStyle::Danger),
        CreateButton::new(build_component_id(ClearAction::Cancel, invoker_id, options))
            .label("Cancel")
            .emoji('✖')
            .style(ButtonStyle::Secondary),
    ])
}

fn build_component_id(action: ClearAction, invoker_id: UserId, options: ClearOptions) -> String {
    format!(
        "{}{}:{}:{}:{}:{}",
        PREFIX,
        action.as_str(),
        invoker_id.get(),
        options.amount,
        u8::from(options.include_pinned),
        options.target_user.map(UserId::get).unwrap_or(0)
    )
}

fn parse_component_payload(custom_id: &str) -> Option<ClearComponentPayload> {
    let payload = custom_id.strip_prefix(PREFIX)?;
    let mut parts = payload.split(':');

    let action = match parts.next()? {
        ACTION_CONFIRM => ClearAction::Confirm,
        ACTION_CANCEL => ClearAction::Cancel,
        _ => return None,
    };

    let invoker_id = UserId::new(parts.next()?.parse().ok()?);

    let amount: usize = parts.next()?.parse().ok()?;
    if !(1..=MAX_MESSAGES_PER_RUN).contains(&amount) {
        return None;
    }

    let include_pinned = match parts.next()? {
        "0" => false,
        "1" => true,
        _ => return None,
    };

    let target_raw: u64 = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }

    let target_user = if target_raw == 0 {
        None
    } else {
        Some(UserId::new(target_raw))
    };

    Some(ClearComponentPayload {
        action,
        invoker_id,
        options: ClearOptions {
            amount,
            target_user,
            include_pinned,
        },
    })
}

async fn collect_message_ids(
    ctx: &Context,
    channel_id: ChannelId,
    options: ClearOptions,
) -> Result<CollectedMessages> {
    let mut ids = Vec::with_capacity(options.amount);
    let mut scanned = 0usize;
    let mut before = None;

    while ids.len() < options.amount && scanned < MAX_SCAN_MESSAGES {
        let limit = (MAX_SCAN_MESSAGES - scanned).min(100) as u8;
        if limit == 0 {
            break;
        }

        let mut builder = GetMessages::new().limit(limit);
        if let Some(before_id) = before {
            builder = builder.before(before_id);
        }

        let messages = channel_id.messages(ctx, builder).await?;
        if messages.is_empty() {
            break;
        }

        before = messages.last().map(|message| message.id);
        scanned += messages.len();

        for message in messages {
            if !options.include_pinned && message.pinned {
                continue;
            }

            if let Some(target_user) = options.target_user {
                if message.author.id != target_user {
                    continue;
                }
            }

            ids.push(message.id);
            if ids.len() >= options.amount {
                break;
            }
        }
    }

    Ok(CollectedMessages { ids, scanned })
}

async fn delete_messages(
    ctx: &Context,
    channel_id: ChannelId,
    message_ids: &[MessageId],
    now: Timestamp,
) -> DeleteOutcome {
    let mut outcome = DeleteOutcome::default();
    let cutoff = now.unix_timestamp() - BULK_DELETE_WINDOW_SECS;

    let (recent_ids, older_ids): (Vec<_>, Vec<_>) = message_ids
        .iter()
        .copied()
        .partition(|message_id| message_id.created_at().unix_timestamp() >= cutoff);

    outcome.older_than_bulk_window = older_ids.len();

    if !recent_ids.is_empty() {
        if channel_id.delete_messages(ctx, &recent_ids).await.is_ok() {
            outcome.deleted += recent_ids.len();
        } else {
            warn!(
                count = recent_ids.len(),
                "Bulk delete failed, retrying per message"
            );
            for message_id in recent_ids {
                if channel_id.delete_message(ctx, message_id).await.is_ok() {
                    outcome.deleted += 1;
                } else {
                    outcome.failed += 1;
                }
            }
        }
    }

    for message_id in older_ids {
        if channel_id.delete_message(ctx, message_id).await.is_ok() {
            outcome.deleted += 1;
        } else {
            outcome.failed += 1;
        }
    }

    outcome
}

fn build_confirmation_embed(
    ctx: &Context,
    channel_id: ChannelId,
    invoker_id: UserId,
    options: ClearOptions,
    preview: &CollectedMessages,
    timestamp: Timestamp,
) -> CreateEmbed {
    let older_than_window = count_older_than_bulk_window(&preview.ids, timestamp);

    build_embed_shell(
        ctx,
        "⚠️ Confirm clear",
        "This action permanently deletes messages and cannot be undone.",
        Colour::from_rgb(254, 231, 92),
        timestamp,
    )
    .field(
        "📍 Context",
        format!(
            "> `Channel:` <#{}>\n> `Requested by:` <@{}>",
            channel_id.get(),
            invoker_id.get()
        ),
        false,
    )
    .field(
        "🔎 Filters",
        format!(
            "> `User:` **{}**\n> `Pinned:` **{}**",
            format_target_user(options.target_user),
            if options.include_pinned {
                "Included"
            } else {
                "Excluded"
            }
        ),
        false,
    )
    .field(
        "📊 Preview",
        format!(
            "> `Requested:` **{}**\n> `Matched now:` **{}**\n> `Scanned:` **{}**\n> `Older than 14d:` **{}**",
            options.amount,
            preview.ids.len(),
            preview.scanned,
            older_than_window
        ),
        false,
    )
    .field(
        "✅ Next step",
        "> Click **Confirm** to execute deletion, or **Cancel** to abort.",
        false,
    )
}

fn build_success_embed(
    ctx: &Context,
    channel_id: ChannelId,
    invoker_id: UserId,
    options: ClearOptions,
    collected: &CollectedMessages,
    outcome: &DeleteOutcome,
    timestamp: Timestamp,
) -> CreateEmbed {
    let color = if outcome.failed == 0 {
        Colour::from_rgb(87, 242, 135)
    } else {
        Colour::from_rgb(230, 126, 34)
    };

    build_embed_shell(
        ctx,
        if outcome.failed == 0 {
            "🧹 Clear complete"
        } else {
            "🧹 Clear complete with warnings"
        },
        "Channel cleanup finished.",
        color,
        timestamp,
    )
    .field(
        "📊 Result",
        format!(
            "> `Requested:` **{}**\n> `Matched:` **{}**\n> `Deleted:` **{}**\n> `Failed:` **{}**",
            options.amount,
            collected.ids.len(),
            outcome.deleted,
            outcome.failed
        ),
        false,
    )
    .field(
        "🔎 Filters",
        format!(
            "> `User:` **{}**\n> `Pinned:` **{}**",
            format_target_user(options.target_user),
            if options.include_pinned {
                "Included"
            } else {
                "Excluded"
            }
        ),
        false,
    )
    .field(
        "🧠 Scan details",
        format!(
            "> `Channel:` <#{}>\n> `Moderator:` <@{}>\n> `Scanned:` **{}** messages\n> `Older than 14d:` **{}**",
            channel_id.get(),
            invoker_id.get(),
            collected.scanned,
            outcome.older_than_bulk_window
        ),
        false,
    )
}

fn build_cancelled_embed(
    ctx: &Context,
    channel_id: ChannelId,
    invoker_id: UserId,
    options: ClearOptions,
    timestamp: Timestamp,
) -> CreateEmbed {
    build_info_embed(
        ctx,
        "❎ Clear cancelled",
        "No messages were deleted.",
        timestamp,
    )
    .field(
        "📍 Context",
        format!(
            "> `Channel:` <#{}>\n> `Moderator:` <@{}>",
            channel_id.get(),
            invoker_id.get()
        ),
        false,
    )
    .field(
        "🔎 Request",
        format!(
            "> `Requested:` **{}**\n> `User:` **{}**\n> `Pinned:` **{}**",
            options.amount,
            format_target_user(options.target_user),
            if options.include_pinned {
                "Included"
            } else {
                "Excluded"
            }
        ),
        false,
    )
}

fn build_info_embed(
    ctx: &Context,
    title: &str,
    description: &str,
    timestamp: Timestamp,
) -> CreateEmbed {
    build_embed_shell(
        ctx,
        title,
        description,
        Colour::from_rgb(254, 231, 92),
        timestamp,
    )
}

fn build_error_embed(
    ctx: &Context,
    title: &str,
    description: &str,
    timestamp: Timestamp,
) -> CreateEmbed {
    build_embed_shell(
        ctx,
        title,
        description,
        Colour::from_rgb(237, 66, 69),
        timestamp,
    )
}

fn build_embed_shell(
    ctx: &Context,
    title: &str,
    description: &str,
    color: Colour,
    timestamp: Timestamp,
) -> CreateEmbed {
    let current_user = ctx.cache.current_user().clone();
    let avatar_url = current_user
        .avatar_url()
        .unwrap_or_else(|| current_user.default_avatar_url());

    CreateEmbed::new()
        .author(CreateEmbedAuthor::new("Moderation • Clear").icon_url(&avatar_url))
        .title(title)
        .description(description)
        .thumbnail(&avatar_url)
        .color(color)
        .footer(CreateEmbedFooter::new("Zen • Moderation").icon_url(&avatar_url))
        .timestamp(timestamp)
}

fn count_older_than_bulk_window(message_ids: &[MessageId], now: Timestamp) -> usize {
    let cutoff = now.unix_timestamp() - BULK_DELETE_WINDOW_SECS;
    message_ids
        .iter()
        .filter(|message_id| message_id.created_at().unix_timestamp() < cutoff)
        .count()
}

fn format_target_user(target_user: Option<UserId>) -> String {
    match target_user {
        Some(user_id) => format!("<@{}>", user_id.get()),
        None => "Any user".to_string(),
    }
}

fn missing_bot_permissions(bot_permissions: Permissions) -> Vec<&'static str> {
    let mut missing = Vec::new();

    if !bot_permissions.contains(Permissions::VIEW_CHANNEL) {
        missing.push("View Channel");
    }
    if !bot_permissions.contains(Permissions::READ_MESSAGE_HISTORY) {
        missing.push("Read Message History");
    }
    if !bot_permissions.contains(Permissions::MANAGE_MESSAGES) {
        missing.push("Manage Messages");
    }

    missing
}
