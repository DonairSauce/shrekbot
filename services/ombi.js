const fetch = require('node-fetch');

class OmbiService {
	constructor() {
		this.baseUrl = `http://${process.env.ombiip}:${process.env.ombiport}`;
		this.apiKey = process.env.ombitoken;
	}

	async search(query) {
		const body = {
			movies: true, 
			tvShows: true, 
			music: false, 
			people: false,
		};

		try {
			const response = await fetch(`${this.baseUrl}/api/v2/Search/multi/${query}`, {
				method: 'post',
				body: JSON.stringify(body),
				headers: {
					accept: 'text/plain',
					ApiKey: this.apiKey,
					'Content-Type': 'application/json-patch+json',
				},
			});
			return await response.json();
		} catch (error) {
			console.error('Ombi search error:', error);
			throw error;
		}
	}

	async getDetails(mediaType, id) {
		let apiSubUrl;
		
		if (mediaType === 'tv') {
			apiSubUrl = '/api/v2/Search/tv/moviedb/';
		} else if (mediaType === 'movie') {
			apiSubUrl = '/api/v2/Search/movie/';
		}

		try {
			const response = await fetch(`${this.baseUrl}${apiSubUrl}${id}`, {
				method: 'get',
				headers: {
					accept: 'application/json',
					ApiKey: this.apiKey,
				},
			});
			return await response.json();
		} catch (error) {
			console.error('Ombi details error:', error);
			throw error;
		}
	}

	async makeRequest(mediaType, id, userAlias) {
		let endpoint, body;

		if (mediaType === 'movie') {
			endpoint = '/api/v1/Request/movie';
			body = {
				theMovieDbId: id,
				languageCode: 'en',
			};
		} else {
			endpoint = '/api/v2/Requests/tv';
			body = {
				theMovieDbId: id,
				requestAll: true,
				languageCode: 'en',
			};
		}

		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				method: 'post',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'text/json',
					ApiKey: this.apiKey,
					ApiAlias: userAlias,
				},
				body: JSON.stringify(body),
			});

			const jsonResponse = await response.json();
			return {
				status: response.status,
				data: jsonResponse,
				success: response.status >= 200 && response.status < 300 && !jsonResponse.isError
			};
		} catch (error) {
			console.error('Ombi request error:', error);
			throw error;
		}
	}

	normalizeSearchResults(results) {
		if (!results || Object.keys(results).length === 0) {
			return [];
		}

		return results.map(item => ({
			id: item.id,
			mediaType: item.mediaType,
			title: item.title,
			overview: item.overview,
			poster: item.poster,
			releaseDate: item.mediaType === 'movie' ? item.releaseDate : item.firstAired,
			imdbId: item.imdbId,
			available: item.available,
			requested: item.requested,
			image: item.mediaType === 'movie' ? item.posterPath : item.banner
		}));
	}

	normalizeDetails(info, mediaType) {
		return {
			id: info.id,
			releaseDate: mediaType === 'movie' ? info.releaseDate : info.firstAired,
			title: info.title,
			description: info.overview,
			image: mediaType === 'movie' ? info.posterPath : info.banner,
			imdbID: info.imdbId,
			available: info.available,
			requested: info.requested
		};
	}
}

module.exports = OmbiService;