import log from '../log';
import Archiver from '../utils/archiver';
import Uploader from '../utils/uploader';

interface Arguments {
	[x: string]: unknown;
	p: string | boolean;
}

export default class RunProject {
	private path = '.';
	private archiver: Archiver;
	private uploader: Uploader;

	constructor(argv: Arguments) {
		this.archiver = new Archiver({
			cypress_path: '.',
		});

		this.uploader = new Uploader({
			cypress_path: '',
		});
	}

	public async start(): Promise<void> {
		let zipFile: string | undefined;

		try {
			zipFile = await this.archiver.start();
		} catch (err) {
			log.error(err);
			return;
		}

		const success = await this.uploader.start();
	}
}
