'use strict';
// Runs against the compiled lib/ (npm test builds first).
const test = require('node:test');
const assert = require('node:assert');

const Poller = require('../lib/utils/poller').default;
const Tunnel = require('../lib/utils/tunnel').default;
const RunProject = require('../lib/commands/run').default;

const config = { auth: { key: 'k', secret: 's' }, run_settings: {} };
const spinner = () => {
	const calls = [];
	return { calls, succeed: (m) => calls.push(['succeed', m]), fail: (m) => calls.push(['fail', m]) };
};
const caps = { browserName: 'chrome', version: 'latest', platform: 'WIN11' };

class StubPoller extends Poller {
	constructor(responses) {
		super(config, { onReady() {} }, 5);
		this.responses = responses;
	}
	async getApiResponse() {
		const next = this.responses.length > 1 ? this.responses.shift() : this.responses[0];
		if (next instanceof Error) throw next;
		return next;
	}
}

test('a FAILED run rejects the poll with the remote errors', async () => {
	const s = spinner();
	const poller = new StubPoller([
		{ runs: [{ status: 'WAITING', capabilities: caps, errors: [] }] },
		{ runs: [{ status: 'FAILED', capabilities: caps, errors: ['Cypress version 10.0.0 no longer supports cypress.json'] }] },
	]);
	await assert.rejects(poller.check(1, s), /chrome latest WIN11: run FAILED \(Cypress version 10\.0\.0 no longer supports cypress\.json\)/);
	assert.deepStrictEqual(s.calls.map((c) => c[0]), ['fail']);
});

test('a session the grid could not start (error… id, run still READY) fails fast', async () => {
	const started = Date.now();
	const poller = new StubPoller([
		{ runs: [{ status: 'READY', capabilities: caps, errors: [], test: { sessionId: 'error-a1b2c3', environment: {} } }] },
	]);
	await assert.rejects(poller.check(1, spinner()), /failed to start/);
	assert.ok(Date.now() - started < 1000, 'gave up on the first poll, not after the 30 minute READY cap');
});

test('DONE still resolves, with success taken from the runs', async () => {
	const s = spinner();
	const poller = new StubPoller([
		{ runs: [{ status: 'READY', capabilities: caps, errors: [], test: { sessionId: 'abc', environment: {} } }] },
		{ runs: [{ status: 'DONE', capabilities: caps, errors: [], success: true, test: { sessionId: 'abc', environment: {} } }] },
	]);
	const response = await poller.check(1, s);
	assert.strictEqual(response.success, true);
	assert.deepStrictEqual(s.calls.map((c) => c[0]), ['succeed']);
});

test('repeated API errors reject instead of becoming unhandled rejections', async () => {
	const poller = new StubPoller([new Error('socket hang up')]);
	await assert.rejects(poller.check(1, spinner()), /TestingBot API error: socket hang up/);
});

test('a single API error is retried', async () => {
	const poller = new StubPoller([
		new Error('blip'),
		{ runs: [{ status: 'DONE', capabilities: caps, errors: [], success: false }] },
	]);
	const response = await poller.check(1, spinner());
	assert.strictEqual(response.success, false);
});

test('Tunnel.stop() is safe when no tunnel was ever opened, and closes an open one once', async () => {
	const tunnel = new Tunnel(config);
	await tunnel.stop(); // used to throw: Cannot read properties of undefined (reading 'close')
	assert.strictEqual(tunnel.isActive(), false);

	let closed = 0;
	tunnel.tunnel = { close: (cb) => { closed += 1; cb(); } };
	assert.strictEqual(tunnel.isActive(), true);
	await tunnel.stop();
	await tunnel.stop();
	assert.strictEqual(closed, 1);
});

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
	test(`${signal} closes the tunnel and exits ${code}`, async (t) => {
		const runner = new RunProject({ cf: false });
		let closed = 0;
		const tunnel = new Tunnel(config);
		tunnel.tunnel = { close: (cb) => { closed += 1; cb(); } };
		runner.tunnel = tunnel;
		runner.config = config; // no projectId: stopJob is a no-op

		const exited = new Promise((resolve) => {
			t.mock.method(process, 'exit', (c) => resolve(c));
		});
		const before = process.listeners(signal).slice();
		runner.registerCloseHandlers();
		const added = process.listeners(signal).filter((l) => !before.includes(l));
		t.after(() => {
			for (const ev of ['SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2', 'uncaughtException', 'unhandledRejection']) {
				for (const l of process.listeners(ev)) if (!before.includes(l)) process.removeListener(ev, l);
			}
		});

		assert.strictEqual(added.length, 1);
		added[0]();
		assert.strictEqual(await exited, code);
		assert.strictEqual(closed, 1);
	});
}

test('exitHandler exits even when the tunnel was configured but never opened', async (t) => {
	const runner = new RunProject({ cf: false });
	runner.tunnel = new Tunnel(config);
	runner.config = { ...config, run_settings: { start_tunnel: true } };
	const exited = new Promise((resolve) => t.mock.method(process, 'exit', (c) => resolve(c)));
	await runner.exitHandler(130);
	assert.strictEqual(await exited, 130);
});
