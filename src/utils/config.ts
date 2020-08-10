import fs from 'fs';

const fsPromises = fs.promises;

interface IAuth {
	key: string;
	secret: string;
}

interface IBrowser {
	browserName: string;
	platform: string;
	versions: string[];
}

interface IRunSettings {
	cypress_project_dir: string;
	project_name: string;
	build_name: string;
	parallel_count: number;
	npm_dependencies: any;
	package_config_options: any;
}

export interface IConfig {
	auth: IAuth;
	browsers: IBrowser[];
	run_settings: IRunSettings;
}

export default {
	async getConfig(): Promise<IConfig> {
		const configString = await fsPromises.readFile(`testingbot.json`);
		const configObject = JSON.parse(configString.toString());

		return configObject as IConfig;
	},

	validate(config: IConfig): string[] {
		const errors: string[] = [];
		if (config.auth.key === '' || config.auth.key === '<Your TestingBot key>') {
			errors.push(
				`Please add a valid TestingBot key in the testingbot.json file`,
			);
		}
		if (
			config.auth.secret === '' ||
			config.auth.secret === '<Your TestingBot secret>'
		) {
			errors.push(
				`Please add a valid TestingBot scret in the testingbot.json file`,
			);
		}

		return errors;
	},
};
