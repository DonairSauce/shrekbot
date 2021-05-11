module.exports = {
    name: 'purge',
    description: 'Purge messages.',
    async execute(message, args) {
        const Discord = require("discord.js");
        const client = new Discord.Client();
        //This command removes all messages from all users in the channel, up to 100.

        // get the delete count, as an actual number.
        var deleteCount = parseInt(args[0], 10);
        deleteCount++;
        
        // So we get our messages, and delete them. Simple enough, right?
        const fetched = await message.channel.messages.fetch({ limit: deleteCount });
        message.channel.bulkDelete(fetched)
            .catch(error => message.reply(`Couldn't delete messages because of: ${error}`));
    }
};