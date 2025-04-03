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

		let baseInfo;
		try {
			const baseRes = await fetch(`http://${ombiIP}:${ombiPort}/api/v2/Search/${isMovie ? 'movie' : 'tv/moviedb'}/${movieDbId}`, {
				headers: { accept: 'application/json', ApiKey: ombiToken },
			});
			baseInfo = await baseRes.json();
		} catch (err) {
			console.error('[ERROR] Fetching media info:', err);
			return interaction.reply({ content: '❌ Failed to retrieve media info.', ephemeral: true });
		}

		const embed = new Discord.EmbedBuilder()
			.setColor('#0099ff')
			.setTitle(`${baseInfo.title}${baseInfo.releaseDate ? ` (${baseInfo.releaseDate.substring(0, 4)})` : ''}`)
			.setURL(`https://imdb.com/title/${baseInfo.imdbId}`)
			.setDescription(baseInfo.overview?.substring(0, 255) + '(...)' || 'No description')
			.setImage(`https://image.tmdb.org/t/p/original/${isMovie ? baseInfo.posterPath : baseInfo.banner}`)
			.setTimestamp()
			.setFooter({
				text: `Searched by ${interaction.member.user.username}`,
				iconURL: interaction.member.user.displayAvatarURL(),
			});

		let requestButtonDisabled = false;
		let statusValue = '❌ Not Requested';

		if (isMovie) {
			if (baseInfo.available || baseInfo.fullyAvailable) {
				statusValue = '✅ Available';
				requestButtonDisabled = true;
			} else if (baseInfo.requested) {
				statusValue = '✅ Requested';
				requestButtonDisabled = true;
			}
			embed.addFields({ name: '__Status__', value: statusValue, inline: true });
		} else if (isTv) {
			const totalSeasons = baseInfo.seasonCount || 0;
			let requestedSeasons = [];
			let remainingSeasons = [];

			// Always fetch child info if baseInfo.id is available
			if (isTv && baseInfo.id) {
				try {
					const childRes = await fetch(`http://${ombiIP}:${ombiPort}/api/v1/Request/tv/${baseInfo.id}/child`, {
						headers: { accept: 'application/json', ApiKey: ombiToken },
					});
					if (childRes.ok) {
						const childData = await childRes.json();

						const totalSeasons = baseInfo.seasonCount || 0;

						const requested = childData
							.filter(s => s.requested || s.available)
							.map(s => s.seasonNumber);

						const remaining = Array.from(
							{ length: totalSeasons },
							(_, i) => i + 1
						).filter(season => !requested.includes(season));

						// Sort for consistent display
						requestedSeasons = requested.sort((a, b) => a - b);
						remainingSeasons = remaining.sort((a, b) => a - b);

						// Update statusValue based on the result
						if (requestedSeasons.length === totalSeasons) {
							statusValue = '✅ Fully Available';
							requestedSeasons = ['All'];
							remainingSeasons = [];
							requestButtonDisabled = true;
						} else if (requestedSeasons.length > 0) {
							statusValue = baseInfo.partlyAvailable
								? '🟡 Partially Available'
								: '🟡 Partially Requested';
							requestButtonDisabled = remainingSeasons.length === 0;
						} else {
							statusValue = '❌ Not Requested';
							remainingSeasons = Array.from({ length: totalSeasons }, (_, i) => i + 1);
						}
					}
				} catch (err) {
					console.warn(`[WARN] Child request fetch failed: ${err.message}`);
				}
			}

			if (baseInfo.fullyAvailable) {
				statusValue = '✅ Fully Available';
				requestButtonDisabled = true;
				requestedSeasons = ['All'];
				remainingSeasons = [];
			} else if (baseInfo.partlyAvailable) {
				statusValue = '🟡 Partially Available';
				requestButtonDisabled = remainingSeasons.length === 0;
			} else if (baseInfo.requested) {
				statusValue = remainingSeasons.length ? '🟡 Partially Requested' : '✅ Requested';
				requestButtonDisabled = remainingSeasons.length === 0;
			}

			if (!baseInfo.requested && !baseInfo.partlyAvailable && !baseInfo.fullyAvailable) {
				statusValue = '❌ Not Requested';
				remainingSeasons = Array.from({ length: totalSeasons }, (_, i) => i + 1);
			}

			const formatSeasons = arr => arr.length ? arr.join(', ') : 'None';

			embed.addFields(
				{ name: '__Status__', value: statusValue, inline: true },
				{ name: '__Requested__', value: formatSeasons(requestedSeasons), inline: true },
				{ name: '__Remaining__', value: formatSeasons(remainingSeasons), inline: true },
			);
		}

		const componentsArray = [
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId('media_selector')
					.setPlaceholder('Make another selection')
					.addOptions(objectsWithoutDefault),
			),
			new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(requestButtonDisabled ? 'mediaAvailable' : `request-button-${movieDbId}-${mediaType}-${messageId}`)
					.setLabel(requestButtonDisabled ? `${baseInfo.title.substr(0, 58)} Already Requested!` : 'Request')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(requestButtonDisabled),
			),
		];

		try {
			if (!interaction.message)
				await interaction.reply({ embeds: [embed], components: componentsArray });
			else
				await interaction.update({ embeds: [embed], components: componentsArray });
		} catch (err) {
			console.error(err);
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
