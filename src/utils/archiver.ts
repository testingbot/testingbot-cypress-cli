import archiver, { ArchiverError } from 'archiver';
import fs from 'fs';
import path from 'path';
import os from 'os';
import log from './../log';
import { IConfig } from './config';

export default class Archiver {
	private config: IConfig;

	constructor(config: IConfig) {
		this.config = config;
	}

	public async start(): Promise<string> {
		return new Promise((resolve, reject) => {
			try {
				const tempZipFile = path.join(os.tmpdir(), 'upload.zip');
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
					'pdf',
					'jpg',
					'jpeg',
					'png',
					'zip',
				];

				let ignoredPaths = [
					'**/node_modules/**',
					'./node_modules/**',
					'package-lock.json',
					'package.json',
					'testingbot-package.json',
				];

				if (
					this.config.run_settings.exclude &&
					this.config.run_settings.exclude.length > 0
				) {
					ignoredPaths = ignoredPaths.concat(this.config.run_settings.exclude);
				}
				allowedFileTypes.forEach((fileType) => {
					archive.glob(`**/*.${fileType}`, {
						cwd: this.config.run_settings.cypress_project_dir,
						matchBase: true,
						ignore: ignoredPaths,
					});
				});

				const packageJSON = {};

				if (
					typeof this.config.run_settings.package_config_options === 'object'
				) {
					Object.assign(
						packageJSON,
						this.config.run_settings.package_config_options,
					);
				}

				if (typeof this.config.run_settings.npm_dependencies === 'object') {
					Object.assign(packageJSON, {
						devDependencies: this.config.run_settings.npm_dependencies,
					});
				}

				if (Object.keys(packageJSON).length > 0) {
					const packageJSONString = JSON.stringify(packageJSON, null, 4);
					archive.append(packageJSONString, {
						name: 'testingbot-package.json',
					});
				}

				archive.finalize();
			} catch (e) {
				reject(e);
			}
		});
	}
}
