import log from '../log';
import Archiver from '../utils/archiver';
import Uploader from '../utils/uploader';
import Poller from '../utils/poller';
import Config, { IConfig } from '../utils/config';
import Tunnel from '../utils/tunnel';
import ora from 'ora';
import chalk from 'chalk';
import io from 'socket.io-client';

interface Arguments {
	[x: string]: unknown;
	cf: string | boolean;
}

export default class RunProject {
	private archiver: Archiver | undefined = undefined;
	private uploader: Uploader | undefined = undefined;
	private poller: Poller | undefined = undefined;
	private tunnel: Tunnel | undefined = undefined;
	private configFilePath: string | undefined = undefined;
	private config: IConfig | undefined = undefined;

	constructor(argv: Arguments) {
		if (typeof(argv.cf) === 'string') {
			this.configFilePath = argv.cf;
		}
	}

	public exitHandler(): void {
		if (this.config && this.config.run_settings.start_tunnel) {
			if (this.tunnel) {
				this.tunnel.stop().catch(console.error);
			}
		}
	}

	public errorHandler(): void {
		console.error(chalk.white.bgRed.bold(`A fatal error occurred, please report this to testingbot.com`));
		this.exitHandler();
	}

	private registerCloseHandlers(): void {
		//do something when app is closing
		process.on('exit', this.exitHandler.bind(this,{cleanup:true}));
		process.on('SIGINT', this.exitHandler.bind(this, {exit:true}));
		process.on('SIGUSR1', this.exitHandler.bind(this, {exit:true}));
		process.on('SIGUSR2', this.exitHandler.bind(this, {exit:true}));
		process.on('uncaughtException', this.errorHandler.bind(this, {exit:true}));
	}

	private realTimeMessage(message: string): void {
		console.log(message);
	}

	private realTimeError(message: string): void {
		console.error(message);
	}

	public async start(): Promise<void> {
		let config: IConfig;
		try {
			config = await Config.getConfig(this.configFilePath || `testingbot.json`);
		} catch (e) {
			console.error(chalk.white.bgRed.bold(`Configuration file problem: ${e.message} for Config File: ${this.configFilePath || `testingbot.json`}`));
			return;
		}
		
		const configValidationErrors = Config.validate(config);

		if (configValidationErrors.length > 0) {
			console.error(chalk.white.bgRed.bold(`Configuration errors: ${configValidationErrors.join('\n')}`));
			return;
		}

		this.config = config;

		this.archiver = new Archiver(config);
		this.uploader = new Uploader(config);
		this.poller = new Poller(config);
		this.tunnel = new Tunnel(config);

		let zipFile: string;

		if (!this.archiver || !this.uploader) {
			console.error(chalk.white.bgRed.bold(`Invalid state, please try again`));
			return;
		}

		if (config.run_settings.start_tunnel) {
			const tunnelSpinner = ora('Starting TestingBot Tunnel').start();
			await this.tunnel.start();
			tunnelSpinner.succeed('TestingBot Tunnel Ready');
		}

		const uploadSpinner = ora('Starting Project on TestingBot').start();
		try {
			zipFile = await this.archiver.start();
		} catch (err) {
			console.error(err);
			return;
		}

		this.registerCloseHandlers();

		try {
			const response = await this.uploader.start(zipFile);
			uploadSpinner.succeed('Cypress is now running on TestingBot')
			const realTime = io.connect('https://hub.testingbot.com:3031');
			realTime.emit('join', `cypress_${response.id}`)
			realTime.on('cypress_data', (msg: string) => this.realTimeMessage.bind(this, msg));
			realTime.on('cypress_error', (msg: string) => this.realTimeError.bind(this, msg));

			const poller = await this.poller.check(response.id, uploadSpinner);
			log.info(poller)

			process.exit(0);

		} catch (err) {
			console.error(chalk.white.bgRed.bold(err));
			if (config.run_settings.start_tunnel) {
				await this.tunnel.stop();
			}
			process.exit(1);
		}
	}
}
