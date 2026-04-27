import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';

import { defineSlashCommand } from '../types.js';

export const serverInfoCommand = defineSlashCommand({
  data: new SlashCommandBuilder()
    .setName('server-info')
    .setDescription('Show information about this server.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = interaction.guild;

    if (guild === null) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const owner = await guild.fetchOwner();
    const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(0x2f80ed)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: 'Server ID', value: guild.id, inline: true },
        { name: 'Owner', value: owner.user.tag, inline: true },
        { name: 'Members', value: `${guild.memberCount}`, inline: true },
        { name: 'Created', value: `<t:${createdTimestamp}:F>`, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
});
