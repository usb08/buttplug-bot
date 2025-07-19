const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const deviceState = require('../../utils/device-state');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription('Shows the current command queue and your usage status.'),

	async execute(interaction) {
		const userId = interaction.user.id;
		const embed = new EmbedBuilder()
			.setTitle('Command Queue Status')
			.setColor(0x0099FF)
			.setTimestamp();

		// Current operation
		if (deviceState.isActive) {
			embed.addFields({
				name: 'Currently Running',
				value: `🔄 ${deviceState.activeCommand} command`,
				inline: true
			});
		} else {
			embed.addFields({
				name: 'Currently Running',
				value: '⏸️ Nothing',
				inline: true
			});
		}

		// Queue status
		const queueLength = deviceState.getQueueLength();
		if (queueLength > 0) {
			const queueCommands = deviceState.queue.map((cmd, index) => 
				`${index + 1}. **${cmd.type}** by ${cmd.username} (${cmd.intensity}% for ${cmd.duration}s)`
			).join('\n');
			
			embed.addFields({
				name: `Queue (${queueLength} commands)`,
				value: queueCommands.length > 1024 ? queueCommands.substring(0, 1020) + '...' : queueCommands,
			});
		} else {
			embed.addFields({
				name: 'Queue',
				value: '📭 Empty',
			});
		}

		// User's command usage
		const userCount = deviceState.userCommandCounts.get(userId);
		const remainingCommands = deviceState.USER_COMMAND_LIMIT - (userCount?.count || 0);
		const now = Date.now();
		
		let userStatus = '';
		if (userCount && now - userCount.lastCommand < deviceState.USER_TIMEOUT) {
			const timeLeft = Math.ceil((deviceState.USER_TIMEOUT - (now - userCount.lastCommand)) / 1000);
			userStatus = `${remainingCommands}/${deviceState.USER_COMMAND_LIMIT} commands available\n`;
			if (remainingCommands === 0) {
				userStatus += `⏰ Reset in ${timeLeft}s`;
			}
		} else {
			userStatus = `${deviceState.USER_COMMAND_LIMIT}/${deviceState.USER_COMMAND_LIMIT} commands available`;
		}

		embed.addFields({
			name: 'Your Status',
			value: userStatus,
			inline: true
		});

		await interaction.reply({ embeds: [embed] });
	},
};
