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
import Reporter, { IFormatType } from '../utils/reporter';

interface Arguments {
	[x: string]: unknown;
	cf: string | boolean;
	group?: string;
	headless?: boolean;
	parallel?: number;
	e?: string;
	s?: string;
	r?: string;
	o?: string;
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
	private argv: Arguments;

	constructor(argv: Arguments) {
		if (typeof argv.cf === 'string') {
			this.configFilePath = argv.cf;
		}
		this.argv = argv;
	}

	public exitHandler(): void {
		this.stopJob();
		if (this.config && this.config.run_settings.start_tunnel) {
			if (this.tunnel) {
				try {
					this.tunnel
						.stop()
						.then(() => {
							process.exit();
						})
						.catch(log.error);
					this.tunnel = undefined;
				} catch (err) {
					log.error(chalk.white.bgRed.bold(err));
					process.exit();
				}
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

	public onReady(): void {
		if (this.config && this.config.run_settings.realTimeLogs) {
			const realTime = io.connect('https://hub.testingbot.com:3031');
			realTime.emit('join', `cypress_${this.projectId}`);
			realTime.on('cypress_data', this.realTimeMessage.bind(this));
			realTime.on('cypress_error', this.realTimeError.bind(this));
		}
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
		log.error(chalk.white.bgRed.bold(data.payload));
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

	private applyArgsToConfig(): void {
		if (this.config) {
			if (this.argv.group) {
				this.config.run_settings.build_name = this.argv.group;
			}
			if (this.argv.headless) {
				this.config.run_settings.headless = this.argv.headless;
			}
			if (this.argv.parallel) {
				this.config.run_settings.parallel = this.argv.parallel;
			}
			if (this.argv.e) {
				this.config.run_settings.cypressEnv = this.argv.e.split(',');
			}
			if (this.argv.s) {
				this.config.run_settings.cypressSpecs = this.argv.s;
			}
		}
	}

	public async start(): Promise<void> {
		let config: IConfig;
		try {
			config = await Config.getConfig(this.configFilePath || `testingbot.json`);
		} catch (err: any) {
			log.error(
				chalk.white.bgRed.bold(
					`Configuration file problem: ${err.message} for Config File: ${
						this.configFilePath || `testingbot.json`
					}`,
				),
			);
			process.exit(1);
		}

		const configValidationErrors = Config.validate(config);

		if (configValidationErrors.length > 0) {
			log.error(
				chalk.white.bgRed.bold(
					`Configuration errors:\n${configValidationErrors.join('\n')}`,
				),
			);
			process.exit(1);
		}

		this.config = config;

		this.applyArgsToConfig();

		this.archiver = new Archiver(this.config);
		this.uploader = new Uploader(this.config);
		this.poller = new Poller(this.config, this);
		this.tunnel = new Tunnel(this.config);

		let zipFile: string;

		if (!this.archiver || !this.uploader) {
			log.error(chalk.white.bgRed.bold(`Invalid state, please try again`));
			process.exit(1);
		}

		if (this.config.run_settings.start_tunnel) {
			const tunnelSpinner = ora('Starting TestingBot Tunnel').start();
			try {
				await this.tunnel.start();
				tunnelSpinner.clear();
			} catch (err: any) {
				log.error(chalk.white.bgRed.bold(err.message));
				await this.tunnel.stop();
				process.exit(1);
			}
			tunnelSpinner.succeed('TestingBot Tunnel Ready');
		}

		const uploadSpinner = ora('Starting Cypress Project on TestingBot').start();
		try {
			zipFile = await this.archiver.start();
		} catch (err) {
			log.error(chalk.white.bgRed.bold(err));
			if (config.run_settings.start_tunnel) {
				await this.tunnel.stop();
			}
			process.exit(1);
		}

		this.registerCloseHandlers();
		let success = false;

		try {
			const response = await this.uploader.start(zipFile);
			this.projectId = response.id;
			uploadSpinner.succeed('Cypress Project is now running on TestingBot');

			const poller = await this.poller.check(response.id, uploadSpinner);
			const testCases = this.parseTestCases(poller.runs);
			success = this.parseSuccess(poller.runs);

			if (process.env.TESTINGBOT_CI && testCases.length > 0) {
				for (let i = 0; i < testCases.length; i++) {
					const testCase = testCases[i];
					console.log(`TestingBotSessionId=${testCase.sessionId}`);
				}
			}
		} catch (err) {
			if (err) {
				log.error(chalk.white.bgRed.bold(err));
			}
		} finally {
			if (config.run_settings.start_tunnel) {
				await this.tunnel.stop();
			}
			if (this.argv.r && this.projectId) {
				const reporter = new Reporter(this.config, this.projectId, this.argv.o);
				await reporter.format(this.argv.r as IFormatType);
			}

			process.exit(success === true ? 0 : 1);
		}
	}
}
