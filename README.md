# TestingBot Cypress CLI
[![npm version](https://badge.fury.io/js/testingbot-cypress-cli.svg)](https://badge.fury.io/js/testingbot-cypress-cli)

The `testingbot-cypress-cli` is command-line interface (CLI) which
allows you to run Cypress tests on TestingBot. TestingBot provides a 
large grid of browsers and devices to run both manual and automated tests.

-   [Quick Start](#quick-start)
-   [Documentation](#documentation)
-   [Getting Help](#getting-help)
-   [License](#license)

## Quick Start
To get started, simply install the CLI and configure it to use your Cypress project:

### Install the CLI

You can easily install the CLI via `npm` or `yarn`:

```bash
$ npm install -g testinbot-cypress-cli
```

### Configure

Once the CLI is installed, you'll need to point it to a configuration file.
The configuration file will point the CLI to the Cypress project and will supply
the TestingBot credentials.

To set up a new configuration file (`testingbot.json`), simply run this command:

```bash
$ testingbot-cypress init
```

This will create a `testingbot.json` file. Please add the `key` and `secret` you obtained from the TestingBot member dashboard in this file.

Next, please supply `cypress_proj_dir` with is the path to the folder that contains the `cypress.json` file.
As an example, you can use the [Cypress Kitchen Sink Example](https://github.com/cypress-io/cypress-example-kitchensink).

### Run tests

Now you're ready to start running your Cypress tests on TestingBot.
To start the tests, please run:
```bash
$ testingbot-cypress run
```

Once you've started this command, the tests will start to appear in the [TestingBot Dashboard](https://testingbot.com/members).

## Documentation

## Getting Help

If you need help, please reach out to us via info@testingbot.com or our public Slack: https://testingbot.com/support

## License

This project is released under MIT License. Please see the
[LICENSE.md](LICENSE.md) for more details.
