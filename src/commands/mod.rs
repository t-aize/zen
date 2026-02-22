pub mod ping;

use anyhow::Result;
use serenity::all::{CommandInteraction, ComponentInteraction, Context, CreateCommand};
use tracing::instrument;

pub fn register_all() -> Vec<CreateCommand> {
    vec![ping::register()]
}

#[instrument(skip_all, fields(command = %cmd.data.name))]
pub async fn handle_command(ctx: &Context, cmd: &CommandInteraction) -> Result<()> {
    match cmd.data.name.as_str() {
        ping::NAME => ping::run(ctx, cmd).await,
        _ => Ok(()),
    }
}

#[instrument(skip_all, fields(custom_id = %component.data.custom_id))]
pub async fn handle_component(ctx: &Context, component: &ComponentInteraction) -> Result<()> {
    let custom_id = &component.data.custom_id;

    if custom_id.starts_with(ping::PREFIX) {
        return ping::handle_component(ctx, component).await;
    }

    Ok(())
}
