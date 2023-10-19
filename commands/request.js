/* eslint-disable no-undef */
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, Collection, MessageSelectMenu } = require('discord.js');
const { ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');
const Discord = require('discord.js');

const ombiIP = process.env.ombiip;
const ombiPort = process.env.ombiport;
const ombiToken = process.env.ombitoken;
const timerExp = process.env.timerexp;

const timerManager = new Collection();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('request')
        .setDescription('Request command to add new media to Plex')
        .addStringOption(option => option.setName('search').setDescription('Enter the name of a TV show or movie.').setMaxLength(75).setRequired(true)),
    async execute(interaction, messageId) {
        let args = interaction.options.getString('search');
        args = args.replace(/,/g, ' ');
        const query = encodeURIComponent(args);
        const idOfFirstItem = await this.getSearchResults(interaction, messageId, query);
        if (idOfFirstItem) {
            this.search(idOfFirstItem, interaction);
        }
        console.log(`Search for "${args}" by ${interaction.member.user.username} done`);
    },
    async getSearchResults(interaction, messageId, args) {
        // ... Rest of the getSearchResults function ...
    },
    async search(id, interaction) {
        // ... existing code up to the point where we determine mediaType ...

        if (mediaType === 'tv') {
            const seasons = await fetchSeasons(movieDbId); // Fetch the seasons for the TV show
            const seasonOptions = seasons.map(season => ({
                label: `Season ${season.seasonNumber}`,
                value: season.seasonNumber.toString(),
            }));

            // Add an option for all seasons
            seasonOptions.push({ label: 'All Seasons', value: 'all' });

            // Present these seasons to the user in a dropdown
            const seasonSelect = new MessageSelectMenu()
                .setCustomId('season_selector')
                .setPlaceholder('Select Seasons')
                .addOptions(seasonOptions);

            const selectMenu = new ActionRowBuilder()
                .addComponents(seasonSelect);

            // Add this selectMenu to your reply/update method
            // ... rest of the code ...
        }
    },
    async sendRequest(interaction, id, mediaType, messageId, selectedSeasons = ['all']) {
        // ... existing code ...

        if (mediaType === 'tv') {
            const body = {
                theMovieDbId: id,
                requestAll: selectedSeasons.includes('all'),
                selectedSeasons: selectedSeasons.includes('all') ? [] : selectedSeasons,
                languageCode: 'en',
            };

            // ... rest of the code for making the fetch call ...
        }
        // ... rest of the sendRequest function ...
    },
};

async function fetchData(endpoint, method, headers, body) {
    try {
        const response = await fetch(`http://${ombiIP}:${ombiPort}${endpoint}`, {
            method: method,
            headers: headers,
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (err) {
        console.error(err);
        throw err;
    }
}

async function fetchSeasons(movieDbId) {
    try {
        const response = await fetch(`http://${ombiIP}:${ombiPort}/api/v2/Search/tv/seasons/${movieDbId}`, {
            method: 'get',
            headers: {
                accept: 'application/json',
                ApiKey: ombiToken,
            },
        });
        return await response.json();
    } catch (err) {
        console.error(err);
        throw err;
    }
}
