const { SlashCommandBuilder } = require('discord.js');
const deviceState = require('../../utils/device-state');
const lockState = require('../../utils/lock-state');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('vibrate')
		.setDescription('Vibrates the device with a specified intensity.')
		.addIntegerOption(option =>
			option.setName('intensity')
				.setDescription('The intensity level (1-100)')
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(100))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('The duration for which to vibrate (in seconds) (1-10)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10)),
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
			console.error('Error in vibrate command validation:', error);
			await interaction.reply({ 
				content: 'An error occurred while validating the command.'
			});
			return;
		}
		
		deviceState.incrementUserCommand(userId);
		
		const commandData = {
			type: 'vibrate',
			userId: userId,
			username: interaction.user.username,
			intensity: intensity,
			duration: duration,
			interaction: interaction,
			execute: async () => {
				try {
					const normalizedIntensity = intensity / 100;
					const normalizedDuration = duration * 1000;
					
					let vibratedDevices = 0;
					const vibratingDevices = [];
					
					for (const device of buttplugClient.devices) {
						if (device.vibrateAttributes.length > 0) {
							const vibrateCommand = device.vibrateAttributes.map(() => normalizedIntensity);
							await device.vibrate(vibrateCommand);
							vibratedDevices++;
							vibratingDevices.push(device);
						}
					}
					
					if (vibratedDevices > 0) {
						deviceState.timeoutId = setTimeout(async () => {
							try {
								for (const device of vibratingDevices) {
									const stopCommand = device.vibrateAttributes.map(() => 0);
									await device.vibrate(stopCommand);
								}
								
								await interaction.editReply({ 
									content: `Vibration complete! ${vibratedDevices} device(s) vibrated at ${intensity}% intensity for ${duration} seconds.`
								});
							} catch (error) {
								console.error('Error stopping vibration:', error);
								try {
									await interaction.editReply({ 
										content: `Vibration ended (with errors). Check console for details.`
									});
								} catch (editError) {
									console.error('Error editing reply:', editError);
								}
							} finally {
								deviceState.completeCurrentCommand();
							}
						}, normalizedDuration);
					} else {
						await interaction.editReply({ 
							content: 'No vibrating devices found among connected devices.'
						});
						deviceState.completeCurrentCommand();
					}
					
				} catch (error) {
					console.error('Error executing vibrate command:', error);
					try {
						await interaction.editReply({ 
							content: 'An error occurred while trying to vibrate the device.'
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
				content: `Command queued! You are #${queuePosition} in the queue. Vibrate: ${intensity}% intensity for ${duration} seconds.`
			});
		} else {
			await interaction.reply({ 
				content: `Vibrating ${vibratingDevices.length} device(s) at ${intensity}% intensity for ${duration} seconds!`
			});
			deviceState.enqueue(commandData);
			await deviceState.processNextCommand();
		}
	},
};