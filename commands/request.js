const { SlashCommandBuilder } = require('@discordjs/builders');
const {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	ButtonBuilder,
	Collection,
	ButtonStyle,
} = require('discord.js');
const fetch = require('node-fetch');
const Discord = require('discord.js');

const ombiIP = process.env.ombiip;
const ombiPort = process.env.ombiport;
const ombiToken = process.env.ombitoken;
const timerExp = process.env.timerexp;

let objectsWithoutDefault = [];
const timerManager = new Collection();
const seasonSelections = new Map();
const availableSeasons = new Map();

module.exports = {
	seasonSelections,
	availableSeasons,
	data: new SlashCommandBuilder()
		.setName('request')
		.setDescription('Request command to add new media to Plex')
		.addStringOption(option =>
			option.setName('search')
				.setDescription('Enter the name of a TV show or movie.')
				.setMaxLength(75)
				.setRequired(true)
		),
	async execute(interaction, messageId) {
		let args = interaction.options.getString('search').toString().replace(/,/g, ' ');
		const query = encodeURIComponent(args);
		const idOfFirstItem = await this.getSearchResults(interaction, messageId, query);
		if (idOfFirstItem !== undefined) {
			this.search(idOfFirstItem, interaction);
		}
		console.log(`Search for "${args}" by ${interaction.member.user.username} done`);
	},
	async getSearchResults(interaction, messageId, args) {
		const searchTerm = decodeURIComponent(args);
		console.log(`${interaction.member.user.username} searched for "${searchTerm}"`);
		const body = { movies: true, tvShows: true, music: false, people: false };
		let searchResults = {};
		try {
			searchResults = await fetch(`http://${ombiIP}:${ombiPort}/api/v2/Search/multi/${args}`, {
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
	
		if (Object.keys(searchResults).length > 0) {
			const mediaResults = [];
			const maxResults = Math.min(10, Object.keys(searchResults).length);
			for (let i = 0; i < maxResults; i++) {
				const o = searchResults[i];
				mediaResults.push({
					label: o.title.length > 97 ? o.title.substr(0, 97) + '...' : o.title,
					value: `${o.mediaType},${o.id},${messageId},${args}`,
					emoji: o.mediaType === 'movie' ? '🎥' : '📺',
					// Only include description if overview is non-empty
					...(o.overview && o.overview.trim()
						? {
								description:
									o.overview.length > 97
										? o.overview.substr(0, 97) + '...'
										: o.overview,
						  }
						: {}),
				});
			}
			objectsWithoutDefault = mediaResults;
			return mediaResults[0].value;
		} else {
			console.log(`No results found for "${searchTerm}"`);
			try {
				interaction.reply({
					content: `No results available for: "${searchTerm}". Please try again.`,
					ephemeral: true,
				});
			} catch (err) {
				console.log(err);
			}
		}
	},
	async search(id, interaction) {
		const [mediaType, movieDbId, messageId, searchQuery] = id.split(',');
		await this.getSearchResults(interaction, messageId, searchQuery);
		const isMovie = mediaType === 'movie';
		const isTv = mediaType === 'tv';
		const apiSubUrl = isMovie ? '/api/v2/Search/movie/' : '/api/v2/Search/tv/moviedb/';
		let info;
		try {
			info = await fetch(`http://${ombiIP}:${ombiPort}${apiSubUrl}${movieDbId}`, {
				method: 'get',
				headers: { accept: 'application/json', ApiKey: ombiToken },
			}).then(response => response.json());
		} catch (err) {
			console.log(err);
		}

		const object = {
			id: info.id,
			releaseDate: isMovie ? info.releaseDate : info.firstAired,
			title: info.title,
			description: info.overview,
			image: isMovie ? info.posterPath : info.banner,
			imdbID: info.imdbId,
			available: info.available,
			requested: info.requested,
		};

		function showBuilder() {
			try {
				const embed = new Discord.EmbedBuilder()
					.setColor('#0099ff')
					.setTitle(object.title + (object.releaseDate ? ` (${object.releaseDate.substring(0, 4)})` : ''))
					.setURL(`https://imdb.com/title/${object.imdbID}`)
					.setDescription(object.description ? object.description.substr(0, 255) + '(...)' : 'No description')
					.setImage(`https://image.tmdb.org/t/p/original/${object.image}`)
					.setTimestamp()
					.setFooter({
						text: `Searched by ${interaction.member.user.username}`,
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
				console.log('error in showBuilder:', err);
			}
		}

		function timeOut(interaction) {
			if (timerManager.has(messageId)) clearTimeout(timerManager.get(messageId));
			const timer = setTimeout(() => {
				try {
					console.log(`Search for ${info.title} timed out`);
					interaction.followUp({ content: `Your request for ${info.title} timed out`, ephemeral: true });
					interaction.deleteReply();
				} catch (err) {
					console.log(err);
				}
			}, timerExp);
			timerManager.set(messageId, timer);
		}

		const embedMessage = showBuilder();

		const objectSelect = new StringSelectMenuBuilder()
			.setCustomId('media_selector')
			.setPlaceholder('Make another selection')
			.addOptions(objectsWithoutDefault);
		const selectMenu = new ActionRowBuilder().addComponents(objectSelect);
		let componentsArray = [selectMenu];

		if (isTv) {
			// Build season options starting with "All Seasons"
			let seasonOptions = [{
				label: 'All Seasons',
				description: 'Request every season of the show',
				value: 'all',
				default: true,
			}];
		
			let additionalSeasonOptions = [];
			let available = []; // List of available season numbers
			if (info.seasonRequests && Array.isArray(info.seasonRequests)) {
				info.seasonRequests.forEach(seasonObj => {
					if (typeof seasonObj.seasonNumber !== 'undefined') {
						additionalSeasonOptions.push({
							label: `Season ${seasonObj.seasonNumber}`,
							description: `Request Season ${seasonObj.seasonNumber}`,
							value: seasonObj.seasonNumber.toString(),
						});
						available.push(seasonObj.seasonNumber);
					}
				});
			}
			// If too many options, limit additional options and add "Other"
			if (additionalSeasonOptions.length > 23) {
				additionalSeasonOptions = additionalSeasonOptions.slice(0, 23);
				additionalSeasonOptions.push({
					label: 'Other...',
					description: 'Request a season not listed',
					value: 'other',
				});
			}
			seasonOptions = seasonOptions.concat(additionalSeasonOptions);
		
			// Store available season numbers for validation
			availableSeasons.set(messageId, available);
		
			const seasonSelect = new StringSelectMenuBuilder()
				.setCustomId(`season_selector-${messageId}`)
				.setPlaceholder('Select season option(s)')
				.addOptions(seasonOptions)
				.setMinValues(1)
				.setMaxValues(seasonOptions.length);
			const seasonRow = new ActionRowBuilder().addComponents(seasonSelect);
			componentsArray.push(seasonRow);
		}				

		if (!(object.requested || object.available)) {
			const requestRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`request-button-${movieDbId}-${mediaType}-${messageId}`)
					.setStyle(ButtonStyle.Primary)
					.setLabel('Request')
			);
			componentsArray.push(requestRow);
		} else {
			const disabledRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('mediaAvailable')
					.setLabel(`${object.title.substr(0, 58)} Is Already ${object.available ? 'Available' : 'Requested'}!`)
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true)
			);
			componentsArray.push(disabledRow);
		}

		try {
			if (!interaction.message) {
				interaction.reply({ embeds: [embedMessage], components: componentsArray }).then(() => {
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
				.setDisabled(true)
		);
		await interaction.message.edit({ components: [processing] });
		clearTimeout(timerManager.get(messageId));
		const { member } = interaction;
		console.log(`${member.user.username} sent a request to Ombi`);
	
		if (mediaType === 'movie') {
			try {
				fetch(`http://${ombiIP}:${ombiPort}/api/v1/Request/movie`, {
					method: 'post',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'text/json',
						ApiKey: ombiToken,
						ApiAlias: `${member.user.username}#${member.user.discriminator},${member.user.id}`,
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
			let requestBody = { theMovieDbId: id, languageCode: 'en' };
			if (Array.isArray(seasonSelection)) {
				if (seasonSelection.includes('all')) {
					requestBody.requestAll = true;
				} else {
					requestBody.requestAll = false;
					requestBody.latestSeason = false;
					requestBody.firstSeason = false;
					requestBody.seasons = seasonSelection.map(s => ({
						seasonNumber: parseInt(s, 10),
						episodes: []
					}));
				}
			} else {
				requestBody.requestAll = true;
			}
	
			try {
				fetch(`http://${ombiIP}:${ombiPort}/api/v2/Requests/tv`, {
					method: 'post',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						ApiKey: ombiToken,
						ApiAlias: `${member.user.username}#${member.user.discriminator},${member.user.id}`,
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
			const success = responseStatusCode >= 200 && responseStatusCode < 300;
			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`request-sent-button-${id}-${mediaType}-${messageId}`)
					.setStyle(success && !jsonResponse.isError ? ButtonStyle.Success : ButtonStyle.Danger)
					.setLabel(success && !jsonResponse.isError ? 'Your request has been submitted' : `Request Failed: Error ${responseStatusCode}`)
					.setDisabled(true)
			);
			await interaction.message.edit({ components: [row] });
		}
		console.log('All done, now get out of my swamp');
	}
};
