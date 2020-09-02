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
	build?: string;
}

interface IRunSettings {
	cypress_project_dir: string
	build_name: string
	npm_dependencies: any
	package_config_options: any
	start_tunnel: boolean
	local_ports: number[]
}

export interface IConfig {
	auth: IAuth;
	browsers: ICapability[];
	run_settings: IRunSettings;
	tunnel_settings: any;
}

export default {
	async getConfig(configFilePath: string): Promise<IConfig> {
		const configString = await fsPromises.readFile(configFilePath);
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
