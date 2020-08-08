import archiver, { ArchiverError } from 'archiver';
import fs from 'fs';
import path from 'path';
import os from 'os';
import log from './../log';

const fsPromises = fs.promises;
interface ArchiveSettings {
	cypress_path: string;
}

export default class Archiver {
	private settings: ArchiveSettings;

	constructor(settings: ArchiveSettings) {
		this.settings = settings;
	}

	public async start(): Promise<string> {
		return new Promise((resolve, reject) => {
			let tempZipFile: string | undefined;

			try {
				tempZipFile = path.join(os.tmpdir(), 'upload.zip');
				const output = fs.createWriteStream(tempZipFile);
				const archive = archiver('zip', {
					zlib: { level: 9 },
				});

				archive.on('warning', (err: ArchiverError) => {
					if (err.code === 'ENOENT') {
						log.warn(err);
					} else {
						reject(err);
					}
				});

				// listen for all archive data to be written
				// 'close' event is fired only when a file descriptor is involved
				output.on('close', () => {
					resolve(tempZipFile);
				});

				archive.on('error', (err: ArchiverError) => {
					reject(err);
				});

				archive.pipe(output);

				const allowedFileTypes = [
					'js',
					'json',
					'txt',
					'ts',
					'feature',
					'features',
				];
				allowedFileTypes.forEach((fileType) => {
					archive.glob(`**/*.${fileType}`, {
						cwd: this.settings.cypress_path,
						matchBase: true,
						ignore: [
							'node_modules/**',
							'package-lock.json',
							'package.json',
							'testingbot-package.json',
						],
					});
				});

				archive.finalize();
			} catch (e) {
				reject(e);
			} finally {
				if (tempZipFile) {
					fsPromises.unlink(tempZipFile);
				}
			}
		});
	}
}
