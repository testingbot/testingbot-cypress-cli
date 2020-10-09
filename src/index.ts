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
			})
			.help('help')
			.wrap(null).argv;
		const runProject = new RunProject(initArgv);

		runProject.start();
	})
	.alias('h', 'help')
	.help('help')
	.wrap(null).argv;
