const fs = require('node:fs');
const path = require('node:path');
const {REST} = require('@discordjs/rest');
const {Routes} = require('discord-api-types/v9');
const {clientId} = process.env;
const {guildId} = process.env;
const {token} = process.env;

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	commands.push(command.data.toJSON());
}

const rest = new REST({version: '9'}).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), {body: commands})
	.then(() => console.log('Ready!'))
	.catch(console.error);
