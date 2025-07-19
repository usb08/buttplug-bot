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

			if (deviceState.timeoutId) {
				clearTimeout(deviceState.timeoutId);
			}
			if (deviceState.intervalId) {
				clearInterval(deviceState.intervalId);
			}
			deviceState.isActive = false;
			deviceState.activeCommand = null;
			deviceState.timeoutId = null;
			deviceState.intervalId = null;
			
			await interaction.reply({ 
				content: `Stopped ${stoppedDevices} device(s).`
			});
			
		} catch (error) {
			console.error('Error in stop command:', error);
			await interaction.reply({ 
				content: 'An error occurred while trying to stop devices.'
			});
		}
	},
};
