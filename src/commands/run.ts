import log from '../log';
import Archiver from '../utils/archiver';
import Uploader from '../utils/uploader';
import Poller from '../utils/poller';
import Config from '../utils/config';
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

	constructor(argv: Arguments) {
		if (typeof(argv.cf) === 'string') {
			this.configFilePath = argv.cf;
		}
	}

	public async start(): Promise<void> {
		let config;
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

		try {
			const response = await this.uploader.start(zipFile);
			uploadSpinner.succeed('Cypress is now running on TestingBot')
			console.log('will join')
			const realTime = io.connect('hub.testingbot.com:3031', {secure: true});
			console.log('joining', `cypress_${response.id}`)
			realTime.emit('join', `cypress_${response.id}`)
			realTime.on('connect', () => {
				console.log('connected')
			})
			realTime.on('disconnect', () => {
				console.log('disconnect')
			})
			realTime.on('event', (data: any) => {
				console.log('event', data)
			});
			realTime.on('error', (err: any) => {
				console.error(err)
			})
			realTime.on("cypress_data", (msg: any) => console.log(msg));
			realTime.on("cypress_error", (msg: any) => console.log(msg));

			const poller = await this.poller.check(response.id, uploadSpinner)
			log.info(poller)

		} catch (err) {
			console.error(chalk.white.bgRed.bold(err));
			if (config.run_settings.start_tunnel) {
				await this.tunnel.stop();
			}
			return;
		}
	}
}
