const OmbiService = require('./ombi.js');
const OverseerrService = require('./overseerr.js');

class ServiceFactory {
	static createService() {
		const serviceType = process.env.service?.toLowerCase() || 'ombi';
		
		console.log(`Initializing ${serviceType} service`);
		
		switch (serviceType) {
			case 'overseerr':
				if (!process.env.overseerrurl || !process.env.overseerrtoken) {
					throw new Error('Overseerr configuration missing. Please set overseerrurl and overseerrtoken environment variables.');
				}
				return new OverseerrService();
			case 'ombi':
			default:
				if (!process.env.ombiip || !process.env.ombiport || !process.env.ombitoken) {
					throw new Error('Ombi configuration missing. Please set ombiip, ombiport, and ombitoken environment variables.');
				}
				return new OmbiService();
		}
	}

	static getServiceType() {
		return process.env.service?.toLowerCase() || 'ombi';
	}
}

module.exports = ServiceFactory;