const {SlashCommandBuilder} = require('@discordjs/builders');
const {ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, Collection} = require('discord.js');
const {ButtonStyle} = require('discord.js');
const Discord = require('discord.js');
const ServiceFactory = require('../services/serviceFactory.js');
const timerExp = process.env.timerexp;
let objectsWithoutDefault = [];
const timerManager = new Collection();
let mediaService;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('request')
		.setDescription('Request command to add new media to Plex')
		.addStringOption(option =>
			option.setName('search')
				.setDescription('Enter the name of a TV show or movie.')
				.setMaxLength(75)
				.setRequired(true)),
	async execute(interaction, messageId) {
		if (!mediaService) {
			try {
				mediaService = ServiceFactory.createService();
			} catch (error) {
				console.error('Service initialization error:', error);
				return interaction.reply({content: 'Service configuration error. Please contact an administrator.', ephemeral: true});
			}
		}

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
		
		let searchResults = [];
		try {
			const rawResults = await mediaService.search(args);
			searchResults = mediaService.normalizeSearchResults(rawResults);
		} catch (err) {
			console.log(err);
		}

		// Place results into an object
		if (searchResults && searchResults.length > 0) {
			const mediaResults = [];
			let maxResults = 10;

			if (searchResults.length < maxResults) {
				maxResults = searchResults.length;
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
				interaction.reply({content: 'No results available for: "' + searchTerm + '". Please try searching again.', ephemeral: true});
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
			info = await mediaService.getDetails(mediaType, movieDbId);
		} catch (err) {
			console.log(err);
		}

		const object = mediaService.normalizeDetails(info, mediaType);

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
				try {
					console.log('Search for ' + info.title + ' timed out');
					interaction.followUp({content: 'Your request for ' + info.title + ' timed out', ephemeral: true});
					interaction.deleteReply();
				} catch (err) {
					console.log(err);
				}
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
			.setLabel(object.title.substr(0, 58) + ' Is Already ' + availableOrRequested + '!')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(true);
		try {
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
		} catch (err) {
			console.log(err);
		}
	},

	async sendRequest(interaction, id, mediaType, messageId) {
		const processing = new ActionRowBuilder()
			.addComponents(
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
		const {member} = interaction;
		const serviceName = ServiceFactory.getServiceType();
		console.log(member.user.username + ' sent a request to ' + serviceName);
		
		try {
			const userAlias = member.user.username + '#' + member.user.discriminator + ',' + member.user.id;
			const result = await mediaService.makeRequest(mediaType, id, userAlias);
			await changeButton(result.status, result.data, result.success);
		} catch (err) {
			console.error(err);
			await changeButton(500, {error: 'Request failed'}, false);
		}

		async function changeButton(responseStatusCode, jsonResponse, success) {
			console.log(jsonResponse);
			console.log('response code ' + responseStatusCode);
			const row = new ActionRowBuilder()
				.addComponents(
					new ButtonBuilder()
						.setCustomId('request-sent-button-' + id + '-' + mediaType + '-' + messageId)
						.setStyle(success ? ButtonStyle.Success : ButtonStyle.Danger)
						.setLabel(success ? 'Your request has been submitted' : 'Request Failed: Error ' + responseStatusCode)
						.setDisabled(true),
				);

			await interaction.message.edit({
				components: [row],
			});
		}

		console.log('All done, now get out of my swamp');
	},
};
