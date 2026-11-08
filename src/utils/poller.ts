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
	success: boolean;
}

export interface IOutcome {
	failed: boolean;
	reason?: string;
}

export default class Poller {
	private config: IConfig;
	private retryNumber = 0;
	private apiErrors = 0;
	private intervalId: NodeJS.Timeout | undefined;
	private static readonly MAX_RETRIES_WAITING = 180;
	private static readonly MAX_RETRIES_READY = 900;
	private static readonly MAX_CONSECUTIVE_API_ERRORS = 5;
	private initSuccess = false;
	private runner: Pick<RunProject, 'onReady'>;
	private pollIntervalMs: number;

	constructor(
		config: IConfig,
		runner: Pick<RunProject, 'onReady'>,
		pollIntervalMs = 2000,
	) {
		this.config = config;
		this.runner = runner;
		this.pollIntervalMs = pollIntervalMs;
	}

	/**
	 * Decides whether the remote side has failed for good. A run whose status is
	 * FAILED (or anything this CLI does not know) will never reach DONE, and a
	 * run whose session id starts with "error" is one the grid could not start
	 * (for example "Cypress did not respond after 20 seconds"): the API keeps
	 * reporting it as READY, so without this check the CLI polled until it was
	 * killed.
	 */
	public static failure(response: IPollResponse): IOutcome {
		const reasons: string[] = [];
		for (const run of response.runs || []) {
			const env = Poller.describe(run);
			const known = Object.values(IStatus) as string[];
			if (run.status === IStatus.FAILED || !known.includes(run.status)) {
				const errors = (run.errors || []).filter(Boolean).join('; ');
				reasons.push(
					`${env}: run ${run.status}${errors ? ` (${errors})` : ''}`,
				);
			} else if (
				run.test &&
				typeof run.test.sessionId === 'string' &&
				run.test.sessionId.startsWith('error')
			) {
				reasons.push(`${env}: the remote Cypress session failed to start`);
			}
		}
		if (reasons.length === 0) {
			return { failed: false };
		}
		return { failed: true, reason: reasons.join('\n') };
	}

	private static describe(run: IRun): string {
		const caps = run.capabilities || {};
		const parts = [caps.browserName, caps.version, caps.platform].filter(
			Boolean,
		);
		return parts.length > 0 ? parts.join(' ') : 'run';
	}

	private stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}

	public async check(id: number, spinner: ora.Ora): Promise<IPollResponse> {
		this.runner.onReady();
		return new Promise((resolve, reject) => {
			this.intervalId = setInterval(async () => {
				let response: IPollResponse;
				try {
					response = await this.getApiResponse(id);
					this.apiErrors = 0;
				} catch (err: any) {
					// An exception thrown inside this async callback used to become an
					// unhandled rejection; give up after a few in a row instead.
					this.apiErrors += 1;
					if (this.apiErrors >= Poller.MAX_CONSECUTIVE_API_ERRORS) {
						this.stop();
						spinner.fail('Could not retrieve the Cypress Project status');
						return reject(
							new Error(
								`TestingBot API error: ${
									(err && (err.message || err.error)) || JSON.stringify(err)
								}`,
							),
						);
					}
					return;
				}

				const outcome = Poller.failure(response);
				if (outcome.failed) {
					this.stop();
					spinner.fail('Cypress Project failed on TestingBot');
					return reject(new Error(outcome.reason));
				}

				const status = this.getStatus(response);

				if (status === IStatus.DONE) {
					response.success = this.isSuccess(response);
					if (response.success) {
						spinner.succeed(
							'Cypress Project has finished running on TestingBot',
						);
					} else {
						spinner.fail('Cypress Project has finished running on TestingBot');
					}

					this.stop();
					return resolve(response);
				}

				if (
					status === IStatus.WAITING &&
					this.retryNumber > Poller.MAX_RETRIES_WAITING
				) {
					this.stop();
					return reject(
						new Error(
							`Waited too long to retrieve information, please try again later.`,
						),
					);
				} else if (
					status === IStatus.READY &&
					this.retryNumber > Poller.MAX_RETRIES_READY
				) {
					this.stop();
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
				}

				this.retryNumber += 1;
			}, this.pollIntervalMs);
		});
	}

	private isSuccess(response: IPollResponse): boolean {
		return response.runs.every((testRun) => testRun.success);
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

	protected async getApiResponse(id: number): Promise<IPollResponse> {
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
