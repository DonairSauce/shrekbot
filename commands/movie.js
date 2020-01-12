module.exports = {
    name: 'movie',
    description: 'Searches TMDB for movies and requests them in Ombi',
    async execute(message, args) {

        const fetch = require('node-fetch');
        const Discord = require('discord.js');
        const querystring = require('querystring');
        const { ombiToken, mdbToken, ombiIP, ombiPort } = require('../config.json');
        const query = querystring.stringify({ query: args.join(' ') });

        const { results } = await fetch('https://api.themoviedb.org/3/search/movie?api_key='+mdbToken+'&language=en-US&page=1&include_adult=true&' + query).then(response => response.json());

        //varibles for the reaction IDs
        var btGreyNext="652625101585645573";
        var btGreyBack = "652625101543440415";
        var btNext = "652625101572931584";
        var btBack = "652625101564411905";
        var btDownload = "652625101526663224";


        if (results.length > 0) {

            var movies = [];
            var position = 0;
            var maxNumberOfMovies = 10;

            if (results.length < maxNumberOfMovies) {
                maxNumberOfMovies = results.length;
            }

            for (var i = 0; i < maxNumberOfMovies; i++) {

                var object = new Object(),
                    id,
                    releaseDate,
                    title,
                    description,
                    image;


                object.id = results[i].id;
                object.releaseDate = results[i].release_date;
                object.title = results[i].title;
                object.description = results[i].overview;
                object.image = results[i].poster_path;


                movies.push(object);
            }

            function movieBuilder() {

                const embed = new Discord.RichEmbed()
                    .setColor('#0099ff')
                    .setTitle(movies[position].title + ' (' + movies[position].releaseDate.substring(0, 4) + ')')
                    .setURL('https://www.themoviedb.org/movie/' + movies[position].id)
                    .setDescription(movies[position].description.substr(0, 255) + '(...)')
                    .setImage('https://image.tmdb.org/t/p/w500' + movies[position].image)
                    .setTimestamp()
                    .setFooter("Requested by " + message.author.username, `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`)
                    .addField(name = "Search Result: ", (position + 1) + "/" + maxNumberOfMovies, true)
                    //.addField(name = "Availablity ", "✅", true);
                return embed;

            }

            movieSelection();

            function movieSelection() {
                var embededMessage = message.channel.send(movieBuilder()).then(async sentEmbed => {
                    if (maxNumberOfMovies == 1 && movies.length == 1) {
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
                                fetch("http://"+ombiIP+":"+ombiPort+"/api/v1/Request/movie", {
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
                                        message.reply("This is the part where, YOU RUN AWAY. ");
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
                            message.reply('Ogres only have 2 minutes to fulfill requests. GET OUT OF MY SWAMP!');
                        });

                })
            }
        } else {
            message.reply("You fucking donkey. That search was invalid. GET OUT OF MY SWAMP!");
        }

    },
};