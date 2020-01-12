module.exports = {
    name: 'urb',
    description: 'Calls Urban Dictionary API',
    async execute(message, args) {
        const fetch = require('node-fetch');
        const querystring = require('querystring');
        const query = querystring.stringify({ term: args.join(' ') });
        const { list } = await fetch(`https://api.urbandictionary.com/v0/define?` + query).then(response => response.json());
        message.channel.send(list[0].definition);
    },
};