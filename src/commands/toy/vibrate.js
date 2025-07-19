const { SlashCommandBuilder } = require('discord.js');

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
			const normalizedDuration = duration * 1000;
			
			let vibratedDevices = 0;
			const vibratingDevices = [];
			
			for (const device of devices) {
				if (device.vibrateAttributes.length > 0) {
					const vibrateCommand = device.vibrateAttributes.map(() => normalizedIntensity);
					await device.vibrate(vibrateCommand);
					vibratedDevices++;
					vibratingDevices.push(device);
				}
			}
			
			if (vibratedDevices > 0) {
				await interaction.reply({ 
					content: `Vibrating ${vibratedDevices} device(s) at ${intensity}% intensity for ${duration} seconds!`
				});

				setTimeout(async () => {
					try {
						for (const device of vibratingDevices) {
							const stopCommand = device.vibrateAttributes.map(() => 0);
							await device.vibrate(stopCommand);
						}
					} catch (error) {
						console.error('Error stopping vibration:', error);
					}
				}, normalizedDuration);
			} else {
				await interaction.reply({ 
					content: 'No vibrating devices found among connected devices.', 
					ephemeral: true 
				});
			}
			
		} catch (error) {
			console.error('Error in vibrate command:', error);
			await interaction.reply({ 
				content: 'An error occurred while trying to vibrate the device.'
			});
		}
	},
};