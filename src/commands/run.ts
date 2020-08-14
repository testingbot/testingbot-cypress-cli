import log from '../log';
import Archiver from '../utils/archiver';
import Uploader from '../utils/uploader';
import Config from '../utils/config';

interface Arguments {
	[x: string]: unknown;
	cf: string | boolean;
}

export default class RunProject {
	private archiver: Archiver | undefined = undefined;
	private uploader: Uploader | undefined = undefined;

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

		let zipFile: string;

		if (!this.archiver || !this.uploader) {
			throw new Error(`Invalid state, please try again`);
		}

		try {
			zipFile = await this.archiver.start();
		} catch (err) {
			log.error(err);
			return;
		}

		try {
			const success = await this.uploader.start(zipFile);
			log.info('got success', success);
		} catch (err) {
			log.error(err);
			return;
		}
	}
}
