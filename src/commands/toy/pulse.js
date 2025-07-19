const { SlashCommandBuilder } = require('discord.js');
const deviceState = require('../../utils/device-state');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pulse')
		.setDescription('Pulses the device (1 second on, 1 second off) for a specified duration.')
		.addIntegerOption(option =>
			option.setName('intensity')
				.setDescription('The intensity level (1-100)')
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(100))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('The total duration for pulsing (in seconds) (2-20)')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(20)),
	async execute(interaction) {
		if (deviceState.isActive) {
			await interaction.reply({ 
				content: `Device is currently busy with ${deviceState.activeCommand} command! Please wait for it to finish.`
			});
			return;
		}

		const intensity = interaction.options.getInteger('intensity');
		const duration = interaction.options.getInteger('duration');
		const buttplugClient = interaction.client.buttplugClient;
		
		try {
			if (!buttplugClient.connected) {
				await interaction.reply({ 
					content: 'Not connected to Buttplug server. Make sure Intiface Central is running.'
				});
				return;
			}
			
			const devices = buttplugClient.devices;
			
			if (devices.length === 0) {
				await interaction.reply({ 
					content: 'No devices connected. Make sure your device is paired and visible to Intiface Central.'
				});
				return;
			}
			
			const normalizedIntensity = intensity / 100;
			const totalDuration = duration * 1000;
			
			let vibratingDevices = [];
			
			for (const device of devices) {
				if (device.vibrateAttributes.length > 0) {
					vibratingDevices.push(device);
				}
			}
			
			if (vibratingDevices.length === 0) {
				await interaction.reply({ 
					content: 'No vibrating devices found among connected devices.', 
					ephemeral: true 
				});
				return;
			}
			
			deviceState.isActive = true;
			deviceState.activeCommand = 'pulse';
			let isOn = false;
			
			await interaction.reply({ 
				content: `Pulsing ${vibratingDevices.length} device(s) at ${intensity}% intensity for ${duration} seconds! (1 sec on, 1 sec off)`
			});
			
			const toggleVibration = async () => {
				try {
					isOn = !isOn;
					const vibrationLevel = isOn ? normalizedIntensity : 0;
					
					for (const device of vibratingDevices) {
						const vibrateCommand = device.vibrateAttributes.map(() => vibrationLevel);
						await device.vibrate(vibrateCommand);
					}
				} catch (error) {
					console.error('Error toggling vibration:', error);
				}
			};
			
			await toggleVibration();
			
			deviceState.intervalId = setInterval(toggleVibration, 1000);

			deviceState.timeoutId = setTimeout(async () => {
				try {
					if (deviceState.intervalId) {
						clearInterval(deviceState.intervalId);
						deviceState.intervalId = null;
					}
					
					for (const device of vibratingDevices) {
						const stopCommand = device.vibrateAttributes.map(() => 0);
						await device.vibrate(stopCommand);
					}
					
					await interaction.editReply({ 
						content: `Pulse complete! ${vibratingDevices.length} device(s) pulsed at ${intensity}% intensity for ${duration} seconds.`
					});
				} catch (error) {
					console.error('Error stopping pulse:', error);
					try {
						await interaction.editReply({ 
							content: `Pulse ended (with errors). Check console for details.`
						});
					} catch (editError) {
						console.error('Error editing reply:', editError);
					}
				} finally {
					deviceState.isActive = false;
					deviceState.activeCommand = null;
					deviceState.intervalId = null;
					deviceState.timeoutId = null;
				}
			}, totalDuration);
			
		} catch (error) {
			console.error('Error in pulse command:', error);
			await interaction.reply({ 
				content: 'An error occurred while trying to pulse the device.'
			});
			
			if (deviceState.intervalId) {
				clearInterval(deviceState.intervalId);
				deviceState.intervalId = null;
			}
			if (deviceState.timeoutId) {
				clearTimeout(deviceState.timeoutId);
				deviceState.timeoutId = null;
			}
			deviceState.isActive = false;
			deviceState.activeCommand = null;
		}
	},
};
