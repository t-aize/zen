use std::env;

use anyhow::{Context, Result};
use serenity::model::id::GuildId;

#[derive(Debug, Clone)]
pub struct Config {
    pub discord_token: String,
    pub guild_id: GuildId,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            discord_token: env::var("DISCORD_TOKEN").context("DISCORD_TOKEN must be set")?,
            guild_id: GuildId::new(
                env::var("GUILD_ID")
                    .context("GUILD_ID must be set")?
                    .parse()
                    .context("GUILD_ID must be a valid u64")?,
            ),
        })
    }
}
