import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import retired, { DailyBudget, MikeeCoordinator } from '../cloudflare-retired.js';

test('Production routes, previews, traffic triggers and cloud AI are disabled', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url)));
  assert.equal(config.name, 'omniforge-mike');
  assert.equal(config.main, 'cloudflare-retired.js');
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.deepEqual(config.routes, []);
  assert.deepEqual(config.triggers.crons, []);
  assert.equal(config.ai, undefined);
  assert.equal(config.assets, undefined);
  assert.equal(config.observability.enabled, false);
  assert.deepEqual(config.migrations.map(entry => entry.new_sqlite_classes), [['DailyBudget'], ['MikeeCoordinator']]);
});

test('Retired handler and preserved namespaces return Gone without using a binding', async () => {
  const forbidden = new Proxy({}, {get() {throw Error('Accessed a retired binding or storage');}});
  for (const entry of [retired, new DailyBudget(forbidden, forbidden), new MikeeCoordinator(forbidden, forbidden)]) {
    for (const path of ['/', '/api/chat', '/api/image', '/api/transcribe', '/api/research', '/api/admin/providers']) {
      const response = await entry.fetch(new Request('https://offline.invalid' + path, {method: 'POST'}), forbidden, forbidden);
      assert.equal(response.status, 410);
      assert.match(await response.text(), /moved offline/);
    }
  }
});
