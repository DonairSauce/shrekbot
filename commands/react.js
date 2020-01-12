module.exports = {
    name: 'react',
    description: 'Collector to gather reactions',
    async execute(message, args) {
        message.react('⬇️').then(() => message.react('⬆️'));

        const filter = (reaction, user) => {
            return ['⬇️', '⬆️'].includes(reaction.emoji.name) && user.id === message.author.id;
        };

        message.awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
            .then(collected => {
                const reaction = collected.first();

                if (reaction.emoji.name === '⬇️') {
                    message.reply('you reacted with a download');
                } else {
                    message.reply('you reacted with next');
                }
            })
            .catch(collected => {
                message.reply('you reacted with neither a thumbs up, nor a thumbs down.');
            });

    },
};