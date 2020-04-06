module.exports = {
	name: 'ping',
	description: 'Ping!',
	execute(message) {
		const Discord = require("discord.js");
		const client = new Discord.Client();
		
		asyncCall();
		
		async function asyncCall() {
			const m = await message.channel.send("Ping?");

			m.edit(`Pong! Latency is ${m.createdTimestamp - message.createdTimestamp}ms.`);
		}
	},
};