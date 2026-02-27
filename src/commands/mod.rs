pub mod moderation;
pub mod utility;

use anyhow::Result;
use serenity::all::{CommandInteraction, ComponentInteraction, Context, CreateCommand};
use tracing::instrument;

pub fn register_all() -> Vec<CreateCommand> {
    vec![utility::ping::register(), moderation::clear::register()]
}

pub fn init() {
    utility::ping::init_start_time();
}

#[instrument(skip_all, fields(command = %cmd.data.name))]
pub async fn handle_command(ctx: &Context, cmd: &CommandInteraction) -> Result<()> {
    match cmd.data.name.as_str() {
        utility::ping::NAME => utility::ping::run(ctx, cmd).await,
        moderation::clear::NAME => moderation::clear::run(ctx, cmd).await,
        _ => Ok(()),
    }
}

#[instrument(skip_all, fields(custom_id = %component.data.custom_id))]
pub async fn handle_component(ctx: &Context, component: &ComponentInteraction) -> Result<()> {
    let custom_id = &component.data.custom_id;

    if custom_id.starts_with(utility::ping::PREFIX) {
        return utility::ping::handle_component(ctx, component).await;
    }

    if custom_id.starts_with(moderation::clear::PREFIX) {
        return moderation::clear::handle_component(ctx, component).await;
    }

    Ok(())
}
