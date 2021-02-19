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
	screenResolution?: string;
	localHttpPorts?: number[];
	build?: string;
	headless?: boolean;
	cypressEnv?: string[];
	cypressVersion?: string;
}

interface IRunSettings {
	cypress_project_dir: string;
	build_name: string;
	npm_dependencies: any;
	package_config_options: any;
	start_tunnel: boolean;
	local_ports: number[];
	exclude: string[];
	realTimeLogs: boolean;
	parallel: number;
	headless: boolean;
	cypressEnv: string[];
	cypressSpecs: string;
	cypressVersion: string;
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
		const configObject: IConfig = JSON.parse(configString.toString());

		if (
			configObject.auth.key === '' ||
			configObject.auth.key === '<Your TestingBot key>'
		) {
			if (process.env.TESTINGBOT_KEY) {
				configObject.auth.key = process.env.TESTINGBOT_KEY;
			}
		}
		if (
			configObject.auth.secret === '' ||
			configObject.auth.secret === '<Your TestingBot secret>'
		) {
			if (process.env.TESTINGBOT_SECRET) {
				configObject.auth.secret = process.env.TESTINGBOT_SECRET;
			}
		}

		return configObject;
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
