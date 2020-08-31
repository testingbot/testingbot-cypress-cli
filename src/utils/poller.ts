import request from 'request';
import log from './../log';
import { IConfig } from './config';

interface IPollResponse {
	status: string
	errors: string[]
}

export default class Poller {
	private config: IConfig;
	private retryNumber = 0;
	private intervalId: NodeJS.Timeout | undefined;
	private static readonly MAX_RETRIES_WAITING = 60;
	private static readonly MAX_RETRIES_READY = 600;

	constructor(config: IConfig) {
		this.config = config;
	}

	public async check(id: number): Promise<IPollResponse> {
		return new Promise((resolve, reject) => {
			this.intervalId = setInterval(async () => {
				const response = await this.getStatus(id);
				log.info('checking', response);
				
				if (response.status === 'DONE') {
					if (response.errors.length === 0) {
						if (this.intervalId) {
							clearInterval(this.intervalId);
							this.intervalId = undefined;
						}
						return resolve(response);
					}

					if (this.intervalId) {
						clearInterval(this.intervalId);
						this.intervalId = undefined;
					}
					return reject(response);
				}

				if (response.status === 'WAITING' && this.retryNumber > Poller.MAX_RETRIES_WAITING) {
					if (this.intervalId) {
						clearInterval(this.intervalId);
						this.intervalId = undefined;
					}
					return reject(new Error(`Waited too long to retrieve information, please try again later.`));
				} else if (response.status === 'READY' && this.retryNumber > Poller.MAX_RETRIES_READY) {
					if (this.intervalId) {
						clearInterval(this.intervalId);
						this.intervalId = undefined;
					}
					return reject(new Error(`This project has been running for over 20 minutes, stopping now.`));
				}

				this.retryNumber += 1;
			}, 2000);
		});
	}

	private async getStatus(id: number): Promise<IPollResponse> {
		return new Promise((resolve, reject) => {
			const requestOptions = {
				method: 'GET',
				uri: `https://api.testingbot.com/v1/cypress/${id}`,
				auth: {
					user: this.config.auth.key,
					pass: this.config.auth.secret,
					sendImmediately: true,
				}
			};

			request(requestOptions, (error, response) => {
				if (error) {
					return reject(error);
				}
				let responseBody: IPollResponse = { status: 'WAITING', errors: [] };
				if (response) {
					if (response.body && typeof response.body === 'string') {
						response.body = JSON.parse(response.body) as IPollResponse;
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
