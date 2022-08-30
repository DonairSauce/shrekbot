const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageSelectMenu, MessageMenuOption, MessageMenu, MessageButton } = require('discord.js');
const fetch = require('node-fetch');
const Discord = require('discord.js');
const ombiIP = process.env.ombiip;
const ombiPort = process.env.ombiport;
const ombiToken = process.env.ombitoken;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('request')
		.setDescription('Request command to add new media to 00ze')
		.addStringOption(option =>
			option.setName('search')
				.setDescription('Enter the name of a TV show or movie.')
				.setRequired(true)),
	async execute(interaction) {
		var args = interaction.options.getString('search');
		
		//Search term 
		args = args.toString();
		args = args.replace(/,/g, " ");
		const query = encodeURIComponent(args);

		//api call 
		var searchResults = {};
		const body = {
			movies: true, tvShows: true, music: false, people: false
		}
		try {
			searchResults = await fetch("http://" + ombiIP + ":" + ombiPort + "/api/v2/Search/multi/" + query, {
				method: "post",
				body: JSON.stringify(body),
				headers: {
					'accept': 'text/plain',
					'ApiKey': ombiToken,
					'Content-Type': 'application/json-patch+json'
				},

			}).then(response => response.json());

		} catch (err) {
			console.log(err);
		}

		//place results into an object
		if (Object.keys(searchResults).length > 0) {
			var mediaResults = [];
			var maxResults = 10;

			if (Object.keys(searchResults).length < maxResults) {
				maxResults = Object.keys(searchResults).length;
			}
			for (var i = 0; i < maxResults; i++) {
				var object = new Object(),
					id,
					mediaType,
					title,
					overview,
					poster


				object.id = searchResults[i].id;

				object.mediaType = searchResults[i].mediaType;
				object.title = searchResults[i].title;
				object.overview = searchResults[i].overview;
				object.poster = searchResults[i].poster;
				mediaResults.push(object);
			}


			//reply with dropdown selection

			let objects = [];

			mediaResults.forEach(o => {
				let emoji = o.mediaType == 'movie' ? '🎥' : '📺';
				objects.push({
					label: `${o.title}`,
					description: `${o.overview.substr(0, 97) + '...'}`,
					value: `${o.mediaType + "," + o.id}`,
					emoji: (emoji)
				});
			});

			const objectSelect = new MessageSelectMenu()
				.setCustomId('media_selector')
				.setPlaceholder('Please make a selection')
				.addOptions(objects);

			let row = new MessageActionRow()
				.addComponents(objectSelect);

			await interaction.reply({ content: 'Search Results for ' + args, components: [row] });

		}
	},

	search: async function (id, interaction) {
		var splitArray = id.split(',');
		var mediaType = splitArray[0];
		var id = splitArray[1];
		let isMovie = false;
		let isTv = false;
		let apiSubUrl;

		if (mediaType == "movie") isMovie = true;
		if (mediaType == "tv") isTv = true;

		if (isTv) apiSubUrl = "/api/v2/Search/tv/moviedb/";
		if (isMovie) apiSubUrl = "/api/v2/Search/movie/";
		var info;

		try {
			info = await fetch("http://" + ombiIP + ":" + ombiPort + apiSubUrl + id, {
				method: "get",
				headers: {
					'accept': 'application/json',
					'ApiKey': ombiToken
				}
			}).then(response => response.json());

		} catch (err) {
			console.log(err);

		}

		var object = new Object();

		object.id = info.id;
		object.releaseDate = (mediaType == 'movie' ? info.releaseDate : info.firstAired);
		object.title = info.title;
		object.description = info.overview;
		object.image = (mediaType == 'movie' ? info.posterPath : info.banner);
		object.imdbID = info.imdbId;
		object.available = info.available;
		object.requested = info.requested;

		const { member } = interaction;

		function showBuilder() {
			try {


				const embed = new Discord.MessageEmbed()
					.setColor('#0099ff')
					.setTitle(object.title + (object.releaseDate == null ? '' : (' (' + object.releaseDate.substring(0, 4) + ')')))
					.setURL('https://imdb.com/title/' + object.imdbID)
					.setDescription(object.description == undefined ? 'No description' : object.description.substr(0, 255) + '(...)')
					.setImage('https://image.tmdb.org/t/p/original/' + object.image)
					.setTimestamp()
					.setFooter({
						text: "Requested by " + member.user.username,
						iconURL: `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
					})
				if (object.available) embed.addField('__Available__', '✅', true);
				if (object.requested) embed.addField('__Requested__', '✅', true);

				return embed;
			} catch (err) {
				console.log("error showBuilder: " + err)

			}

		}
		const embedMessage = showBuilder();
		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('request-button-' + id + '-' + mediaType)
					.setStyle('PRIMARY')
					.setLabel('Request')
			)
		if (object.requested || object.available) {
			interaction.reply({ embeds: [embedMessage] });
		} else {
			interaction.reply({ embeds: [embedMessage], components: [row] });
		}

	},

	sendRequest: async function (interaction, id, mediaType) {
		const { member } = interaction;
		console.log("interaction: " + interaction);
		console.log("id: " + id);
		console.log("mediaType: " + mediaType);
		var dbId = (mediaType == 'movie' ? 'theMovieDbId' : 'tvDbId');
		console.log("dbId: " + dbId);
		console.log('requester: ' + member.user.username + "#" + member.user.discriminator)
		if (mediaType == 'movie') {
			fetch("http://" + ombiIP + ":" + ombiPort + "/api/v1/Request/movie", {
				method: "post",
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'text/json',
					'ApiKey': ombiToken,
					'ApiAlias': member.user.username + "#" + member.user.discriminator
				},

				body: JSON.stringify({
					'theMovieDbId': id,
					'languageCode': "en"
				})
			}).then((res) => {
				status = res.status;
				return res.json()
			})
				.then((jsonResponse) => {
					console.log(jsonResponse);
					console.log(status);
				})
				.catch((err) => {
					// handle error
					console.error(err);
				});
		} else {
			fetch("http://" + ombiIP + ":" + ombiPort + "/api/v2/Requests/tv", {
				method: "post",
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'text/json',
					'ApiKey': ombiToken,
					'ApiAlias': member.user.username + "#" + member.user.discriminator

				},

				body: JSON.stringify({
					'theMovieDbId': id,
					'requestAll': true,
					'languageCode': "en"
				})
			}).then((res) => {
				status = res.status;
				return res.json()
			})
				.then((jsonResponse) => {
					console.log(jsonResponse);
					console.log(status);
				})
				.catch((err) => {
					// handle error
					console.error(err);
				});
		}


	}

}