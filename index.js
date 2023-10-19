// Required modules and initializations
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const express = require('express');
const request = require('./commands/request.js');
const { token } = process.env;
const channelFeed = process.env.channelfeed;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

let currentId = 0;
const generateId = () => {
    currentId++;
    return currentId;
};

// Client events
client.once('ready', () => {
    const pjson = require('./package.json');
    console.log(`Bot version: ${pjson.version}`);
    console.log(`Using ombi: ${process.env.ombiip}:${process.env.ombiport}`);
    console.log(`Message timeout set to: ${process.env.timerexp}`);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction, generateId());
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    } else if (interaction.isStringSelectMenu() && interaction.customId === 'media_selector') {
        request.search(interaction.values[0], interaction);
    } else if (interaction.isButton() && interaction.customId.includes('-button')) {
        if (interaction.customId.includes('request')) {
            try {
                const [_, __, id, mediaType, messageId] = interaction.customId.split('-');
                interaction.deferUpdate();
                await request.sendRequest(interaction, id, mediaType, messageId);
            } catch (error) {
                console.log(error);
            }
        }
    }
});

client.login(token);

// Express server for webhook
const app = express();
app.use(express.json());
app.post('/webhook', (req, res) => {
    const { requestedByAlias, title, userName, requestStatus } = req.body;
    if (requestStatus === 'Available') {
        const userId = requestedByAlias?.includes(',')
            ? `<@${requestedByAlias.split(',')[1]}>`
            : userName || requestedByAlias;

        client.channels.cache.get(channelFeed).send(`${userId}, ${title} is now available!`);
        res.sendStatus(200);
    }
});

app.listen(8154, () => {
    console.log('Webhook server is running on port 8154');
});
