const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('status')
		.setDescription('Shows the status of connected devices.'),
	async execute(interaction) {
		const buttplugClient = interaction.client.buttplugClient;
		
		try {
			const embed = new EmbedBuilder()
				.setTitle('Device Status')
				.setColor(0x0099FF)
				.setTimestamp();
			
			if (!buttplugClient.connected) {
				embed.setDescription('❌ Not connected to Buttplug server')
					.setColor(0xFF0000);
				await interaction.reply({ embeds: [embed]});
				return;
			}
			
			embed.addFields({ name: 'Connection', value: '✅ Connected to Buttplug server', inline: false });
			
			const devices = buttplugClient.devices;
			
			if (devices.length === 0) {
				embed.addFields({ name: 'Devices', value: 'No devices connected', inline: false });
			} else {
				let deviceList = '';
				for (const device of devices) {
					const vibratorCount = device.vibrateAttributes.length;
					const rotatorCount = device.rotateAttributes.length;
					const linearCount = device.linearAttributes.length;
					
					deviceList += `• **${device.name}**\n`;
					if (vibratorCount > 0) deviceList += `  - ${vibratorCount} vibrator(s)\n`;
					if (rotatorCount > 0) deviceList += `  - ${rotatorCount} rotator(s)\n`;
					if (linearCount > 0) deviceList += `  - ${linearCount} linear actuator(s)\n`;
				}
				embed.addFields({ name: `Devices (${devices.length})`, value: deviceList, inline: false });
			}
			
			await interaction.reply({ embeds: [embed] });
			
		} catch (error) {
			console.error('Error in status command:', error);
			await interaction.reply({
				content: 'An error occurred while checking device status.'
			});
		}
	},
};
