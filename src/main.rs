mod commands;
mod config;
mod data;
mod handler;

use anyhow::Result;
use serenity::prelude::*;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

use crate::config::Config;
use crate::data::ShardManagerContainer;
use crate::handler::Handler;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,zen=debug")),
        )
        .compact()
        .init();

    commands::ping::init_start_time();

    let config = Config::from_env()?;

    let intents = GatewayIntents::all();

    let mut client = Client::builder(&config.discord_token, intents)
        .event_handler(Handler {
            guild_id: config.guild_id,
        })
        .await?;

    {
        let mut data = client.data.write().await;
        data.insert::<ShardManagerContainer>(client.shard_manager.clone());
    }

    info!("Starting bot...");

    tokio::select! {
        result = client.start() => {
            if let Err(e) = result {
                error!(error = %e, "Client error");
            }
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Received shutdown signal");
        }
    }

    info!("Shutting down");
    Ok(())
}
