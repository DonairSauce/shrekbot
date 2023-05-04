const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
var request = require('./commands/request.js');
const token =  process.env.token;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
require('child_process').fork('deploy-commands.js');
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
console.log(commandFiles);
for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

client.once('ready', () => {
	console.log('Ready!');
	var pjson = require('./package.json');
	console.log(pjson);
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
	} else if (interaction.isStringSelectMenu()) {

		if (interaction.customId == "media_selector") {
			request.search(interaction.values[0], interaction);
		}
	} else if (interaction.isButton()) {
		if (interaction.customId.includes('-button')) {
			if (interaction.customId.includes('request')) {
				try {
					var id = interaction.customId.match(/\d/g).join("");
					var mediaType = interaction.customId.split('-')[3]
					request.sendRequest(interaction, id, mediaType);
				} catch (error) {
					console.log(error);
				}
			}
		}
	}
});

client.login(token);