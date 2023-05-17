const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, Collection } = require('discord.js');
const { ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');
const Discord = require('discord.js');
const ombiIP = process.env.ombiip;
const ombiPort = process.env.ombiport;
const ombiToken = process.env.ombitoken;

let objectsWithoutDefault = [];
var timerExp = 180000;
const timerManager = new Collection();
module.exports = {
	data: new SlashCommandBuilder()
		.setName('request')
		.setDescription('Request command to add new media to Plex')
		.addStringOption(option =>
			option.setName('search')
				.setDescription('Enter the name of a TV show or movie.')
				.setRequired(true)),
	async execute(interaction, messageId) {
		var args = interaction.options.getString('search');

		//Search term 
		args = args.toString();
		args = args.replace(/,/g, " ");
		const query = encodeURIComponent(args);

		var id = await this.getSearchResults(interaction, messageId, query);
		if (id != undefined) {
			this.search(id, interaction);
		}
	},
	getSearchResults: async function (interaction, messageId, query) {
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
				var object = new Object()

				object.id = searchResults[i].id;

				object.mediaType = searchResults[i].mediaType;
				object.title = searchResults[i].title;
				object.overview = searchResults[i].overview;
				object.poster = searchResults[i].poster;
				mediaResults.push(object);
			}


			//reply with dropdown selection
			let idOfFirstItem = "";
			idOfFirstItem = `${mediaResults[0].mediaType + "," + mediaResults[0].id + "," + messageId + "," + query}` 
	
			objectsWithoutDefault = [];
			mediaResults.forEach(o => {
				let emoji = o.mediaType == 'movie' ? '🎥' : '📺';
				objectsWithoutDefault.push({
					label: `${o.title}`,
					description: `${o.overview.substr(0, 97) + '...'}`,
					value: `${o.mediaType + "," + o.id + "," + messageId + "," + query}`,
					emoji: (emoji)
				});
			});
			
			if(idOfFirstItem){
				return idOfFirstItem;
			}

		} else {
			interaction.reply({ content: 'No results available for: "' + query + '". Please try searching again.', ephemeral: true });
		}
	},

	search: async function (id, interaction) {
		console.log(id);
		var splitArray = id.split(',');
		var mediaType = splitArray[0];
		var id = splitArray[1];
		var messageId = splitArray[2];
		var searchQuery = splitArray[3];
		console.log(searchQuery);
		await this.getSearchResults(interaction, messageId, searchQuery);

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
				const embed = new Discord.EmbedBuilder()
					.setColor('#0099ff')
					.setTitle(object.title + (object.releaseDate == null ? '' : (' (' + object.releaseDate.substring(0, 4) + ')')))
					.setURL('https://imdb.com/title/' + object.imdbID)
					.setDescription(object.description == undefined ? 'No description' : object.description.substr(0, 255) + '(...)')
					.setImage('https://image.tmdb.org/t/p/original/' + object.image)
					.setTimestamp()
					.setFooter({
						text: "Searched by " + member.user.username,
						iconURL: `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
					})

				if (object.available) embed.addFields([{ name: '__Available__', value: '✅', inline: true }]);
				if (object.requested) embed.addFields([{ name: '__Requested__', value: '✅', inline: true }]);

				return embed;
			} catch (err) {
				console.log("error showBuilder: " + err)

			}

		}


		function timeOut(interaction) {
			if (timerManager.has(messageId)) {
				console.log('Clear time out');
				clearTimeout(timerManager.get(messageId))
			}
			console.log('Times out in ' + timerExp / 1000 + 'seconds.');
			const timer = setTimeout(function () {
				interaction.followUp({ content: 'Your request for ' + info.title + ' timed out', ephemeral: true });
				interaction.deleteReply();
			}, timerExp);
			timerManager.set(messageId, timer);
		}

		const embedMessage = showBuilder();
		const row = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('request-button-' + id + '-' + mediaType + '-' + messageId)
					.setStyle(ButtonStyle.Primary)
					.setLabel('Request')
			)
		const objectSelect = new StringSelectMenuBuilder()
			.setCustomId('media_selector')
			.setPlaceholder('Make another selection')
			.addOptions(objectsWithoutDefault);


		let selectMenu = new ActionRowBuilder()
			.addComponents(objectSelect);

		let availableOrRequested = object.available ? "Available" : object.requested ? "Requested" : "";
		const availableButton = new ButtonBuilder()
			.setCustomId('mediaAvailable')
			.setLabel(object.title + ' Is Already ' + availableOrRequested + "!")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(true);

		if (interaction.message == undefined) {
			console.log("reply");
			if (object.requested || object.available) {
				interaction.reply({ embeds: [embedMessage], components: [selectMenu, new ActionRowBuilder().addComponents(availableButton)] }).then(() => {
					timeOut(interaction, messageId);
				});
			} else {
				interaction.reply({ embeds: [embedMessage], components: [selectMenu, row] }).then(() => {
					timeOut(interaction, messageId);
				});
			}
		} else {
			console.log("update");
			if (object.requested || object.available) {
				interaction.update({ embeds: [embedMessage], components: [selectMenu, new ActionRowBuilder().addComponents(availableButton)] }).then(() => {
					timeOut(interaction, messageId);
				});
			} else {
				interaction.update({ embeds: [embedMessage], components: [selectMenu, row] }).then(() => {
					timeOut(interaction, messageId);
				});
			}
		}

	},

	sendRequest: async function (interaction, id, mediaType, messageId) {
		clearTimeout(timerManager.get(messageId))
		const { member } = interaction;
		console.log("interaction: " + interaction);
		console.log("id: " + id);
		console.log("mediaType: " + mediaType);
		console.log('requester: ' + member.user.username + "#" + member.user.discriminator);

		if (mediaType == 'movie') {
			try {
				fetch("http://" + ombiIP + ":" + ombiPort + "/api/v1/Request/movie", {
					method: "post",
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'text/json',
						'ApiKey': ombiToken,
						'ApiAlias': member.user.username + '#' + member.user.discriminator + ',' + member.user.id
					},

					body: JSON.stringify({
						'theMovieDbId': id,
						'languageCode': "en"
					})
				}).then((res) => {
					responseStatus = res.status; // Store the response status in a variable
					console.log("res.status - " + responseStatus);
					return res.json();
				}).then((jsonResponse) => {
					changeButton(responseStatus, jsonResponse); // Pass the response status and jsonResponse to changeButton
				}).catch((err) => {
					// handle error
					console.error(err);
				});
			} catch (err) {
				console.error(err);
			}
		} else {
			try {
				fetch("http://" + ombiIP + ":" + ombiPort + "/api/v2/Requests/tv", {
					method: "post",
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'text/json',
						'ApiKey': ombiToken,
						'ApiAlias': member.user.username + '#' + member.user.discriminator + ',' + member.user.id
					},

					body: JSON.stringify({
						'theMovieDbId': id,
						'requestAll': true,
						'languageCode': "en"
					})
				}).then((res) => {
					responseStatus = res.status; // Store the response status in a variable
					console.log("res.status - " + responseStatus);
					return res.json();
				}).then((jsonResponse) => {
					changeButton(responseStatus, jsonResponse); // Pass the response status and jsonResponse to changeButton
				}).catch((err) => {
					// handle error
					console.error(err);
				});
			} catch (err) {
				console.error(err);
			}
		}

		function changeButton(responseStatusCode, jsonResponse) {
			console.log(jsonResponse);
			let success = false;
			console.log("response code " + responseStatusCode);
			success = responseStatusCode >= 200 && responseStatusCode < 300;
			const row = new ActionRowBuilder()
				.addComponents(
					new ButtonBuilder()
						.setCustomId('request-sent-button-' + id + '-' + mediaType + '-' + messageId)
						.setStyle(success && !jsonResponse.isError ? ButtonStyle.Success : ButtonStyle.Danger)
						.setLabel(success && !jsonResponse.isError ? 'Your request has been submitted' : 'Request Failed: Error ' + responseStatusCode)
						.setDisabled(true)
				);

			interaction.update({
				components: [row]
			});
		}
	}
}