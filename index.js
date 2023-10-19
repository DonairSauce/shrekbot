console.log('Initializing shrekbot');
const fs = require('node:fs');
const path = require('node:path');
const {Client, Collection, GatewayIntentBits} = require('discord.js');
const request = require('./commands/request.js');
const {token} = process.env;
const channelFeed = process.env.channelfeed;
const client = new Client({intents: [GatewayIntentBits.Guilds]});
require('child_process').fork('deploy-commands.js');

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

console.log('Command files loaded');

let currentId = 0;

client.once('ready', () => {
    const pjson = require('./package.json');
    console.log(pjson);
    const ombiIP = process.env.ombiip;
    const ombiPort = process.env.ombiport;
    const timerExp = process.env.timerexp;
    console.log('Using ombi: ' + ombiIP + ':' + ombiPort);
    console.log('Message timeout set to: ' + timerExp);
});

client.on('interactionCreate', async interaction => {
    function generateId() {
        currentId++;
        return currentId;
    }

    if (interaction.isCommand()) {
        await interaction.deferReply({ content: 'Processing your request...' });
        
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction, generateId());
        } catch (error) {
            console.error(error);
            await interaction.editReply('There was an error while executing this command!');
        }
    } 
    else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'media_selector') {
            request.search(interaction.values[0], interaction);
        }
    } 
    else if (interaction.isButton()) {
        if (interaction.customId.includes('-button')) {
            if (interaction.customId.includes('request')) {
                try {
                    const id = interaction.customId.split('-')[2];
                    const mediaType = interaction.customId.split('-')[3];
                    const messageId = interaction.customId.split('-')[4];
                    interaction.deferUpdate();
                    await request.sendRequest(interaction, id, mediaType, messageId);
                } catch (error) {
                    console.log(error);
                }
            }
        }
    }
});

client.login(token);

// Express section
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
    const payload = req.body;

    // Extract relevant data from the payload
    const {requestedByAlias, title, userName, requestStatus} = payload;
    if (requestStatus === 'Available') {
        let userId = '';
        if (requestedByAlias) {
            if (requestedByAlias.includes(',')) {
                userId = '<@' + requestedByAlias.split(',')[1] + '>';
            } else {
                userId = requestedByAlias;
            }
        } else {
            userId = userName;
        }

        // Compose the Discord webhook message
        const discordMessage = `${userId}, ${title} is now available!`;
        client.channels.cache.get(channelFeed).send(discordMessage);

        res.sendStatus(200);
    }
});

app.listen(8154, () => {
    console.log('Webhook server is running on port 8154');
});
