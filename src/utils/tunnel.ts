import { IConfig } from './config';
const testingbotTunnel = require('testingbot-tunnel-launcher');

export default class Tunnel {
	private tunnel: any = null;

	private config: IConfig;

	constructor(config: IConfig) {
		this.config = config;
	}

	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			const tunnelOpts = Object.assign(
				{
					apiKey: this.config.auth.key,
					apiSecret: this.config.auth.secret,
				},
				this.config.tunnel_settings,
			);

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

	public isActive(): boolean {
		return !!this.tunnel;
	}

	/**
	 * Closes the tunnel if one is open. Safe to call more than once, and when
	 * start() failed or never ran: the CLI calls this from its signal and error
	 * handlers, and `this.tunnel` used to be undefined there, which crashed with
	 * "Cannot read properties of undefined (reading 'close')" and left the
	 * tunnel open on TestingBot's side.
	 */
	public async stop(): Promise<void> {
		const tunnel = this.tunnel;
		this.tunnel = null;
		if (!tunnel || typeof tunnel.close !== 'function') {
			return;
		}

		return new Promise((resolve) => {
			tunnel.close(() => resolve());
		});
	}
}
