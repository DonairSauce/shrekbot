module.exports = {
    name: 'tv',
    description: 'Searches TVDB for TV shows and requests them in Ombi',
    async execute(message, args) {

        //libraries
        const fetch = require('node-fetch');
        const Discord = require('discord.js');
        const querystring = require('querystring');

        //values from config.json
        const { ombiToken, ombiIP, ombiPort } = require('../config.json');

        const keyA = require('./key.js');
        var jwtToken;
        const query = querystring.stringify({ name: args.join(' ') });

        //hard coded jwt token fetch cause fuck it
        const jwtresult = await fetch('https://api.thetvdb.com/login', {
            method: 'post',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "apikey": "f3b5d18449df77a9f74be7a5564961de",
                "userkey": "5DEAF65C114690.03812018",
                "username": "00zexyz"
            })
        }).then(res => res.json());

        jwtToken = jwtresult.token;
   
        var tvResults ={};
        try {
            tvResults = await fetch("https://api.thetvdb.com/search/series?" + query, {
                method: "get",
                headers: {
                    "Accept": "application/json",
                    "Authorization": "Bearer " + jwtToken,
                    "Accept-Language": "en"
                }
            }).then(response => response.json());

        } catch (err) {
            console.log(err);
        }

        //varibles for the reaction IDs
        var btGreyNext = "652625101585645573";
        var btGreyBack = "652625101543440415";
        var btNext = "652625101572931584";
        var btBack = "652625101564411905";
        var btDownload = "652625101526663224";

        //pulls the results and throws them into usable data
        if (Object.keys(tvResults.data).length > 0) {

            var movies = [];
            var position = 0;
            var maxNumberOfShows = 10;

            if (Object.keys(tvResults.data).length < maxNumberOfShows) {
                maxNumberOfShows = Object.keys(tvResults.data).length;
            }

            for (var i = 0; i < maxNumberOfShows; i++) {
            
                var object = new Object(),
                    id,
                    releaseDate,
                    title,
                    description,
                    image;


                object.id = tvResults.data[i].id;
                object.releaseDate = tvResults.data[i].firstAired;
                object.title = tvResults.data[i].seriesName;
                object.description = tvResults.data[i].overview;
                object.image = tvResults.data[i].banner;

                movies.push(object);
                
            }

            //this shit builds the embeded message for the bot to send
            function showBuilder() {
                const embed = new Discord.RichEmbed()
                    .setColor('#0099ff')
                    .setTitle(movies[position].title + ' (' + movies[position].releaseDate.substring(0, 4) + ')')
                    .setURL('https://thetvdb.com/?tab=series&id=' + movies[position].id)
                    .setDescription(movies[position].description.substr(0, 255) + '(...)')
                    .setImage('https://artworks.thetvdb.com' + movies[position].image)
                    .setTimestamp()
                    .setFooter("Requested by " + message.author.username, `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`)
                    .addField(name = "Search Result: ", (position + 1) + "/" + maxNumberOfShows, true);
                //.addField(name = "Availablity ", "✅", true);

                return embed;
                
            }

            //sends the message that displays the search results
            showSelection();

            //reactions for navigation
            function showSelection() {
                var embededMessage = message.channel.send(showBuilder()).then(async sentEmbed => {
                    if (maxNumberOfShows == 1 && movies.length == 1) {
                        await sentEmbed.react(btDownload)
                    } else if (movies.length > 1 && position == 0) {
                        await sentEmbed.react(btGreyBack)
                            .then(() => sentEmbed.react(btDownload))
                            .then(() => sentEmbed.react(btNext))
                    } else if (position == maxNumberOfShows - 1 && movies.length > 1) {
                        await sentEmbed.react(btBack)
                            .then(() => sentEmbed.react(btDownload))
                            .then(() => sentEmbed.react(btGreyNext))
                    } else {
                        await sentEmbed.react(btBack)
                            .then(() => sentEmbed.react(btDownload)
                                .then(() => sentEmbed.react(btNext)))
                    }


                    //reaction collector
                    const filter = (reaction, user) => {
                        return [btDownload, btNext, btBack].includes(reaction.emoji.id) && user.id === message.author.id;
                    };

                    //reaction collector
                    sentEmbed.awaitReactions(filter, { max: 1, time: 100000, errors: ['time'] })
                        .then(collected => {
                            const reaction = collected.first();


                            //sends POST to ombi requesting a tv show
                            if (reaction.emoji.id === btDownload) {
                                fetch("http://" + ombiIP + ":" + ombiPort + "/api/v1/Request/tv", {
                                    method: "post",
                                    headers: {
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json-patch+json',
                                        'ApiKey': ombiToken,
                                        'ApiAlias': message.author.username + "#" + message.author.discriminator
                                    },

                                    body: JSON.stringify({
                                        'tvDbId': movies[position].id,
                                        'requestAll': true,
                                        'languageCode': "en"
                                    })
                                })
                                    .then((response) => {
                                        message.reply("This is the part where, YOU RUN AWAY. ");
                                    });

                            } else if (reaction.emoji.id === btNext) {
                                sentEmbed.delete();
                                position++;
                                showSelection();
                            } else if (reaction.emoji.id === btBack) {
                                sentEmbed.delete();
                                position--;
                                showSelection();
                            }
                        })
                        .catch(collected => {
                            message.reply('Ogres only have 2 minutes to fulfill requests. GET OUT OF MY SWAMP!');
                        });

                })

            }
        } else {
            message.reply("You fucking donkey. That search was invalid. GET OUT OF MY SWAMP!");
        }

    },
};