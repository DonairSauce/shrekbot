module.exports = {
	name: 'kick',
	description: 'Tag a member and kick them (but not really).',
    execute(message) {
		if (!message.mentions.users.size) {
			return message.reply('you need enter a movie!');
		}

		const title = message.mentions.users.first();

		message.channel.send(`You wanted to kick: ${args}`);
	},
};