const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const { ButtplugClient, ButtplugClientDevice, ButtplugNodeWebsocketClientConnector } = require('buttplug');
const dotenv = require('dotenv');

dotenv.config();

const BUTTPLUG_SERVER_URL = process.env.BUTTPLUG_SERVER_URL || "ws://127.0.0.1:12345";
const RECONNECT_INTERVAL = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const buttplugClient = new ButtplugClient("Discord Bot");
client.buttplugClient = buttplugClient;
let reconnectAttempts = 0;
let reconnectTimer = null;

async function connectToButtplugServer() {
    try {
        const connector = new ButtplugNodeWebsocketClientConnector(BUTTPLUG_SERVER_URL);
        await buttplugClient.connect(connector);
        
        console.log(`Connected to Buttplug server at ${BUTTPLUG_SERVER_URL}`);
        reconnectAttempts = 0;
        
        await buttplugClient.startScanning();
        console.log("Started scanning for devices");
        
        return true;
    } catch (error) {
        console.error(`Failed to connect to Buttplug server:`, error.message);
        return false;
    }
}

function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
        return;
    }
    
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    
    reconnectAttempts++;
    console.log(`Scheduling reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_INTERVAL/1000}s...`);
    
    reconnectTimer = setTimeout(async () => {
        console.log(`Attempting to reconnect to Buttplug server (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        const connected = await connectToButtplugServer();
        
        if (!connected) {
            scheduleReconnect();
        }
    }, RECONNECT_INTERVAL);
}

function setupButtplugEventListeners() {
    buttplugClient.addListener("deviceadded", (device) => {
        console.log(`Device connected: ${device.name}`);
    });
    
    buttplugClient.addListener("deviceremoved", (device) => {
        console.log(`Device disconnected: ${device.name}`);
    });
    
    buttplugClient.addListener("disconnect", () => {
        console.log("Disconnected from Buttplug server");
        scheduleReconnect();
    });
    
    buttplugClient.addListener("serversconnection", () => {
        console.log("Server connection event");
    });
}

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
            console.log(`Loaded command: ${command.data.name}`);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

client.once(Events.ClientReady, async readyClient => {
	console.log(`Ready, logged in as: ${readyClient.user.tag}`);
	
	setupButtplugEventListeners();
	
	const connected = await connectToButtplugServer();
	
	if (!connected) {
		console.log("Initial connection failed, will attempt to reconnect automatically");
		scheduleReconnect();
	}
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

    if (interaction.guildId !== process.env.DISCORD_GUILD_ID) {
        await interaction.reply({ content: 'This command can only be used in the designated guild.', ephemeral: true });
        return;
    }

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
	}
});

async function cleanup() {
    console.log("Shutting down gracefully...");
    
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    if (buttplugClient.connected) {
        try {
            const devices = buttplugClient.devices;
            for (const device of devices) {
                await device.stop();
            }
            console.log("Stopped all devices");
            
            await buttplugClient.disconnect();
            console.log("Disconnected from Buttplug server");
        } catch (error) {
            console.error("Error during cleanup:", error.message);
        }
    }
    
    client.destroy();
    console.log("Bot shutdown complete");
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGUSR1', cleanup);
process.on('SIGUSR2', cleanup);

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    cleanup();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    cleanup();
});

client.login(process.env.BOT_TOKEN);