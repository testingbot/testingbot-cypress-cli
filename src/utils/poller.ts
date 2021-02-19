import request from 'request';
import { IConfig } from './config';
import log from '../log';
import ora from 'ora';
import RunProject from '../commands/run';

interface IEnvironment {
	name: string;
	os: string;
	version: string;
}

export interface ITest {
	sessionId: string;
	environment: IEnvironment;
}

enum IStatus {
	WAITING = 'WAITING',
	READY = 'READY',
	FAILED = 'FAILED',
	DONE = 'DONE',
}

export interface IRun {
	status: IStatus;
	capabilities: any;
	errors: string[];
	test?: ITest;
	success: boolean;
}

interface IPollResponse {
	runs: IRun[];
	version: string;
	build?: string;
	build_id?: number;
}

export default class Poller {
	private config: IConfig;
	private retryNumber = 0;
	private intervalId: NodeJS.Timeout | undefined;
	private static readonly MAX_RETRIES_WAITING = 60;
	private static readonly MAX_RETRIES_READY = 900;
	private initSuccess = false;
	private runner: RunProject;

	constructor(config: IConfig, runner: RunProject) {
		this.config = config;
		this.runner = runner;
	}

	public async check(id: number, spinner: ora.Ora): Promise<IPollResponse> {
		return new Promise((resolve, reject) => {
			this.intervalId = setInterval(async () => {
				const response = await this.getApiResponse(id);
				const status = this.getStatus(response);

				if (status === IStatus.DONE) {
					const errors = this.getErrors(response);
					if (errors.length === 0) {
						spinner.succeed(
							'Cypress Project has finished running on TestingBot',
						);
						if (this.intervalId) {
							clearInterval(this.intervalId);
							this.intervalId = undefined;
						}
						return resolve(response);
					}

					spinner.fail('Cypress Project has finished running on TestingBot');

					if (this.intervalId) {
						clearInterval(this.intervalId);
						this.intervalId = undefined;
					}
					return reject(errors);
				}

				if (
					status === IStatus.WAITING &&
					this.retryNumber > Poller.MAX_RETRIES_WAITING
				) {
					if (this.intervalId) {
						clearInterval(this.intervalId);
						this.intervalId = undefined;
					}
					return reject(
						new Error(
							`Waited too long to retrieve information, please try again later.`,
						),
					);
				} else if (
					status === IStatus.READY &&
					this.retryNumber > Poller.MAX_RETRIES_READY
				) {
					if (this.intervalId) {
						clearInterval(this.intervalId);
						this.intervalId = undefined;
					}
					return reject(
						new Error(
							`This project has been running for over 30 minutes, stopping now.`,
						),
					);
				} else if (status === IStatus.READY && !this.initSuccess) {
					this.initSuccess = true;
					if (response.build_id) {
						log.info(`Cypress Job started.
View results on https://testingbot.com/members/builds/${response.build_id}`);
					}

					this.runner.onReady();
				}

				this.retryNumber += 1;
			}, 2000);
		});
	}

	private getErrors(response: IPollResponse): string[] {
		const errors: string[] = [];
		for (let i = 0; i < response.runs.length; i++) {
			const testRun = response.runs[i];
			if (testRun.errors.length > 0) {
				errors.concat(testRun.errors);
			}
		}

		return errors;
	}

	private getStatus(response: IPollResponse): IStatus {
		let status = IStatus.DONE;

		for (let i = 0; i < response.runs.length; i++) {
			const testRun = response.runs[i];
			if (testRun.status === IStatus.DONE) {
				continue;
			} else if (testRun.status === IStatus.WAITING) {
				// whenever one is waiting, the whole batch is waiting
				return IStatus.WAITING;
			}
			status = testRun.status;
		}

		return status;
	}

	private async getApiResponse(id: number): Promise<IPollResponse> {
		return new Promise((resolve, reject) => {
			const requestOptions = {
				method: 'GET',
				uri: `https://api.testingbot.com/v1/cypress/${id}`,
				auth: {
					user: this.config.auth.key,
					pass: this.config.auth.secret,
					sendImmediately: true,
				},
			};

			request(requestOptions, (error, response) => {
				if (error) {
					return reject(error);
				}
				let responseBody: IPollResponse;
				if (response.body && typeof response.body === 'string') {
					response.body = JSON.parse(response.body) as IPollResponse;
				}
				if (response.statusCode.toString().substring(0, 1) === '2') {
					responseBody = response.body;
				} else {
					return reject(response.body);
				}

				resolve(responseBody);
			});
		});
	}
}
