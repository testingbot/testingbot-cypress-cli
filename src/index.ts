import * as yargs from 'yargs';
import InitProject from './commands/init';

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
	.alias('h', 'help')
	.help('help')
	.wrap(null).argv;
