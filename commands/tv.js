module.exports = {
    name: 'tv',
    description: 'Searches TVDB for TV shows and requests them in Ombi',
    async execute(message, args) {

        //libraries
        const fetch = require('node-fetch');
        const Discord = require('discord.js');

        // Removed config.js in favour of env variables
        // const { ombiToken, ombiIP, ombiPort } = require('../config.json');
        const ombiIP = process.env.ombiip;
        const ombiPort = process.env.ombiport;
        const ombiToken = process.env.ombitoken;
        
        args = args.toString();
        args = args.replace(/,/g, " ");
        const query = encodeURIComponent(args);

        var tvResults = {};
        try {
            tvResults = await fetch("http://" + ombiIP + ":" + ombiPort + "/api/v1/Search/tv/" + query, {
                method: "get",
                headers: {
                    'accept': 'application/json',
                    'ApiKey': ombiToken
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
        var btGreyDownload = "672265068913754122";

        //pulls the results and throws them into usable data
        if (Object.keys(tvResults).length > 0) {

            var tvShows = [];
            var position = 0;
            var maxNumberOfShows = 10;

            if (Object.keys(tvResults).length < maxNumberOfShows) {
                maxNumberOfShows = Object.keys(tvResults).length;
            }

            for (var i = 0; i < maxNumberOfShows; i++) {
                var tvInfo = {};
                try {
                    tvInfo = await fetch("http://" + ombiIP + ":" + ombiPort + "/api/v1/Search/tv/info/" + tvResults[i].id, {
                        method: "get",
                        headers: {
                            'accept': 'application/json',
                            'ApiKey': ombiToken
                        }
                    }).then(response => response.json());

                } catch (err) {
                    console.log(err);
                    console.log(tvInfo);
                }


                var object = new Object(),
                    id,
                    releaseDate,
                    title,
                    description,
                    image,
                    available,
                    requested;

                object.id = tvResults[i].id;
                object.releaseDate = tvResults[i].firstAired;
                object.title = tvResults[i].title;
                object.description = tvResults[i].overview;
                object.image = tvResults[i].banner;
                object.imdbID = tvResults[i].imdbId;
                object.available = tvInfo.available;
                object.requested = tvInfo.requested;

                tvShows.push(object);

            }

            //this shit builds the embeded message for the bot to send
            function showBuilder() {
                try {
                    const embed = new Discord.RichEmbed()
                        .setColor('#0099ff')
                        .setTitle(tvShows[position].title + (tvShows[position].releaseDate == null ? '' : (' (' + tvShows[position].releaseDate.substring(0, 4) + ')')))
                        .setURL('https://imdb.com/title/' + tvShows[position].imdbID)
                        .setDescription(tvShows[position].description == undefined ? 'No description' : tvShows[position].description.substr(0, 255) + '(...)')
                        .setImage(tvShows[position].image)
                        .setTimestamp()
                        .setFooter("Requested by " + message.author.username, `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`)
                        .addField(name = "Search Result: ", (position + 1) + "/" + maxNumberOfShows, true);
                    if (tvShows[position].available) embed.addField('__Available__', '✅', true);
                    if (tvShows[position].requested) embed.addField('__Requested__', '✅', true);

                    return embed;
                } catch (err) {
                    console.log("error showBuilder: " + err)
                }
            }

            //sends the message that displays the search results
            showSelection();

            //reactions for navigation
            function showSelection() {
                var requestedOrAvailable = false;
                if (tvShows[position].requested || tvShows[position].available) requestedOrAvailable = true;

                var embededMessage = message.channel.send(showBuilder()).then(async sentEmbed => {
                    if (maxNumberOfShows == 1 && tvShows.length == 1 && requestedOrAvailable) {
                        //await sentEmbed.react(btGreyDownload)
                    } else if (tvShows.length > 1 && position == 0 && requestedOrAvailable) {
                        await sentEmbed.react(btGreyBack)
                            .then(() => sentEmbed.react(btGreyDownload))
                            .then(() => sentEmbed.react(btNext))
                    } else if (position == maxNumberOfShows - 1 && tvShows.length > 1 && requestedOrAvailable) {
                        await sentEmbed.react(btBack)
                            .then(() => sentEmbed.react(btGreyDownload))
                            .then(() => sentEmbed.react(btGreyNext))
                    } else if (position > 0 && requestedOrAvailable && position < maxNumberOfShows) {
                        await sentEmbed.react(btBack)
                            .then(() => sentEmbed.react(btGreyDownload)
                                .then(() => sentEmbed.react(btNext)))
                    }
                    else if (maxNumberOfShows == 1 && tvShows.length == 1) {
                        await sentEmbed.react(btDownload)
                    } else if (tvShows.length > 1 && position == 0) {
                        await sentEmbed.react(btGreyBack)
                            .then(() => sentEmbed.react(btDownload))
                            .then(() => sentEmbed.react(btNext))
                    } else if (position == maxNumberOfShows - 1 && tvShows.length > 1) {
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
                                        'tvDbId': tvShows[position].id,
                                        'requestAll': true,
                                        'languageCode': "en"
                                    })
                                })
                                    .then((response) => {
                                        message.reply("Your request has been submitted.");
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
                            message.reply('Your request timed out!');
                        });

                })

            }
        } else {
            message.reply("That search was invalid.");
        }

    },
};