const { SlashCommandBuilder } = require('discord.js');
const deviceState = require('../../utils/device-state');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stop')
		.setDescription('Stops all device vibrations immediately.'),
	async execute(interaction) {
		const buttplugClient = interaction.client.buttplugClient;
		
		try {
			if (!buttplugClient.connected) {
				await interaction.reply({ 
					content: 'Not connected to Buttplug server.'
				});
				return;
			}
			
			const devices = buttplugClient.devices;
			
			if (devices.length === 0) {
				await interaction.reply({ 
					content: 'No devices connected.'
				});
				return;
			}
			
			let stoppedDevices = 0;
			for (const device of devices) {
				await device.stop();
				stoppedDevices++;
			}

			const queueSize = deviceState.getQueueLength();
			deviceState.clearAll();
			
			let message = `Stopped ${stoppedDevices} device(s).`;
			if (queueSize > 0) {
				message += ` Cleared ${queueSize} queued command(s).`;
			}
			
			await interaction.reply({ 
				content: message
			});
			
		} catch (error) {
			console.error('Error in stop command:', error);
			await interaction.reply({ 
				content: 'An error occurred while trying to stop devices.'
			});
		}
	},
};
