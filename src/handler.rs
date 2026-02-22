use serenity::all::{Context, EventHandler, GuildId, Interaction, Ready};
use serenity::async_trait;
use tracing::{error, info, instrument};

use crate::commands;

pub struct Handler {
    pub guild_id: GuildId,
}

#[async_trait]
impl EventHandler for Handler {
    #[instrument(skip_all, fields(interaction_id = %interaction.id()))]
    async fn interaction_create(&self, ctx: Context, interaction: Interaction) {
        let result = match &interaction {
            Interaction::Command(cmd) => {
                commands::handle_command(&ctx, cmd).await
            }
            Interaction::Component(component) => {
                commands::handle_component(&ctx, component).await
            }
            _ => Ok(()),
        };

        if let Err(e) = result {
            error!(error = %e, "Failed to handle interaction");
        }
    }

    async fn ready(&self, ctx: Context, ready: Ready) {
        info!(user = %ready.user.name, "Bot connected");

        match self
            .guild_id
            .set_commands(&ctx.http, commands::register_all())
            .await
        {
            Ok(cmds) => {
                info!(count = cmds.len(), "Registered guild commands");
            }
            Err(e) => {
                error!(error = %e, "Failed to register commands");
            }
        }
    }
}
