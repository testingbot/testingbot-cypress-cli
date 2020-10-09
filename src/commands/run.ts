import log from '../log';
import request from 'request';
import Archiver from '../utils/archiver';
import Uploader from '../utils/uploader';
import Poller, { IRun, ITest } from '../utils/poller';
import Config, { IConfig } from '../utils/config';
import Tunnel from '../utils/tunnel';
import ora from 'ora';
import chalk from 'chalk';
import io from 'socket.io-client';

interface Arguments {
	[x: string]: unknown;
	cf: string | boolean;
}

interface ISocketData {
	id: number;
	payload: string;
}

export default class RunProject {
	private archiver: Archiver | undefined = undefined;
	private uploader: Uploader | undefined = undefined;
	private poller: Poller | undefined = undefined;
	private tunnel: Tunnel | undefined = undefined;
	private configFilePath: string | undefined = undefined;
	private config: IConfig | undefined = undefined;
	private projectId: number | undefined = undefined;

	constructor(argv: Arguments) {
		if (typeof argv.cf === 'string') {
			this.configFilePath = argv.cf;
		}
	}

	public exitHandler(): void {
		this.stopJob();
		if (this.config && this.config.run_settings.start_tunnel) {
			if (this.tunnel) {
				this.tunnel
					.stop()
					.then(() => {
						process.exit();
					})
					.catch(log.error);
				this.tunnel = undefined;
			}
		} else {
			process.exit();
		}
	}

	private async stopJob(): Promise<boolean> {
		if (!this.config) {
			return false;
		}

		if (!this.projectId) {
			return false;
		}

		return new Promise((resolve, reject) => {
			const requestOptions = {
				method: 'POST',
				uri: `https://api.testingbot.com/v1/cypress/${this.projectId}/stop_project`,
				auth: {
					user: this.config ? this.config.auth.key : '',
					pass: this.config ? this.config.auth.secret : '',
					sendImmediately: true,
				},
			};

			request(requestOptions, (error) => {
				if (error) {
					return reject(error);
				}

				resolve(true);
			});
		});
	}

	public errorHandler(err: Error): void {
		log.error(
			chalk.white.bgRed.bold(
				`A fatal error occurred, please report this to testingbot.com`,
			),
		);
		log.error(err);
		this.exitHandler();
	}

	private registerCloseHandlers(): void {
		//do something when app is closing
		process.on('exit', this.exitHandler.bind(this, { cleanup: true }));
		process.on('SIGINT', this.exitHandler.bind(this, { exit: true }));
		process.on('SIGUSR1', this.exitHandler.bind(this, { exit: true }));
		process.on('SIGUSR2', this.exitHandler.bind(this, { exit: true }));
		process.on('uncaughtException', this.errorHandler.bind(this));
	}

	private realTimeMessage(message: string): void {
		const data: ISocketData = JSON.parse(message);
		log.info(data.payload);
	}

	private realTimeError(message: string): void {
		const data: ISocketData = JSON.parse(message);
		log.error(data.payload);
	}

	private parseSuccess(runs: IRun[]): boolean {
		let success = true;
		for (let i = 0; i < runs.length; i++) {
			success = success && runs[i].success;
		}

		return success;
	}

	private parseTestCases(runs: IRun[]): ITest[] {
		const testCases: ITest[] = [];
		for (let i = 0; i < runs.length; i++) {
			const testCase = runs[i].test;
			if (testCase) {
				testCases.push(testCase);
			}
		}

		return testCases;
	}

	public async start(): Promise<void> {
		let config: IConfig;
		try {
			config = await Config.getConfig(this.configFilePath || `testingbot.json`);
		} catch (e) {
			log.error(
				chalk.white.bgRed.bold(
					`Configuration file problem: ${e.message} for Config File: ${
						this.configFilePath || `testingbot.json`
					}`,
				),
			);
			return;
		}

		const configValidationErrors = Config.validate(config);

		if (configValidationErrors.length > 0) {
			log.error(
				chalk.white.bgRed.bold(
					`Configuration errors: ${configValidationErrors.join('\n')}`,
				),
			);
			return;
		}

		this.config = config;

		this.archiver = new Archiver(config);
		this.uploader = new Uploader(config);
		this.poller = new Poller(config);
		this.tunnel = new Tunnel(config);

		let zipFile: string;

		if (!this.archiver || !this.uploader) {
			log.error(chalk.white.bgRed.bold(`Invalid state, please try again`));
			return;
		}

		if (config.run_settings.start_tunnel) {
			const tunnelSpinner = ora('Starting TestingBot Tunnel').start();
			await this.tunnel.start();
			tunnelSpinner.succeed('TestingBot Tunnel Ready');
		}

		const uploadSpinner = ora('Starting Cypress Project on TestingBot').start();
		try {
			zipFile = await this.archiver.start();
		} catch (err) {
			log.error(err);
			return;
		}

		this.registerCloseHandlers();

		try {
			const response = await this.uploader.start(zipFile);
			this.projectId = response.id;
			uploadSpinner.succeed('Cypress Project is now running on TestingBot');

			if (config.run_settings.realTimeLogs) {
				const realTime = io.connect('https://hub.testingbot.com:3031');
				realTime.emit('join', `cypress_${response.id}`);
				realTime.on('cypress_data', this.realTimeMessage.bind(this));
				realTime.on('cypress_error', this.realTimeError.bind(this));
			}

			const poller = await this.poller.check(response.id, uploadSpinner);
			const testCases = this.parseTestCases(poller.runs);
			const success = this.parseSuccess(poller.runs);

			if (process.env.TESTINGBOT_CI && testCases.length > 0) {
				for (let i = 0; i < testCases.length; i++) {
					const testCase = testCases[i];
					console.log(`TestingBotSessionId=${testCase.sessionId}`);
				}
			}

			process.exit(success === true ? 0 : 1);
		} catch (err) {
			log.error(chalk.white.bgRed.bold(err));
			if (config.run_settings.start_tunnel) {
				await this.tunnel.stop();
			}
			process.exit(1);
		}
	}
}
