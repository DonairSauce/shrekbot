import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client, Collection, Intents } from 'discord.js';
import { search, sendRequest } from './commands/request.js';
const token =  process.env.token;
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
require('child_process').fork('deploy-commands.js');
client.commands = new Collection();
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
console.log(commandFiles);
for (const file of commandFiles) {
	const filePath = join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

client.once('ready', () => {
	console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
	if (interaction.isCommand()) {

		const command = client.commands.get(interaction.commandName);

		if (!command) return;

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	} else if (interaction.isSelectMenu()) {

		if (interaction.customId == "media_selector") {
			search(interaction.values[0], interaction);
		}
	} else if (interaction.isButton()) {
		if (interaction.customId.includes('-button')) {
			if (interaction.customId.includes('request')) {
				try {
					var id = interaction.customId.match(/\d/g).join("");
					var mediaType = interaction.customId.split('-')[3]
					sendRequest(interaction, id, mediaType);
				} catch (error) {
					console.log(error);
				}
				interaction.reply("Your request has been submitted.");

			}
		}
	}
});

client.login(token);

