import { IConfig } from "./config";
const testingbotTunnel = require('testingbot-tunnel-launcher');

export default class Tunnel {
	private tunnel: any;

	private config: IConfig;

	constructor(config: IConfig) {
		this.config = config;
	}
	
	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			const tunnelOpts = Object.assign({
				apiKey: this.config.auth.key,
				apiSecret: this.config.auth.secret,
			}, this.config.tunnel_settings);

			testingbotTunnel(tunnelOpts, (err: any, tunnel: any) => {
				if (err) {
					reject(err);
					return;
				}

				this.tunnel = tunnel;
				resolve(tunnel);
			});
		});
	}

	public async stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.tunnel === null) {
				reject(new Error(`Tunnel not active`));
				return;
			}

			this.tunnel.close(() => {
				this.tunnel = null;
				resolve();
			});
		});
	}
}