const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const lockState = require('../../utils/lock-state');

const botAdminRoleId = process.env.BOT_ADMIN_ROLE_ID;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lock')
		.setDescription('Locks the bot to prevent further commands until unlocked.'),

	async execute(interaction) {
		const userId = interaction.user.id;

		if (lockState.isLocked) {
			await interaction.reply({
				content: 'The bot is already locked.'
			});
			return;
		}

		if (!interaction.member.roles.cache.has(botAdminRoleId)) {
			await interaction.reply({
				content: 'You do not have permission to use this command.'
			});
			return;
		}

		lockState.isLocked = true;
		lockState.lockedBy = userId;
		await interaction.reply({
			content: 'The bot has been locked. No further commands can be processed until it is unlocked.'
		});
	},
};