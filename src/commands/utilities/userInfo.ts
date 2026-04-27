import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { defineSlashCommand } from '../types.js';

export const userInfoCommand = defineSlashCommand({
  data: new SlashCommandBuilder()
    .setName('user-info')
    .setDescription('Show information about a user.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to inspect.').setRequired(false),
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member =
      interaction.guild === null
        ? null
        : await interaction.guild.members.fetch(user.id).catch(() => null);
    const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
    const joinedTimestamp =
      member?.joinedTimestamp === null || member?.joinedTimestamp === undefined
        ? null
        : Math.floor(member.joinedTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(0x27ae60)
      .setTitle(user.tag)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'User ID', value: user.id, inline: true },
        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Created', value: `<t:${createdTimestamp}:F>`, inline: false },
      )
      .setTimestamp();

    if (joinedTimestamp !== null) {
      embed.addFields({ name: 'Joined', value: `<t:${joinedTimestamp}:F>`, inline: false });
    }

    await interaction.reply({ embeds: [embed] });
  },
});
