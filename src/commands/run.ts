import log from '../log';
import Archiver from '../utils/archiver';
import Uploader from '../utils/uploader';
import Poller from '../utils/poller';
import Config from '../utils/config';
import Tunnel from '../utils/tunnel';
import ora from 'ora';

interface Arguments {
	[x: string]: unknown;
	cf: string | boolean;
}

export default class RunProject {
	private archiver: Archiver | undefined = undefined;
	private uploader: Uploader | undefined = undefined;
	private poller: Poller | undefined = undefined;
	private tunnel: Tunnel | undefined = undefined;

	constructor(argv: Arguments) {
		try {
			this.start();
		} catch (e) {
			console.log('error', e)
			log.error(e)
		}
	}

	public async start(): Promise<void> {
		const config = await Config.getConfig();
		const configValidationErrors = Config.validate(config);

		if (configValidationErrors.length > 0) {
			throw new Error(
				`Configuration errors: ${configValidationErrors.join('\n')}`,
			);
		}

		this.archiver = new Archiver(config);
		this.uploader = new Uploader(config);
		this.poller = new Poller(config);
		this.tunnel = new Tunnel(config);

		let zipFile: string;

		if (!this.archiver || !this.uploader) {
			throw new Error(`Invalid state, please try again`);
		}

		if (config.run_settings.start_tunnel) {
			const tunnelSpinner = ora('Starting TestingBot Tunnel').start();
			await this.tunnel.start();
			tunnelSpinner.succeed('TestingBot Tunnel Ready');
		}

		try {
			zipFile = await this.archiver.start();
		} catch (err) {
			log.error(err);
			return;
		}

		try {
			const uploadSpinner = ora('Starting Project on TestingBot').start();

			const response = await this.uploader.start(zipFile);
			uploadSpinner.succeed('Cypress is now running on TestingBot')

			const poller = await this.poller.check(response.id)
			log.info(poller)

		} catch (err) {
			log.error(err);
			if (config.run_settings.start_tunnel) {
				await this.tunnel.stop();
			}
			return;
		}
	}
}
