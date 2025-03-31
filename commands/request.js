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
const remainingSeasons = new Map();

module.exports = {
	seasonSelections,
	availableSeasons,
	remainingSeasons,
	data: new SlashCommandBuilder()
		.setName('request')
		.setDescription('Request command to add new media to Plex')
		.addStringOption(option =>
			option.setName('search')
				.setDescription('Enter the name of a TV show or movie.')
				.setMaxLength(75)
				.setRequired(true)
		)
		.addStringOption(option =>
			option.setName('seasons')
				.setDescription('Optional: Seasons to request (e.g. "1,3,5" or "1-3")')
				.setRequired(false)
		),
	async execute(interaction, messageId) {
		let args = interaction.options.getString('search').toString().replace(/,/g, ' ');
		const query = encodeURIComponent(args);
		const seasonsArg = interaction.options.getString('seasons');

		const idOfFirstItem = await this.getSearchResults(interaction, messageId, query);
		if (idOfFirstItem !== undefined) {
			if (seasonsArg) {
				const [mediaType, movieDbId, msgId, searchQuery] = idOfFirstItem.split(',');
				await this.search(idOfFirstItem, interaction);

				let seasonNumbers = [];
				const input = seasonsArg.toLowerCase().trim();

				if (!input || input === 'all' || input === 'all seasons') {
					seasonNumbers = ['all'];
				} else if (input.includes('-')) {
					const [start, end] = input.split('-').map(Number);
					if (!isNaN(start) && !isNaN(end) && start <= end) {
						for (let i = start; i <= end; i++) {
							seasonNumbers.push(i.toString());
						}
					}
				} else if (input.includes(',')) {
					seasonNumbers = input.split(',').map(s => s.trim());
				} else {
					seasonNumbers = [input];
				}

				// Save the seasons and send request directly
				this.seasonSelections.set(messageId, seasonNumbers);
				await this.sendRequest(interaction, movieDbId, mediaType, messageId, seasonNumbers);
				await interaction.followUp({
					content: `✅ Your request for seasons ${seasonNumbers.join(', ')} has been submitted.`,
					ephemeral: true
				});
			} else {
				this.search(idOfFirstItem, interaction);
			}
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
		let info;
		try {
			// Get base info first
			const baseRes = await fetch(`http://${ombiIP}:${ombiPort}/api/v2/Search/${isMovie ? 'movie' : 'tv/moviedb'}/${movieDbId}`, {
				method: 'get',
				headers: { accept: 'application/json', ApiKey: ombiToken },
			});
			if (!baseRes.ok) console.warn(`[WARN] Base info fetch failed: ${baseRes.status}`);
			const baseInfo = await baseRes.json();

			if (isTv) {
				// Extra call for accurate seasonRequests
				const requestRes = await fetch(`http://${ombiIP}:${ombiPort}/api/v2/Request/tv/info/${movieDbId}`, {
					method: 'get',
					headers: { accept: 'application/json', ApiKey: ombiToken },
				});
				if (!requestRes.ok) console.warn(`[WARN] Request info fetch failed: ${requestRes.status}`);
				const requestInfo = await requestRes.json();

				// Merge the two (prefer requestInfo for season details)
				info = {
					...baseInfo,
					seasonRequests: requestInfo.seasonRequests || [],
					requested: requestInfo.requested,
					available: requestInfo.available
				};

				console.log(`[DEBUG] Combined TV info for ${info.title}:`, JSON.stringify(info, null, 2));
			} else {
				info = baseInfo;
				console.log(`[DEBUG] Movie info for ${info.title}:`, JSON.stringify(info, null, 2));
			}
		} catch (err) {
			console.log('[ERROR] Fetching media info:', err);
		}

		let isFullyAvailable = false;
		if (isTv && Array.isArray(info.seasonRequests) && info.seasonRequests.length > 0) {
			const allRequestedSeasons = info.seasonRequests.filter(s =>
				s.episodes?.some(e => e.requested === true)
			);
			isFullyAvailable = allRequestedSeasons.length > 0 &&
				allRequestedSeasons.every(season =>
					season.episodes.every(e => e.available === true)
				);
		} else {
			isFullyAvailable = info.available;
		}

		const object = {
			id: info.id,
			releaseDate: isMovie ? info.releaseDate : info.firstAired,
			title: info.title,
			description: info.overview,
			image: isMovie ? info.posterPath : info.banner,
			imdbID: info.imdbId,
			available: isFullyAvailable,
			requested: info.requested,
		};

		// Handle TV seasons
		let totalSeasons = 0;
		let requestedSeasons = [];
		let remaining = [];

		if (isTv) {
			if (Array.isArray(info.seasonRequests) && info.seasonRequests.length > 0) {
				const allSeasonNumbers = info.seasonRequests.map(s => s.seasonNumber);
				totalSeasons = allSeasonNumbers.length;

				requestedSeasons = info.seasonRequests
					.filter(season => Array.isArray(season.episodes) && season.episodes.some(e => e.requested))
					.map(s => s.seasonNumber);

				// Remaining are those in allSeasonNumbers not in requestedSeasons
				if (requestedSeasons.length === totalSeasons) {
					remaining = [];
				} else {
					remaining = allSeasonNumbers.filter(season => !requestedSeasons.includes(season));
				}

				console.log(`[DEBUG] Requested seasons for ${info.title}:`, requestedSeasons);
				console.log(`[DEBUG] Remaining seasons for ${info.title}:`, remaining);

				this.availableSeasons.set(messageId, allSeasonNumbers);
				this.remainingSeasons.set(messageId, remaining);
			} else {
				remaining = ['all'];
				this.availableSeasons.set(messageId, []);
				this.remainingSeasons.set(messageId, remaining);
			}
		}

		function formatSeasonRanges(seasons) {
			if (!Array.isArray(seasons) || seasons.length === 0) return '';
			seasons.sort((a, b) => a - b);

			const ranges = [];
			let start = seasons[0];
			let end = seasons[0];

			for (let i = 1; i <= seasons.length; i++) {
				if (seasons[i] === end + 1) {
					end = seasons[i];
				} else {
					ranges.push(start === end ? `${start}` : `${start}-${end}`);
					start = seasons[i];
					end = seasons[i];
				}
			}
			return ranges.join(', ');
		}

		// Build embed
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

				if (isTv) {
					const allRequested = totalSeasons > 0 && remaining.length === 0;
					console.log(`All requested ${allRequested}`)
					console.log(`Show is available: ${object.available}`);
					console.log(`Remaining season(s) length: ${remaining.length}`);
					const noneRequested = requestedSeasons.length === 0;

					// Determine status
					let statusValue = '❌ Not Requested';
					if (allRequested && object.available) statusValue = '✅ Fully Available';
					else if (allRequested && !object.available) statusValue = '✅ Requested';
					else if (!noneRequested && object.available) statusValue = '🟡 Partially Available';
					else if (!noneRequested && !object.available) statusValue = '❌ Requested';

					// Requested text
					let requestedText = 'None';
					if (allRequested) {
						requestedText = `All (${totalSeasons})`;
					} else if (!noneRequested) {
						requestedText = `${formatSeasonRanges(requestedSeasons)} (${requestedSeasons.length})`;
					}

					// Remaining text
					let remainingText = 'None';
					if (noneRequested) {
						remainingText = `All (${totalSeasons})`;
					} else if (!allRequested) {
						remainingText = formatSeasonRanges(remaining);
					}

					// Add exactly 3 fields
					embed.addFields(
						{ name: '__Status__', value: statusValue, inline: true },
						{ name: '__Requested__', value: requestedText, inline: true },
						{ name: '__Remaining__', value: remainingText, inline: true }
					);

				} else {
					// Movie: Only 1 field
					if (object.available) {
						embed.addFields({ name: '__Available__', value: '✅', inline: true });
					} else if (object.requested) {
						embed.addFields({ name: '__Requested__', value: '✅', inline: true });
					}
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

		// Components
		const objectSelect = new StringSelectMenuBuilder()
			.setCustomId('media_selector')
			.setPlaceholder('Make another selection')
			.addOptions(objectsWithoutDefault);
		const selectMenu = new ActionRowBuilder().addComponents(objectSelect);
		let componentsArray = [selectMenu];

		if (isTv) {
			const remaining = this.remainingSeasons.get(messageId) || [];
			const allRequested = totalSeasons > 0 && remaining.length === 0;

			if (allRequested) {
				componentsArray.push(new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId('mediaAvailable')
						.setLabel(`${object.title.substr(0, 58)} Is Already Requested!`)
						.setStyle(ButtonStyle.Primary)
						.setDisabled(true)
				));
			} else {
				componentsArray.push(new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId(`request-button-${movieDbId}-${mediaType}-${messageId}`)
						.setStyle(ButtonStyle.Primary)
						.setLabel('Request')
				));
			}
		} else {
			if (!(object.requested || object.available)) {
				componentsArray.push(new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId(`request-button-${movieDbId}-${mediaType}-${messageId}`)
						.setStyle(ButtonStyle.Primary)
						.setLabel('Request')
				));
			} else {
				componentsArray.push(new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId('mediaAvailable')
						.setLabel(`${object.title.substr(0, 58)} Is Already ${object.available ? 'Available' : 'Requested'}!`)
						.setStyle(ButtonStyle.Primary)
						.setDisabled(true)
				));
			}
		}

		try {
			if (!interaction.message) {
				interaction.reply({ embeds: [embedMessage], components: componentsArray }).then(() => timeOut(interaction));
			} else {
				interaction.update({ embeds: [embedMessage], components: componentsArray }).then(() => timeOut(interaction));
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

		if (interaction.replied || interaction.deferred) {
			await interaction.editReply({ components: [processing] });
		} else {
			await interaction.reply({ components: [processing] });
		}

		clearTimeout(timerManager.get(messageId));
		const { member } = interaction;
		console.log(`${member.user.username} sent a request to Ombi`);

		if (mediaType === 'movie') {
			// (Movie request)
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
			if (interaction.message) {
				await interaction.message.edit({ components: [row] });
			}
		}
		console.log('All done, now get out of my swamp');
	}
};
