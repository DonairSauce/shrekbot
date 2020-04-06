module.exports = {
    name: 'movie',
    description: 'Request movies shows to Ombi',
    async execute(message, args) {

        const fetch = require('node-fetch');
        const Discord = require('discord.js');
        const querystring = require('querystring');
        const { ombiToken, ombiIP, ombiPort } = require('../config.json');
        args = args.toString();
        args = args.replace(/,/g, " ");
        const query = encodeURIComponent(args);
        var movieResults = {};
        try {
            movieResults = await fetch("http://" + ombiIP + ":" + ombiPort + "/api/v1/Search/movie/" + query, {
                method: "get",
                headers: {
                    'accept': 'application/json',
                    'ApiKey': ombiToken
                }
            }).then(response => response.json());

        } catch (err) {
            console.log(err + "query was: " + query);
        }
        //varibles for the reaction IDs
        var btGreyNext = "652625101585645573";
        var btGreyBack = "652625101543440415";
        var btNext = "652625101572931584";
        var btBack = "652625101564411905";
        var btDownload = "652625101526663224";
        var btGreyDownload = "672265068913754122";

        if (movieResults.length > 0) {

            var movies = [];
            var position = 0;
            var maxNumberOfMovies = 10;

            if (movieResults.length < maxNumberOfMovies) {
                maxNumberOfMovies = movieResults.length;
            }

            for (var i = 0; i < maxNumberOfMovies; i++) {

                var movieInfo = {};
                try {
                    movieInfo = await fetch("http://" + ombiIP + ":" + ombiPort + "/api/v1/Search/movie/info/" + movieResults[i].id, {
                        method: "get",
                        headers: {
                            'accept': 'application/json',
                            'ApiKey': ombiToken
                        }
                    }).then(response => response.json());

                } catch (err) {
                    console.log(err);
                }
                var object = new Object(),
                    id,
                    releaseDate,
                    title,
                    description,
                    image,
                    available,
                    requested;
                object.id = movieResults[i].id;
                object.releaseDate = movieResults[i].releaseDate;
                object.title = movieResults[i].originalTitle;
                object.description = movieResults[i].overview;
                object.image = movieResults[i].posterPath;
                object.available = movieInfo.available;
                object.requested = movieInfo.requested;
                movies.push(object);
            }

            function movieBuilder() {

                const embed = new Discord.MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(movies[position].title + (movies[position].releaseDate == null ? '' : (' (' + movies[position].releaseDate.substring(0, 4) + ')')))
                    .setURL('https://www.themoviedb.org/movie/' + movies[position].id)
                    .setDescription(movies[position].description.substr(0, 255) + '(...)')
                    .setImage('https://image.tmdb.org/t/p/w500' + movies[position].image)
                    .setTimestamp()
                    .setFooter("Requested by " + message.author.username, `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`)
                    .addField(name = "Search Result: ", (position + 1) + "/" + maxNumberOfMovies, true)
                if (movies[position].available) embed.addField('__Available__', '✅', true);
                if (movies[position].requested) embed.addField('__Requested__', '✅', true);
                return embed;

            }
            movieSelection();
            function movieSelection() {
                var requestedOrAvailable = false;
                if (movies[position].requested || movies[position].available) requestedOrAvailable = true;
                var embededMessage = message.channel.send(movieBuilder()).then(async sentEmbed => {
                    if (maxNumberOfMovies == 1 && movies.length == 1 && requestedOrAvailable) {
                        //await sentEmbed.react(btGreyDownload)
                    } else if (movies.length > 1 && position == 0 && requestedOrAvailable) {
                        await sentEmbed.react(btGreyBack)
                            .then(() => sentEmbed.react(btGreyDownload))
                            .then(() => sentEmbed.react(btNext))
                    } else if (position == maxNumberOfMovies - 1 && movies.length > 1 && requestedOrAvailable) {
                        await sentEmbed.react(btBack)
                            .then(() => sentEmbed.react(btGreyDownload))
                            .then(() => sentEmbed.react(btGreyNext))
                    } else if (position > 0 && requestedOrAvailable && position < maxNumberOfMovies) {
                        await sentEmbed.react(btBack)
                            .then(() => sentEmbed.react(btGreyDownload)
                                .then(() => sentEmbed.react(btNext)))
                    } else if (maxNumberOfMovies == 1 && movies.length == 1) {
                        await sentEmbed.react(btDownload)
                    } else if (movies.length > 1 && position == 0) {
                        await sentEmbed.react(btGreyBack)
                            .then(() => sentEmbed.react(btDownload))
                            .then(() => sentEmbed.react(btNext))
                    } else if (position == maxNumberOfMovies - 1 && movies.length > 1) {
                        await sentEmbed.react(btBack)
                            .then(() => sentEmbed.react(btDownload))
                            .then(() => sentEmbed.react(btGreyNext))
                    } else {
                        await sentEmbed.react(btBack)
                            .then(() => sentEmbed.react(btDownload)
                                .then(() => sentEmbed.react(btNext)))
                    }

                    const filter = (reaction, user) => {
                        return [btDownload, btNext, btBack].includes(reaction.emoji.id) && user.id === message.author.id;
                    };

                    sentEmbed.awaitReactions(filter, { max: 1, time: 100000, errors: ['time'] })
                        .then(collected => {
                            const reaction = collected.first();

                            if (reaction.emoji.id === btDownload) {
                                fetch("http://" + ombiIP + ":" + ombiPort + "/api/v1/Request/movie", {
                                    method: "post",
                                    headers: {
                                        'Accept': 'application/json',
                                        'Content-Type': 'text/json',
                                        'ApiKey': ombiToken,
                                        'ApiAlias': message.author.username + "#" + message.author.discriminator

                                    },

                                    body: JSON.stringify({
                                        'theMovieDbId': movies[position].id,
                                        'languageCode': "en"
                                    })
                                })
                                    .then((response) => {
                                        console.log(response);
                                        message.reply("Your request has been submitted.");
                                    });

                            } else if (reaction.emoji.id === btNext) {
                                sentEmbed.delete();
                                position++;
                                movieSelection();
                            } else if (reaction.emoji.id === btBack) {
                                sentEmbed.delete();

                                position--;
                                movieSelection();
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