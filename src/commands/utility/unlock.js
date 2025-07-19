const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const lockState = require('../../utils/lock-state');

const botAdminRoleId = process.env.BOT_ADMIN_ROLE_ID;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unlock')
		.setDescription('Unlocks the bot to allow further commands.'),

	async execute(interaction) {
		const userId = interaction.user.id;

		if (!lockState.isLocked) {
			await interaction.reply({
				content: 'The bot is not currently locked.'
			});
			return;
		}

		if (!interaction.member.roles.cache.has(botAdminRoleId)) {
			await interaction.reply({
				content: 'You do not have permission to use this command.'
			});
			return;
		}

		lockState.isLocked = false;
		lockState.lockedBy = null;
		await interaction.reply({
			content: 'The bot has been unlocked. Further commands can now be processed.'
		});
	},
};