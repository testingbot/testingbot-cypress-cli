export default (): string => {
	const config = {
		auth: {
			key: '<Your TestingBot key>',
			secret: '<Your TestingBot secret>',
		},
		browsers: [
			{
				browserName: 'chrome',
				platform: 'Windows 10',
				versions: ['78', '77'],
			},
			{
				browserName: 'firefox',
				os: 'Mojave',
				versions: ['74', '75'],
			},
		],
		run_settings: {
			cypress_project_dir:
				'/path/to/directory-that-contains-<cypress.json>-file',
			project_name: 'project-name',
			build_name: 'build-name',
			parallel_count: 'How many tests you want to run in parallel',
			npm_dependencies: {},
			package_config_options: {},
		},
	};

	return JSON.stringify(config, null, 4);
};
