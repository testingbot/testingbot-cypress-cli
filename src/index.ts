#!/usr/bin/env node

import * as yargs from 'yargs';
import InitProject from './commands/init';
import RunProject from './commands/run';

process.removeAllListeners('warning');

yargs
	.usage('usage: $0 <command>')
	.alias('v', 'version')
	.describe('v', '1.0')
	.command('init', 'more info', function (yargs) {
		const initArgv = yargs
			.usage('usage: $0 init [options]')
			.options({
				p: {
					alias: 'path',
					default: false,
					description:
						'The path where we need to initialize the Cypress+TestingBot config file',
					type: 'string',
				},
			})
			.help('help')
			.wrap(null).argv;

		return new InitProject(initArgv);
	})
	.command('run', 'more info', function (yargs) {
		const initArgv = yargs
			.usage('usage: $0 run [options]')
			.options({
				cf: {
					alias: 'config-file',
					default: 'testingbot.json',
					description: 'The path to the testingbot.json config file',
					type: 'string',
					demand: true,
				},
				group: {
					default: undefined,
					description: 'Group the specs under this name',
					type: 'string',
					nargs: 1,
				},
				headless: {
					default: false,
					description: 'Run tests in headless mode on TestingBot (no UI)',
					type: 'boolean',
				},
				parallel: {
					default: 1,
					description: 'Run tests in parallel on TestingBot',
					type: 'number',
				},
				s: {
					alias: ['specs', 'spec'],
					default: undefined,
					description: 'Runs specific spec file(s). defaults to "all"',
					type: 'string',
				},
				e: {
					alias: 'env',
					describe:
						'Sets environment variables. separate multiple values with a comma',
					type: 'string',
					default: undefined,
				},
				r: {
					alias: 'reporter',
					describe:
						'Runs a specific reporter. valid reporters: "json", "junit"',
					type: 'string',
					default: undefined,
				},
				o: {
					alias: 'reporter-options',
					describe: 'Options for a reporter',
					type: 'string',
					default: undefined,
				},
			})
			.help('help')
			.wrap(null).argv;
		const runProject = new RunProject(initArgv);

		runProject.start();
	})
	.alias('h', 'help')
	.help('help')
	.demandCommand(1, '')
	.showHelpOnFail(true)
	.wrap(null).argv;
