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
		// Season selection; expected customId format: "season_selector-<messageId>"
		else if (interaction.customId.startsWith('season_selector-')) {
			const parts = interaction.customId.split('-');
			const messageId = parts[1];
			const seasonChoices = interaction.values; // This is now an array

			if (seasonChoices.includes('other')) {
				// Show modal for custom season input
				const modal = new ModalBuilder()
					.setCustomId(`seasonModal-${messageId}`)
					.setTitle('Enter Season Numbers');
				const seasonInput = new TextInputBuilder()
					.setCustomId('seasonNumbers')
					.setLabel('Season Numbers')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('e.g., 1,3,5 or 1-3')
					.setRequired(true);
				const actionRow = new ActionRowBuilder().addComponents(seasonInput);
				modal.addComponents(actionRow);
				await interaction.showModal(modal);
			} else {
				// Store the selected array and reply with all chosen seasons
				request.seasonSelections.set(messageId, seasonChoices);
				await interaction.reply({
					content: `You selected season(s): ${seasonChoices.join(', ')}.`,
					ephemeral: true,
				});
			}
		}
	} else if (interaction.type === InteractionType.ModalSubmit) {
		if (interaction.customId.startsWith('seasonModal-')) {
			const [, messageId] = interaction.customId.split('-');
			const input = interaction.fields.getTextInputValue('seasonNumbers').trim();
			let seasonNumbers = [];
			// Support range format "1-3"
			if (input.includes('-')) {
				const [start, end] = input.split('-').map(Number);
				if (!isNaN(start) && !isNaN(end) && start <= end) {
					for (let i = start; i <= end; i++) {
						seasonNumbers.push(i.toString());
					}
				}
			} else if (input.includes(',')) {
				seasonNumbers = input.split(',').map(s => s.trim());
			} else {
				seasonNumbers = [input];
			}

			// Validate against available seasons
			const available = request.availableSeasons.get(messageId) || [];
			const availableStr = available.map(num => num.toString());
			const invalid = seasonNumbers.filter(s => !availableStr.includes(s));
			if (invalid.length > 0) {
				await interaction.reply({
					content: `Invalid season(s): ${invalid.join(', ')}. Available seasons: ${availableStr.join(', ')}.`,
					ephemeral: true,
				});
				return;
			}

			// Store the valid selection and confirm
			request.seasonSelections.set(messageId, seasonNumbers);
			await interaction.reply({
				content: `You selected season(s): ${seasonNumbers.join(', ')}.`,
				ephemeral: true,
			});
		}
	} else if (interaction.isButton()) {
		if (interaction.customId.includes('-button') && interaction.customId.includes('request')) {
			try {
				const parts = interaction.customId.split('-');
				const id = parts[2];
				const mediaType = parts[3];
				const messageId = parts[4];
				interaction.deferUpdate();
				// Retrieve stored selection; default to ['all'] if none
				const seasonSelection = request.seasonSelections.get(messageId) || ['all'];
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
