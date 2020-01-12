module.exports = {
	name: 'play',
	description: 'Ping!',
	execute(message) {
		const Discord = require("discord.js");
		const client = new Discord.Client();
		const m = message.channel.send("Ping?");

		m.edit(`Pong! Latency is ${m.createdTimestamp - message.createdTimestamp}ms. API Latency is ${Math.round(client.ping)}ms`);
		// message.channel.send('Pong.').
		// 	then(function (message) {
		// 		message.react('⬇️')
		// 	});
	},
};