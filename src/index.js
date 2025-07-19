const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const {
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    MessageFlags,
    ActivityType
} = require('discord.js');
const {
    ButtplugClient,
    ButtplugClientDevice,
    ButtplugNodeWebsocketClientConnector
} = require('buttplug');

dotenv.config();

const BUTTPLUG_SERVER_URL = process.env.BUTTPLUG_SERVER_URL || "ws://127.0.0.1:12345";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const buttplugClient = new ButtplugClient("Discord Bot");

client.buttplugClient = buttplugClient;

function updateBotStatus() {
    if (!client.user) return;

    if (!buttplugClient.connected) {
        client.user.setPresence({
            activities: [{
                name: 'Disconnected from server',
                type: ActivityType.Custom,
                state: '❌ Server offline'
            }],
            status: 'dnd'
        });
        return;
    }

    const deviceCount = buttplugClient.devices.length;

    if (deviceCount === 0) {
        client.user.setPresence({
            activities: [{
                name: 'No devices connected',
                type: ActivityType.Custom,
                state: '⏸️ Waiting for devices'
            }],
            status: 'idle'
        });
    } else {
        client.user.setPresence({
            activities: [{
                name: `${deviceCount} device${deviceCount === 1 ? '' : 's'} connected`,
                type: ActivityType.Custom,
                state: `🟢 ${deviceCount} active`
            }],
            status: 'online'
        });
    }
}

async function connectToButtplugServer() {
    try {
        console.log(`[Buttplug] Connecting to ${BUTTPLUG_SERVER_URL}...`);
        const connector = new ButtplugNodeWebsocketClientConnector(BUTTPLUG_SERVER_URL);

        connector.addListener("error", (err) => {
            console.error(`[Buttplug] Connector error:`, err.message);
        });

        await buttplugClient.connect(connector);
        console.log("[Buttplug] Connected!");

        await buttplugClient.startScanning();
        updateBotStatus();
        return true;
    } catch (error) {
        console.error(`[Buttplug] Connection failed:`, error?.message || error);
        updateBotStatus();
        return false;
    }
}

function setupButtplugEventListeners() {
    buttplugClient.addListener("deviceadded", (device) => {
        console.log(`[Buttplug] Device connected: ${device.name}`);
        updateBotStatus();
    });

    buttplugClient.addListener("deviceremoved", (device) => {
        console.log(`[Buttplug] Device disconnected: ${device.name}`);
        updateBotStatus();
    });

    buttplugClient.addListener("disconnect", () => {
        console.warn("[Buttplug] Disconnected from server");
        updateBotStatus();
    });

    buttplugClient.addListener("error", (error) => {
        console.error("[Buttplug] Client error:", error.message || error);
        updateBotStatus();
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
            console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);

    setupButtplugEventListeners();

    const connected = await connectToButtplugServer();
    if (!connected) {
        console.warn("[Buttplug] Could not connect.");
    }

    updateBotStatus();
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.guildId !== process.env.DISCORD_GUILD_ID) {
        await interaction.reply({
            content: 'This command can only be used in the designated guild.',
            ephemeral: true
        });
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
        console.error('Error in', interaction.commandName, 'command:', error);
        
        const interactionAge = Date.now() - interaction.createdTimestamp;
        if (interactionAge > 2900) {
            console.warn('Interaction too old to respond to error');
            return;
        }

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'There was an error while executing this command!',
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: 'There was an error while executing this command!',
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (responseError) {
            console.error('Failed to send error response:', responseError);
        }
    }
});

async function cleanup() {
    console.log("Shutting down gracefully...");

    if (buttplugClient.connected) {
        try {
            for (const device of buttplugClient.devices) {
                await device.stop();
            }

            await buttplugClient.disconnect();
            console.log("[Buttplug] Disconnected cleanly.");
        } catch (error) {
            console.error("Error during cleanup:", error.message || error);
        }
    }

    client.destroy();
    console.log("Bot shutdown complete.");
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGUSR1', cleanup);
process.on('SIGUSR2', cleanup);

process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error.stack || error);

    if (error.code === 'ECONNREFUSED') {
        console.log('[Buttplug] Connection refused — likely server is down.');
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

client.login(process.env.BOT_TOKEN);