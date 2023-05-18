/* eslint-disable no-undef */
const {SlashCommandBuilder} = require('@discordjs/builders');
const {ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, Collection} = require('discord.js');
const {ButtonStyle} = require('discord.js');
const fetch = require('node-fetch');
const Discord = require('discord.js');
const ombiIP = process.env.ombiip;
const ombiPort = process.env.ombiport;
const ombiToken = process.env.ombitoken;
const timerExp = process.env.timerexp;
let objectsWithoutDefault = [];
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
		const args = interaction.options.getString('search');
		console.log(interaction.member.user.username + ' searched for "' + args + '"');

		const idOfFirstItem = await this.getSearchResults(interaction, messageId, args);
		if (idOfFirstItem !== undefined) {
			this.search(idOfFirstItem, interaction);
		}

		console.log('Search for "' + args + '" by ' + interaction.member.user.username + ' done');
	},
	async getSearchResults(interaction, messageId, args) {
		// Search term
		args = args.toString();
		args = args.replace(/,/g, ' ');
		const query = encodeURIComponent(args);
		// Api call
		let searchResults = {};
		const body = {
			movies: true, tvShows: true, music: false, people: false,
		};
		try {
			searchResults = await fetch('http://' + ombiIP + ':' + ombiPort + '/api/v2/Search/multi/' + query, {
				method: 'post',
				body: JSON.stringify(body),
				headers: {
					accept: 'text/plain',
					ApiKey: ombiToken,
					'Content-Type': 'application/json-patch+json',
				},

			}).then(response => response.json());
		} catch (err) {
			console.log(err);
		}

		// Place results into an object
		if (Object.keys(searchResults).length > 0) {
			const mediaResults = [];
			let maxResults = 10;

			if (Object.keys(searchResults).length < maxResults) {
				maxResults = Object.keys(searchResults).length;
			}

			for (let i = 0; i < maxResults; i++) {
				const object = {};

				object.id = searchResults[i].id;

				object.mediaType = searchResults[i].mediaType;
				object.title = searchResults[i].title;
				object.overview = searchResults[i].overview;
				object.poster = searchResults[i].poster;
				mediaResults.push(object);
			}

			// Reply with dropdown selection
			let idOfFirstItem = '';
			idOfFirstItem = `${mediaResults[0].mediaType + ',' + mediaResults[0].id + ',' + messageId + ',' + query}`;

			objectsWithoutDefault = [];
			mediaResults.forEach(o => {
				const emoji = o.mediaType === 'movie' ? '🎥' : '📺';
				objectsWithoutDefault.push({
					label: `${o.title}`,
					description: `${o.overview.substr(0, 97) + '...'}`,
					value: `${o.mediaType + ',' + o.id + ',' + messageId + ',' + query}`,
					emoji,
				});
			});

			if (idOfFirstItem) {
				return idOfFirstItem;
			}
		} else {
			console.log('No results found for "' + args + '"');
			interaction.reply({content: 'No results available for: "' + args + '". Please try searching again.', ephemeral: true});
		}
	},

	async search(id, interaction) {
		const splitArray = id.split(',');
		const mediaType = splitArray[0];
		const movieDbId = splitArray[1];
		const messageId = splitArray[2];
		const searchQuery = splitArray[3];
		await this.getSearchResults(interaction, messageId, searchQuery);

		let isMovie = false;
		let isTv = false;
		let apiSubUrl;

		if (mediaType === 'movie') {
			isMovie = true;
		}

		if (mediaType === 'tv') {
			isTv = true;
		}

		if (isTv) {
			apiSubUrl = '/api/v2/Search/tv/moviedb/';
		}

		if (isMovie) {
			apiSubUrl = '/api/v2/Search/movie/';
		}

		let info;

		try {
			info = await fetch('http://' + ombiIP + ':' + ombiPort + apiSubUrl + movieDbId, {
				method: 'get',
				headers: {
					accept: 'application/json',
					ApiKey: ombiToken,
				},
			}).then(response => response.json());
		} catch (err) {
			console.log(err);
		}

		const object = {};

		object.id = info.id;
		object.releaseDate = (mediaType === 'movie' ? info.releaseDate : info.firstAired);
		object.title = info.title;
		object.description = info.overview;
		object.image = (mediaType === 'movie' ? info.posterPath : info.banner);
		object.imdbID = info.imdbId;
		object.available = info.available;
		object.requested = info.requested;

		const {member} = interaction;

		function showBuilder() {
			try {
				const embed = new Discord.EmbedBuilder()
					.setColor('#0099ff')
					.setTitle(object.title + (object.releaseDate === null ? '' : (' (' + object.releaseDate.substring(0, 4) + ')')))
					.setURL('https://imdb.com/title/' + object.imdbID)
					.setDescription(object.description === undefined ? 'No description' : object.description.substr(0, 255) + '(...)')
					.setImage('https://image.tmdb.org/t/p/original/' + object.image)
					.setTimestamp()
					.setFooter({
						text: 'Searched by ' + member.user.username,
						iconURL: `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`,
					});

				if (object.available) {
					embed.addFields([{name: '__Available__', value: '✅', inline: true}]);
				}

				if (object.requested) {
					embed.addFields([{name: '__Requested__', value: '✅', inline: true}]);
				}

				return embed;
			} catch (err) {
				console.log('error showBuilder: ' + err);
			}
		}

		function timeOut(interaction) {
			if (timerManager.has(messageId)) {
				clearTimeout(timerManager.get(messageId));
			}

			const timer = setTimeout(() => {
				console.log('Search for ' + info.title + ' timed out');
				interaction.followUp({content: 'Your request for ' + info.title + ' timed out', ephemeral: true});
				interaction.deleteReply();
			}, timerExp);
			timerManager.set(messageId, timer);
		}

		const embedMessage = showBuilder();
		const row = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('request-button-' + movieDbId + '-' + mediaType + '-' + messageId)
					.setStyle(ButtonStyle.Primary)
					.setLabel('Request'),
			);
		const objectSelect = new StringSelectMenuBuilder()
			.setCustomId('media_selector')
			.setPlaceholder('Make another selection')
			.addOptions(objectsWithoutDefault);

		const selectMenu = new ActionRowBuilder()
			.addComponents(objectSelect);

		const availableOrRequested = object.available ? 'Available' : object.requested ? 'Requested' : '';
		const availableButton = new ButtonBuilder()
			.setCustomId('mediaAvailable')
			.setLabel(object.title + ' Is Already ' + availableOrRequested + '!')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(true);

		if (interaction.message === undefined) {
			if (object.requested || object.available) {
				interaction.reply({embeds: [embedMessage], components: [selectMenu, new ActionRowBuilder().addComponents(availableButton)]}).then(() => {
					timeOut(interaction, messageId);
				});
			} else {
				interaction.reply({embeds: [embedMessage], components: [selectMenu, row]}).then(() => {
					timeOut(interaction, messageId);
				});
			}
		} else if (object.requested || object.available) {
			interaction.update({embeds: [embedMessage], components: [selectMenu, new ActionRowBuilder().addComponents(availableButton)]}).then(() => {
				timeOut(interaction, messageId);
			});
		} else {
			interaction.update({embeds: [embedMessage], components: [selectMenu, row]}).then(() => {
				timeOut(interaction, messageId);
			});
		}
	},

	async sendRequest(interaction, id, mediaType, messageId) {
		clearTimeout(timerManager.get(messageId));
		const {member} = interaction;
		console.log(member.user.username + ' sent a request to Ombi');
		if (mediaType === 'movie') {
			try {
				fetch('http://' + ombiIP + ':' + ombiPort + '/api/v1/Request/movie', {
					method: 'post',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'text/json',
						ApiKey: ombiToken,
						ApiAlias: member.user.username + '#' + member.user.discriminator + ',' + member.user.id,
					},

					body: JSON.stringify({
						theMovieDbId: id,
						languageCode: 'en',
					}),
				}).then(res => {
					responseStatus = res.status; // Store the response status in a variable
					return res.json();
				}).then(jsonResponse => {
					changeButton(responseStatus, jsonResponse); // Pass the response status and jsonResponse to changeButton
				}).catch(err => {
					// Handle error
					console.error(err);
				});
			} catch (err) {
				console.error(err);
			}
		} else {
			try {
				fetch('http://' + ombiIP + ':' + ombiPort + '/api/v2/Requests/tv', {
					method: 'post',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'text/json',
						ApiKey: ombiToken,
						ApiAlias: member.user.username + '#' + member.user.discriminator + ',' + member.user.id,
					},

					body: JSON.stringify({
						theMovieDbId: id,
						requestAll: true,
						languageCode: 'en',
					}),
				}).then(res => {
					responseStatus = res.status; // Store the response status in a variable
					console.log('res.status - ' + responseStatus);
					return res.json();
				}).then(jsonResponse => {
					changeButton(responseStatus, jsonResponse); // Pass the response status and jsonResponse to changeButton
				}).catch(err => {
					// Handle error
					console.error(err);
				});
			} catch (err) {
				console.error(err);
			}
		}

		function changeButton(responseStatusCode, jsonResponse) {
			console.log(jsonResponse);
			let success = false;
			console.log('response code ' + responseStatusCode);
			success = responseStatusCode >= 200 && responseStatusCode < 300;
			const row = new ActionRowBuilder()
				.addComponents(
					new ButtonBuilder()
						.setCustomId('request-sent-button-' + id + '-' + mediaType + '-' + messageId)
						.setStyle(success && !jsonResponse.isError ? ButtonStyle.Success : ButtonStyle.Danger)
						.setLabel(success && !jsonResponse.isError ? 'Your request has been submitted' : 'Request Failed: Error ' + responseStatusCode)
						.setDisabled(true),
				);

			interaction.update({
				components: [row],
			});
		}

		console.log('All done, now get out of my swamp');
	},
};
