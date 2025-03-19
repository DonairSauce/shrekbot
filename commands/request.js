const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, Collection } = require('discord.js');
const { ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');
const Discord = require('discord.js');
const ombiIP = process.env.ombiip;
const ombiPort = process.env.ombiport;
const ombiToken = process.env.ombitoken;
const timerExp = process.env.timerexp;
let objectsWithoutDefault = [];
const timerManager = new Collection();

const seasonSelections = new Map();

module.exports = {
	seasonSelections,
	data: new SlashCommandBuilder()
		.setName('request')
		.setDescription('Request command to add new media to Plex')
		.addStringOption(option =>
			option.setName('search')
				.setDescription('Enter the name of a TV show or movie.')
				.setMaxLength(75)
				.setRequired(true)),
	async execute(interaction, messageId) {
		// Search term
		let args = interaction.options.getString('search');
		args = args.toString();
		args = args.replace(/,/g, ' ');
		const query = encodeURIComponent(args);
		const idOfFirstItem = await this.getSearchResults(interaction, messageId, query);
		if (idOfFirstItem !== undefined) {
			this.search(idOfFirstItem, interaction);
		}

		console.log('Search for "' + args + '" by ' + interaction.member.user.username + ' done');
	},
	async getSearchResults(interaction, messageId, args) {
		const searchTerm = decodeURIComponent(args);
		console.log(interaction.member.user.username + ' searched for "' + searchTerm + '"');
		// Api call
		let searchResults = {};
		const body = {
			movies: true, tvShows: true, music: false, people: false,
		};
		try {
			searchResults = await fetch('http://' + ombiIP + ':' + ombiPort + '/api/v2/Search/multi/' + args, {
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
			idOfFirstItem = `${mediaResults[0].mediaType + ',' + mediaResults[0].id + ',' + messageId + ',' + args}`;

			objectsWithoutDefault = [];
			mediaResults.forEach(o => {
				const emoji = o.mediaType === 'movie' ? '🎥' : '📺';
				objectsWithoutDefault.push({
					label: `${o.title.substr(0, 97) + '...'}`,
					description: `${o.overview.substr(0, 97) + '...'}`,
					value: `${o.mediaType + ',' + o.id + ',' + messageId + ',' + args}`,
					emoji,
				});
			});

			if (idOfFirstItem) {
				return idOfFirstItem;
			}
		} else {
			try {
				console.log('No results found for "' + searchTerm + '"');
				interaction.reply({ content: 'No results available for: "' + searchTerm + '". Please try searching again.', ephemeral: true });
			} catch (err) {
				console.log(err);
			}
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
			apiSubUrl = '/api/v2/Search/movie/';
		}

		if (mediaType === 'tv') {
			isTv = true;
			apiSubUrl = '/api/v2/Search/tv/moviedb/';
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

		// Build an object with the TV/movie info
		const object = {
			id: info.id,
			releaseDate: (mediaType === 'movie' ? info.releaseDate : info.firstAired),
			title: info.title,
			description: info.overview,
			image: (mediaType === 'movie' ? info.posterPath : info.banner),
			imdbID: info.imdbId,
			available: info.available,
			requested: info.requested,
		};

		// Embed builder
		function showBuilder() {
			try {
				const embed = new Discord.EmbedBuilder()
					.setColor('#0099ff')
					.setTitle(object.title + (object.releaseDate === null ? '' : (' (' + object.releaseDate.substring(0, 4) + ')')))
					.setURL('https://imdb.com/title/' + object.imdbID)
					.setDescription(object.description ? object.description.substr(0, 255) + '(...)' : 'No description')
					.setImage('https://image.tmdb.org/t/p/original/' + object.image)
					.setTimestamp()
					.setFooter({
						text: 'Searched by ' + interaction.member.user.username,
						iconURL: `https://cdn.discordapp.com/avatars/${interaction.member.user.id}/${interaction.member.user.avatar}.png`,
					});

				if (object.available) {
					embed.addFields([{ name: '__Available__', value: '✅', inline: true }]);
				}

				if (object.requested) {
					embed.addFields([{ name: '__Requested__', value: '✅', inline: true }]);
				}

				return embed;
			} catch (err) {
				console.log('error in showBuilder: ' + err);
			}
		}

		// Timer for auto cleanup
		function timeOut(interaction) {
			if (timerManager.has(messageId)) {
				clearTimeout(timerManager.get(messageId));
			}
			const timer = setTimeout(() => {
				try {
					console.log('Search for ' + info.title + ' timed out');
					interaction.followUp({ content: 'Your request for ' + info.title + ' timed out', ephemeral: true });
					interaction.deleteReply();
				} catch (err) {
					console.log(err);
				}
			}, timerExp);
			timerManager.set(messageId, timer);
		}

		const embedMessage = showBuilder();

		// Build the request button row
		const row = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('request-button-' + movieDbId + '-' + mediaType + '-' + messageId)
					.setStyle(ButtonStyle.Primary)
					.setLabel('Request'),
			);

		// Build the dropdown for making another selection
		const objectSelect = new StringSelectMenuBuilder()
			.setCustomId('media_selector')
			.setPlaceholder('Make another selection')
			.addOptions(objectsWithoutDefault);
		const selectMenu = new ActionRowBuilder().addComponents(objectSelect);

		// Build the overall components array. For TV shows, add a season selection dropdown.
		let componentsArray = [selectMenu, row];

		if (isTv) {
			const seasonOptions = [
				{
					label: 'Request All Seasons',
					description: 'Request every season of the show',
					value: 'all',
				},
				{
					label: 'Request Specific Season',
					description: 'Choose a specific season',
					value: 'specific',
				},
			];
			// Include the messageId in the customId so we can later map the selection.
			const seasonSelect = new StringSelectMenuBuilder()
				.setCustomId('season_selector-' + messageId)
				.setPlaceholder('Select season option')
				.addOptions(seasonOptions);
			const seasonRow = new ActionRowBuilder().addComponents(seasonSelect);
			// Insert seasonRow after the selectMenu
			componentsArray.splice(1, 0, seasonRow);
		}

		// Send reply/update depending on the interaction state.
		try {
			if (interaction.message === undefined) {
				if (object.requested || object.available) {
					interaction.reply({
						embeds: [embedMessage],
						components: componentsArray.concat([
							new ActionRowBuilder().addComponents(
								new ButtonBuilder()
									.setCustomId('mediaAvailable')
									.setLabel(object.title.substr(0, 58) + ' Is Already ' + (object.available ? 'Available' : 'Requested') + '!')
									.setStyle(ButtonStyle.Primary)
									.setDisabled(true),
							),
						]),
					}).then(() => {
						timeOut(interaction);
					});
				} else {
					interaction.reply({ embeds: [embedMessage], components: componentsArray }).then(() => {
						timeOut(interaction);
					});
				}
			} else if (object.requested || object.available) {
				interaction.update({
					embeds: [embedMessage],
					components: componentsArray.concat([
						new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setCustomId('mediaAvailable')
								.setLabel(object.title.substr(0, 58) + ' Is Already ' + (object.available ? 'Available' : 'Requested') + '!')
								.setStyle(ButtonStyle.Primary)
								.setDisabled(true),
						),
					]),
				}).then(() => {
					timeOut(interaction);
				});
			} else {
				interaction.update({ embeds: [embedMessage], components: componentsArray }).then(() => {
					timeOut(interaction);
				});
			}
		} catch (err) {
			console.log(err);
		}
	},

	async sendRequest(interaction, id, mediaType, messageId, seasonSelection) {
		const processing = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('processing')
				.setStyle(ButtonStyle.Success)
				.setLabel('Your request is processing')
				.setDisabled(true),
		);

		await interaction.message.edit({
			components: [processing],
		});
		clearTimeout(timerManager.get(messageId));
		const { member } = interaction;
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
				})
					.then(res => {
						responseStatus = res.status;
						return res.json();
					})
					.then(async jsonResponse => {
						await changeButton(responseStatus, jsonResponse);
					})
					.catch(err => {
						console.error(err);
					});
			} catch (err) {
				console.error(err);
			}
		} else if (mediaType === 'tv') {
			// Build the request body based on the season selection.
			let requestBody = {
				theMovieDbId: id,
				languageCode: 'en',
			};

			// If no specific season was stored or the selection is "all", request all seasons.
			if (!seasonSelection || seasonSelection === 'all') {
				requestBody.requestAll = true;
			} else {
				// If a specific season number is provided:
				requestBody.requestAll = false;
				requestBody.latestSeason = false;
				requestBody.firstSeason = false;
				requestBody.seasons = [
					{
						seasonNumber: parseInt(seasonSelection, 10),
						episodes: [] // Request all episodes of that season.
					}
				];
			}

			try {
				fetch('http://' + ombiIP + ':' + ombiPort + '/api/v2/Requests/tv', {
					method: 'post',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						ApiKey: ombiToken,
						ApiAlias: member.user.username + '#' + member.user.discriminator + ',' + member.user.id,
					},
					body: JSON.stringify(requestBody),
				})
					.then(res => {
						responseStatus = res.status;
						return res.json();
					})
					.then(async jsonResponse => {
						await changeButton(responseStatus, jsonResponse);
					})
					.catch(err => {
						console.error(err);
					});
			} catch (err) {
				console.error(err);
			}
		}

		async function changeButton(responseStatusCode, jsonResponse) {
			console.log(jsonResponse);
			let success = false;
			console.log('response code ' + responseStatusCode);
			success = responseStatusCode >= 200 && responseStatusCode < 300;
			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('request-sent-button-' + id + '-' + mediaType + '-' + messageId)
					.setStyle(success && !jsonResponse.isError ? ButtonStyle.Success : ButtonStyle.Danger)
					.setLabel(success && !jsonResponse.isError ? 'Your request has been submitted' : 'Request Failed: Error ' + responseStatusCode)
					.setDisabled(true),
			);
			await interaction.message.edit({
				components: [row],
			});
		}

		console.log('All done, now get out of my swamp');
	}
};
