import fs from 'fs';

const fsPromises = fs.promises;

interface IAuth {
	key: string;
	secret: string;
}

export interface ICapability {
	browserName: string;
	platform: string;
	version: string | number;
	localHttpPorts?: number[];
}

interface IRunSettings {
	cypress_project_dir: string
	project_name: string
	build_name: string
	parallel_count: number
	npm_dependencies: any
	package_config_options: any
	start_tunnel: boolean
	local_ports: number[]
}

export interface IConfig {
	auth: IAuth;
	browsers: ICapability[];
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
