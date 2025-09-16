const fetch = require('node-fetch');

class OverseerrService {
	constructor() {
		this.baseUrl = process.env.overseerrurl;
		this.apiKey = process.env.overseerrtoken;
	}

	async search(query) {
		try {
			const response = await fetch(`${this.baseUrl}/api/v1/search?query=${encodeURIComponent(query)}`, {
				method: 'get',
				headers: {
					accept: 'application/json',
					'X-Api-Key': this.apiKey,
				},
			});
			const data = await response.json();
			return data.results || [];
		} catch (error) {
			console.error('Overseerr search error:', error);
			throw error;
		}
	}

	async getDetails(mediaType, id) {
		try {
			const response = await fetch(`${this.baseUrl}/api/v1/${mediaType}/${id}`, {
				method: 'get',
				headers: {
					accept: 'application/json',
					'X-Api-Key': this.apiKey,
				},
			});
			return await response.json();
		} catch (error) {
			console.error('Overseerr details error:', error);
			throw error;
		}
	}

	async makeRequest(mediaType, id, userAlias) {
		const endpoint = '/api/v1/request';
		const body = {
			mediaType: mediaType === 'tv' ? 'tv' : 'movie',
			mediaId: parseInt(id),
		};

		if (mediaType === 'tv') {
			body.seasons = 'all';
		}

		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				method: 'post',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					'X-Api-Key': this.apiKey,
				},
				body: JSON.stringify(body),
			});

			const jsonResponse = await response.json();
			return {
				status: response.status,
				data: jsonResponse,
				success: response.status >= 200 && response.status < 300
			};
		} catch (error) {
			console.error('Overseerr request error:', error);
			throw error;
		}
	}

	normalizeSearchResults(results) {
		if (!results || results.length === 0) {
			return [];
		}

		return results.map(item => ({
			id: item.id,
			mediaType: item.mediaType,
			title: item.title || item.name,
			overview: item.overview,
			poster: item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : null,
			releaseDate: item.releaseDate || item.firstAirDate,
			imdbId: item.externalIds?.imdbId,
			available: item.mediaInfo?.status === 5,
			requested: item.mediaInfo?.status && item.mediaInfo.status > 1 && item.mediaInfo.status < 5,
			image: item.posterPath || item.backdropPath
		}));
	}

	normalizeDetails(info, mediaType) {
		return {
			id: info.id,
			releaseDate: info.releaseDate || info.firstAirDate,
			title: info.title || info.name,
			description: info.overview,
			image: info.posterPath || info.backdropPath,
			imdbID: info.externalIds?.imdbId,
			available: info.mediaInfo?.status === 5,
			requested: info.mediaInfo?.status && info.mediaInfo.status > 1 && info.mediaInfo.status < 5
		};
	}
}

module.exports = OverseerrService;