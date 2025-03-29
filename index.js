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
		if (interaction.customId === 'media_selector') {
			request.search(interaction.values[0], interaction);
		}
	} else if (interaction.isButton()) {
		if (interaction.customId.includes('-button') && interaction.customId.includes('request')) {
			const parts = interaction.customId.split('-'); // Format: request-button-<id>-<mediaType>-<messageId>
			const id = parts[2];
			const mediaType = parts[3];
			const messageId = parts[4];
			if (mediaType === 'tv') {
				const remaining = request.remainingSeasons.get(messageId) || [];
				const totalSeasons = request.availableSeasons.get(messageId)?.length || 0;
				const labelText = totalSeasons > 0
					? `Seasons (T=${totalSeasons})`
					: 'Seasons';
				const remainingStr = remaining.length ? remaining.join(', ') : 'All';
				const placeholderText = `Leave empty for All, or enter like "1,3,5" or "1-3"`;

				const modal = new ModalBuilder()
					.setCustomId(`tvSeasonModal::${messageId}::${id}::${mediaType}`)
					.setTitle('🎬 Choose Seasons to Request');

				const seasonInput = new TextInputBuilder()
					.setCustomId('tvSeasonNumbers')
					.setLabel(labelText)
					.setStyle(TextInputStyle.Short)
					.setPlaceholder(placeholderText)
					.setRequired(false); // Allow empty input for 'All Seasons'

				const actionRow = new ActionRowBuilder().addComponents(seasonInput);
				modal.addComponents(actionRow);

				await interaction.showModal(modal);
				// Show follow-up after 1 second with flags for ephemeral
				setTimeout(() => {
					interaction.followUp({
						content: `📝 To request specific seasons, leave the input empty for "All Seasons", or type something like "1,3,5" or "1-3".`,
						flags: 64 // 64 = ephemeral
					}).catch(console.error);
				}, 1000);
			} else {
				// For movies
				interaction.deferUpdate();
				await request.sendRequest(interaction, id, mediaType, messageId, '');
			}
		}
	} else if (interaction.type === InteractionType.ModalSubmit) {
		if (interaction.customId.startsWith('tvSeasonModal::')) {
			const parts = interaction.customId.split('::');
			const messageId = parts[1];
			const id = parts[2];
			const mediaType = parts[3];
			const inputRaw = interaction.fields.getTextInputValue('tvSeasonNumbers').trim();
			const input = inputRaw.toLowerCase();
			let seasonNumbers = [];
			// Treat empty or "all seasons" input as a request for all seasons
			if (!input || input === 'all seasons') {
				seasonNumbers = ['all'];
			} else {
				// Parse input: ranges (e.g., 1-3), comma-separated (e.g., 1,3,5), or single number
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
					seasonNumbers = [inputRaw];
				}
			}

			// Validate input against remaining seasons
			const remaining = request.remainingSeasons.get(messageId) || [];
			const remainingStr = remaining.map(num => num.toString());
			const invalid = seasonNumbers.filter(s => s !== 'all' && !remainingStr.includes(s));
			if (invalid.length > 0) {
				await interaction.reply({
					content: `❌ Invalid season(s): ${invalid.join(', ')}.\nRemaining: ${remainingStr.join(', ')}`,
					flags: 64 // ephemeral
				});
				return;
			}

			// Save selection and proceed
			request.seasonSelections.set(messageId, seasonNumbers);
			await interaction.reply({
				content: `✅ You selected season(s): ${seasonNumbers.join(', ')}`,
				flags: 64
			});
			await request.sendRequest(interaction, id, mediaType, messageId, seasonNumbers);
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
