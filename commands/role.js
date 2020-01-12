module.exports = {
	name: 'role',
	description: 'Ping!',
	execute(message) {
        const Discord = require("discord.js");
		const client = new Discord.Client();
        message.member.addRole("661281309640884235");

	},
};