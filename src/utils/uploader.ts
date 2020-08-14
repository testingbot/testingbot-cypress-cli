import fs from 'fs';
import request from 'request';
import log from './../log';
import { IConfig } from './config';

export default class Uploader {
	private config: IConfig;

	constructor(config: IConfig) {
		this.config = config;
	}

	public async start(zipFile: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const requestOptions = {
				method: 'POST',
				uri: `https://api.testingbot.com/v1/cypress`,
				auth: {
					user: this.config.auth.key,
					pass: this.config.auth.secret,
					sendImmediately: true,
				},
				formData: {
					file: fs.createReadStream(zipFile),
					capabilities: JSON.stringify([{
						platform: 'MOJAVE',
						browserName: 'chrome',
						version: '82'
					}])
				},
			};

			request(requestOptions, function (error, response) {
				if (error) {
					return reject(error);
				}
				let responseBody = null;
				if (response) {
					if (response.body && typeof response.body === 'string') {
						response.body = JSON.parse(response.body);
					}
					if (response.statusCode.toString().substring(0, 1) === '2') {
						responseBody = response.body;
					} else {
						return reject(response.body);
					}
				}

				resolve(responseBody);
			});
		});
	}
}
