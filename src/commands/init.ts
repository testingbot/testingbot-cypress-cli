import fs from 'fs';
import log from './../log';
import path from 'path';
import config from './../templates/config';

const fsPromises = fs.promises;

interface Arguments {
	[x: string]: unknown;
	p: string | boolean;
}

export default class InitProject {
	private path = '.';

	constructor(argv: Arguments) {
		if (argv.p) {
			this.path = argv.p as string;
		}

		this.generate();
	}

	private async generate(): Promise<void> {
		let dirExists = false;

		try {
			const dirStat = await fsPromises.stat(this.path);
			dirExists = dirStat.isDirectory();
		} catch (e) {}

		if (!dirExists) {
			log.error(`Directory ${this.path} does not exist`);
			return;
		}

		await fsPromises.writeFile(
			path.join(this.path, `testingbot.json`),
			config(),
		);
	}
}
