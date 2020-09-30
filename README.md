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

To use the CLI in combination with [TestingBot Tunnel](https://testingbot.com/support/other/tunnel), you will need to have JDK8 (or higher) installed.
TestingBot Tunnel is used to connect TestingBot's browser grid with your local computer or network.

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

### Environment variables

If you prefer to keep your TestingBot credentials in environment variables, you can use `TESTINGBOT_KEY` and `TESTINGBOT_SECRET` environment variables.

If you are running this CLI in a CI/CD like Jenkins or TeamCity, you can set the
environment variable `TESTINGBOT_CI=1`. The CLI will output the `TestingBotSessionID`, in combination
with a TestingBot CI plugin you will be able to view the test's details from inside your CI.

## Getting Help

If you need help, please reach out to us via info@testingbot.com or our public Slack: https://testingbot.com/support

## License

This project is released under MIT License. Please see the
[LICENSE.md](LICENSE.md) for more details.
