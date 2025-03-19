console.log('Initializing shrekbot');
const fs = require('node:fs');
const path = require('node:path');
const {
	Client,
	Collection,
	GatewayIntentBits,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	InteractionType,
	ActionRowBuilder,
} = require('discord.js');

const request = require('./commands/request.js');
const { token } = process.env;
const channelFeed = process.env.channelfeed;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
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
	console.log(`Using ombi: ${process.env.ombiip}:${process.env.ombiport}`);
	console.log(`Message timeout set to: ${process.env.timerexp}`);
});

client.on('interactionCreate', async interaction => {
	function generateId() {
		return ++currentId;
	}

	if (interaction.isCommand()) {
		const command = client.commands.get(interaction.commandName);
		if (!command) return;
		try {
			await command.execute(interaction, generateId());
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	} else if (interaction.isStringSelectMenu()) {
		// Media selection
		if (interaction.customId === 'media_selector') {
			request.search(interaction.values[0], interaction);
		}
		// Season selection; expected format: "season_selector-<messageId>"
		else if (interaction.customId.startsWith('season_selector-')) {
			const [, messageId] = interaction.customId.split('-');
			const seasonChoice = interaction.values[0];
			if (seasonChoice === 'specific') {
				const modal = new ModalBuilder()
					.setCustomId(`seasonModal-${messageId}`)
					.setTitle('Enter Season Number');
				const seasonInput = new TextInputBuilder()
					.setCustomId('seasonNumber')
					.setLabel('Season Number')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('e.g., 3')
					.setRequired(true);
				const firstActionRow = new ActionRowBuilder().addComponents(seasonInput);
				modal.addComponents(firstActionRow);
				await interaction.showModal(modal);
			} else {
				request.seasonSelections.set(messageId, 'all');
				await interaction.reply({ content: 'You selected all seasons.', ephemeral: true });
			}
		}
	} else if (interaction.type === InteractionType.ModalSubmit) {
		if (interaction.customId.startsWith('seasonModal-')) {
			const [, messageId] = interaction.customId.split('-');
			const seasonNumber = interaction.fields.getTextInputValue('seasonNumber');
			request.seasonSelections.set(messageId, seasonNumber);
			await interaction.reply({ content: `You selected season ${seasonNumber}.`, ephemeral: true });
		}
	} else if (interaction.isButton()) {
		if (interaction.customId.includes('-button') && interaction.customId.includes('request')) {
			try {
				const parts = interaction.customId.split('-');
				const id = parts[2];
				const mediaType = parts[3];
				const messageId = parts[4];
				interaction.deferUpdate();
				const seasonSelection = request.seasonSelections.get(messageId) || 'all';
				await request.sendRequest(interaction, id, mediaType, messageId, seasonSelection);
			} catch (error) {
				console.error(error);
			}
		}
	}
});

client.login(token);

// Express server
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
	console.log('Received webhook:', req.body);
	const { requestedByAlias, title, userName, requestStatus } = req.body;
	if (requestStatus === 'Available') {
		let userId = requestedByAlias
			? requestedByAlias.includes(',')
				? `<@${requestedByAlias.split(',')[1]}>`
				: requestedByAlias
			: userName;
		const discordMessage = `${userId}, ${title} is now available!`;
		client.channels.cache.get(channelFeed).send(discordMessage);
		res.sendStatus(200);
	} else {
		console.log(`Request status is not 'Available', it is: '${requestStatus}'`);
		res.sendStatus(200);
	}
});

app.listen(8154, () => {
	console.log('Webhook server is running on port 8154');
});
