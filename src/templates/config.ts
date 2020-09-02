export default (): string => {
	const config = {
		auth: {
			key: '<Your TestingBot key>',
			secret: '<Your TestingBot secret>',
		},
		browsers: [
			{
				browserName: 'chrome',
				platform: 'MOJAVE',
				version: 83
			},
		],
		run_settings: {
			cypress_project_dir:
				'/path/to/directory-that-contains-<cypress.json>-file',
			build_name: 'build-name',
			npm_dependencies: {},
			package_config_options: {},
			start_tunnel: true,
			local_ports: []
		},
		tunnel_settings: {
			verbose: false
		}
	};

	return JSON.stringify(config, null, 4);
};
