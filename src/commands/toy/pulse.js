const { SlashCommandBuilder } = require('discord.js');
const deviceState = require('../../utils/device-state');
const lockState = require('../../utils/lock-state');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pulse')
		.setDescription('Pulses the device (1 second on, 1 second off) for a specified duration.')
		.addIntegerOption(option =>
			option.setName('intensity')
				.setDescription('The intensity level (10-80)')
				.setRequired(true)
				.setMinValue(10)
				.setMaxValue(80))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('The total duration for pulsing (in seconds) (2-20)')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(20)),
	async execute(interaction) {
		const userId = interaction.user.id;
		
		if (!deviceState.canUserAddCommand(userId)) {
			await interaction.reply({ 
				content: `You've reached the maximum of ${deviceState.USER_COMMAND_LIMIT} commands. Please wait ${Math.ceil(deviceState.USER_TIMEOUT / 1000)} seconds before adding more commands.`,
				ephemeral: true
			});
			return;
		}

		if (lockState.isLocked) {
			await interaction.reply({
				content: 'The bot is currently locked. Please unlock it before using this command.'
			});
			return;
		}

		const intensity = interaction.options.getInteger('intensity');
		const duration = interaction.options.getInteger('duration');
		const buttplugClient = interaction.client.buttplugClient;
		
		let vibratingDevices = [];
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
		} catch (error) {
			console.error('Error in pulse command validation:', error);
			await interaction.reply({ 
				content: 'An error occurred while validating the command.'
			});
			return;
		}
		
		deviceState.incrementUserCommand(userId);
		
		const commandData = {
			type: 'pulse',
			userId: userId,
			username: interaction.user.username,
			intensity: intensity,
			duration: duration,
			interaction: interaction,
			execute: async () => {
				try {
					const normalizedIntensity = intensity / 100;
					const totalDuration = duration * 1000;
					
					let vibratingDevices = [];
					for (const device of buttplugClient.devices) {
						if (device.vibrateAttributes.length > 0) {
							vibratingDevices.push(device);
						}
					}
					
					if (vibratingDevices.length === 0) {
						await interaction.editReply({ 
							content: 'No vibrating devices found among connected devices.'
						});
						deviceState.completeCurrentCommand();
						return;
					}
					
					let isOn = false;
					
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
							deviceState.completeCurrentCommand();
						}
					}, totalDuration);
					
				} catch (error) {
					console.error('Error executing pulse command:', error);
					try {
						await interaction.editReply({ 
							content: 'An error occurred while trying to pulse the device.'
						});
					} catch (editError) {
						console.error('Error editing reply:', editError);
					}
					deviceState.completeCurrentCommand();
				}
			}
		};
		
		if (deviceState.isActive) {
			deviceState.enqueue(commandData);
			const queuePosition = deviceState.getQueueLength();
			await interaction.reply({ 
				content: `Command queued! You are #${queuePosition} in the queue. Pulse: ${intensity}% intensity for ${duration} seconds (1 sec on, 1 sec off).`
			});
		} else {
			await interaction.reply({ 
				content: `Pulsing ${vibratingDevices.length} device(s) at ${intensity}% intensity for ${duration} seconds! (1 sec on, 1 sec off)`
			});
			deviceState.enqueue(commandData);
			await deviceState.processNextCommand();
		}
	},
};
