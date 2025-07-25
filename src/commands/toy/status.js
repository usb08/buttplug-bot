const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const deviceState = require('../../utils/device-state');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('status')
		.setDescription('Shows the status of connected devices.'),

	async execute(interaction) {
		let initialReply;

		try {
			initialReply = await interaction.reply({
				content: '🔄 Getting status...',
				withResponse: true,
			});
		} catch (err) {
			console.error('Failed to send initial reply:', err);
			return;
		}

		const embed = new EmbedBuilder()
			.setTitle('Device Status')
			.setColor(0x0099FF)
			.setTimestamp();

		const buttplugClient = interaction.client?.buttplugClient;

		if (!buttplugClient || !buttplugClient.connected) {
			embed.setDescription('❌ Not connected to Buttplug server').setColor(0xFF0000);
			return interaction.editReply({ content: null, embeds: [embed] });
		}

		embed.addFields({
			name: 'Connection',
			value: '✅ Connected to Buttplug server',
		});

		if (deviceState?.isActive) {
			embed.addFields({
				name: 'Current Operation',
				value: `🔄 ${deviceState.activeCommand} command is running`,
			});
		} else {
			embed.addFields({
				name: 'Current Operation',
				value: '⏸️ No active operations',
			});
		}

		const queueLength = deviceState?.getQueueLength() || 0;
		if (queueLength > 0) {
			const queueCommands = deviceState.queue.slice(0, 3).map((cmd, index) => 
				`${index + 1}. ${cmd.type} (${cmd.username}) - ${cmd.intensity}% for ${cmd.duration}s`
			).join('\n');
			
			const queueInfo = queueLength > 3 
				? `${queueCommands}\n... and ${queueLength - 3} more`
				: queueCommands;
				
			embed.addFields({
				name: `Command Queue (${queueLength})`,
				value: queueInfo,
			});
		} else {
			embed.addFields({
				name: 'Command Queue',
				value: '📭 Queue is empty',
			});
		}

		const devices = buttplugClient.devices || [];

		if (devices.length === 0) {
			embed.addFields({
				name: 'Devices',
				value: 'No devices connected',
			});
		} else {
			const deviceDescriptions = devices.map(device => {
				const parts = [`• **${device.name}**`];
				if (device.vibrateAttributes?.length)
					parts.push(`  - ${device.vibrateAttributes.length} vibrator(s)`);
				if (device.rotateAttributes?.length)
					parts.push(`  - ${device.rotateAttributes.length} rotator(s)`);
				if (device.linearAttributes?.length)
					parts.push(`  - ${device.linearAttributes.length} linear actuator(s)`);
				return parts.join('\n');
			}).join('\n\n');

			embed.addFields({
				name: `Devices (${devices.length})`,
				value: deviceDescriptions,
			});
		}

		try {
			await interaction.editReply({
				content: null,
				embeds: [embed],
			});
		} catch (err) {
			console.error('Failed to edit reply with status:', err);
		}
	},
};