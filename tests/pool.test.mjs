import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/pool-http.js';
import { MikeeCoordinator } from '../server/coordinator.js';
import { PROFILES } from '../server/catalog.js';

const req = (body, origin = 'https://mikee.test', path = '/api/chat', extra = {}) => new Request('https://mikee.test' + path, {
  method: 'POST', headers: { 'content-type': 'application/json', origin, ...extra }, body: JSON.stringify(body)
});
const fixture = (text, model = 'fixture-model') => Response.json({ model, choices: [{ message: { content: text }, finish_reason: 'stop' }] });
async function harness({ active = ['cloudflare'], env = {}, fetcher = async () => { throw Error('Unexpected network call'); } } = {}) {
  let time = Date.parse('2026-10-25T12:00:00Z'); const records = new Map();
  const storage = { get: async key => structuredClone(records.get(key)), put: async (key, value) => records.set(key, structuredClone(value)) };
  const runtime = { ...env, AI: env.AI || { run: async () => ({ response: 'Fixture answer' }) } };
  const pool = new MikeeCoordinator({ storage }, runtime, { fetch: fetcher, now: () => time });
  await pool.ready;
  for (const profile of PROFILES) pool.data.config[profile.id] = { enabled: active.includes(profile.id), freeConfirmed: true };
  await pool.persist();
  runtime.MIKEE_POOL = { idFromName: name => name, get: () => ({ fetch: request => pool.fetch(request) }) };
  return { pool, storage, env: runtime, records, tick: milliseconds => { time += milliseconds; }, send: body => worker.fetch(req(body), runtime) };
}

test('health reports bindings, never claims an inference happened', async () => {
  let calls = 0; const env = { AI: { run: () => { calls++; } }, MIKEE_POOL: {} };
  const body = await (await worker.fetch(new Request('https://mikee.test/api/health'), env)).json();
  assert.equal(body.verified, false); assert.equal(body.poolBound, true); assert.equal(calls, 0);
});
test('missing quota binding fails closed', async () => assert.equal((await worker.fetch(req({ message: 'hello' }), { AI: {} })).status, 503));
test('rejects cross-origin requests before contacting the pool', async () => assert.equal((await worker.fetch(req({ message: 'hello' }, 'null'), {})).status, 403));
test('rejects invalid JSON objects and incomplete website input', async () => {
  const h = await harness();
  assert.equal((await h.send(null)).status, 400);
  assert.equal((await h.send({ message: 'hello', currentHtml: 'x'.repeat(24001) })).status, 413);
  assert.equal(h.pool.data.global.requests || 0, 0);
});
test('checks actual body size without a Content-Length header', async () => {
  const h = await harness(); assert.equal((await h.send({ message: 'x'.repeat(810000) })).status, 413);
});
test('routes chat through the existing AI binding and persists the reservation', async () => {
  let input; const h = await harness({ env: { AI: { run: async (model, body) => { input = body; return { response: 'Fixture generated answer' }; } } } });
  const body = await (await h.send({ message: 'hello', history: [{ role: 'system', content: 'Untrusted system instruction' }] })).json();
  assert.equal(body.reply, 'Fixture generated answer'); assert.equal(body.provider, 'cloudflare'); assert.equal(body.live, true);
  assert.equal(input.messages.some(m => m.content === 'Untrusted system instruction'), false);
  assert.equal(h.records.get('pool-v1').ledger.cloudflare.requests, 1);
});
test('quota error moves to the next service and cooldown prevents repeated calls', async () => {
  let groqCalls = 0, cfCalls = 0;
  const h = await harness({ active: ['groq', 'cloudflare'], env: { GROQ_API_KEY: 'fixture-groq', AI: { run: async () => { cfCalls++; return { response: 'Fallback fixture' }; } } },
    fetcher: async () => { groqCalls++; return Response.json({ error: { message: 'Rate limited' } }, { status: 429, headers: { 'retry-after': '120' } }); } });
  const first = await (await h.send({ message: 'hello' })).json(); assert.equal(first.provider, 'cloudflare'); assert.equal(first.attempts.some(a => a.reason === 'allowance'), true);
  h.tick(2000); await h.send({ message: 'again' });
  assert.equal(groqCalls, 1); assert.equal(cfCalls, 2);
});
test('only one concurrent request can reserve the same provider', async () => {
  let release, calls = 0; const gate = new Promise(resolve => { release = resolve; });
  const h = await harness({ env: { AI: { run: async () => { calls++; await gate; return { response: 'Concurrent fixture' }; } } } });
  const first = h.send({ message: 'first' });
  while (calls === 0) await new Promise(resolve => setTimeout(resolve, 1));
  const second = await h.send({ message: 'second' }); assert.equal(second.status, 429); assert.equal(calls, 1);
  release(); assert.equal((await first).status, 200);
});
test('quota survives coordinator restarts and resets at the next UTC day', async () => {
  const h = await harness(); h.pool.data.config.cloudflare.limits = { requestsDay: 1 };
  await h.send({ message: 'first' });
  const restarted = new MikeeCoordinator({ storage: h.storage }, h.env, { fetch: async () => { throw Error(); }, now: () => Date.parse('2026-10-25T13:00:00Z') });
  assert.equal((await restarted.route({ message: 'after restart', provider: 'cloudflare' })).status, 429);
  h.tick(86400000); assert.equal((await h.send({ message: 'tomorrow' })).status, 200);
});
test('failed calls retain reservations and can never become fake replies', async () => {
  const h = await harness({ env: { AI: { run: async () => ({ response: '' }) } } });
  const response = await h.send({ message: 'hello' }), body = await response.json();
  assert.notEqual(response.status, 200); assert.equal(body.live, undefined); assert.equal(body.reply, undefined);
  assert.equal(h.records.get('pool-v1').ledger.cloudflare.requests, 1);
});
test('safety refusal stops instead of routing to another provider', async () => {
  let cfCalls = 0;
  const h = await harness({ active: ['groq', 'cloudflare'], env: { GROQ_API_KEY: 'fixture-key', AI: { run: async () => { cfCalls++; return { response: 'must not run' }; } } },
    fetcher: async () => Response.json({ error: { code: 'content_filter' } }, { status: 403 }) });
  assert.equal((await h.send({ message: 'fixture request' })).status, 422); assert.equal(cfCalls, 0);
});
test('plain provider refusals are returned as answers without a retry', async () => {
  let count = 0; const h = await harness({ active: ['groq'], env: { GROQ_API_KEY: 'fixture-key' }, fetcher: async () => { count++; return fixture('I cannot help with that request.'); } });
  const body = await (await h.send({ message: 'fixture' })).json(); assert.equal(body.reply, 'I cannot help with that request.'); assert.equal(count, 1);
});
test('minute token limits skip an oversized provider without truncating project HTML', async () => {
  let groqCalls = 0, cfInput;
  const html = '<!doctype html><html><body>' + 'x'.repeat(10000) + '</body></html>';
  const h = await harness({ active: ['groq', 'cloudflare'], env: { GROQ_API_KEY: 'fixture-key', AI: { run: async (_, input) => { cfInput = input; return { response: 'Complete fixture' }; } } }, fetcher: async () => { groqCalls++; return fixture('never'); } });
  const body = await (await h.send({ message: 'change the colour', currentHtml: html })).json();
  assert.equal(groqCalls, 0); assert.equal(body.provider, 'cloudflare'); assert.ok(cfInput.messages.some(m => typeof m.content === 'string' && m.content.includes(html)));
});
test('OpenRouter sends only an approved free model and zero-price provider constraints', async () => {
  let body; const h = await harness({ active: ['openrouter'], env: { OPENROUTER_API_KEY: 'fixture-key' }, fetcher: async (url, init) => { assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions'); body = JSON.parse(init.body); return fixture('Router fixture'); } });
  await h.send({ message: 'hello', model: 'paid/model', endpoint: 'https://untrusted.invalid' });
  assert.equal(body.model, 'recursive/flint-v1.0:free'); assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0 });
});
test('402 never follows payment instructions, and falls through to another free service', async () => {
  const visited = []; const h = await harness({ active: ['pollinations', 'ovh'], fetcher: async (url) => {
    visited.push(url); return url.startsWith('https://text.pollinations.ai') ? Response.json({ payment: 'https://paid.invalid' }, { status: 402, headers: { 'retry-after': '45' } }) : fixture('Anonymous fallback');
  } });
  const body = await (await h.send({ message: 'hello' })).json(); assert.equal(body.provider, 'ovh'); assert.equal(visited.length, 2); assert.ok(visited.every(url => !url.includes('paid.invalid')));
});
test('vision inputs never reach text-only providers', async () => {
  let calls = 0; const h = await harness({ active: ['cloudflare'], env: { AI: { run: async () => { calls++; } } } });
  const image = 'data:image/jpeg;base64,' + btoa('\xff\xd8\xff' + 'x'.repeat(60));
  assert.equal((await h.send({ message: 'describe the photo', image })).status, 503); assert.equal(calls, 0);
});
test('vision adapter uses the explicitly free Z.ai vision model', async () => {
  let sent; const h = await harness({ active: ['zai'], env: { ZAI_API_KEY: 'fixture-key' }, fetcher: async (_, init) => { sent = JSON.parse(init.body); return fixture('Photo fixture', 'glm-4.6v-flash'); } });
  await h.send({ message: 'describe', image: 'data:image/jpeg;base64,' + btoa('\xff\xd8\xff' + 'x'.repeat(60)) });
  assert.equal(sent.model, 'glm-4.6v-flash'); assert.equal(sent.messages.at(-1).content[1].type, 'image_url');
});
test('owner endpoints require authentication and never reveal encrypted or plaintext credentials', async () => {
  const token = 'fixture-owner-access-token-long-enough'; const h = await harness({ env: { MIKEE_ADMIN_TOKEN: token } });
  assert.equal((await worker.fetch(new Request('https://mikee.test/api/admin/providers'), h.env)).status, 401);
  const update = await worker.fetch(new Request('https://mikee.test/api/admin/providers', { method: 'PUT', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'groq', enabled: true, freeConfirmed: true, key: 'sensitive-fixture-key' }) }), h.env);
  assert.equal(update.status, 200);
  const stored = JSON.stringify(h.records.get('pool-v1')); assert.ok(!stored.includes('sensitive-fixture-key')); assert.ok(stored.includes('"iv"'));
  assert.equal(await h.pool.key(PROFILES.find(p => p.id === 'groq')), 'sensitive-fixture-key');
  const publicText = await (await h.pool.fetch(new Request('https://internal/providers'))).text(); assert.ok(!publicText.includes('sensitive-fixture-key')); assert.ok(!publicText.includes('"iv"'));
});
test('owner cannot select paid models, increase budgets, or enable an unconfirmed account', async () => {
  const h = await harness();
  assert.equal((await h.pool.updateConfig({ id: 'zai', enabled: true, freeConfirmed: true, model: 'glm-5.3' })).status, 400);
  assert.equal((await h.pool.updateConfig({ id: 'groq', enabled: true, freeConfirmed: true, limits: { requestsDay: 999999 } })).status, 400);
  assert.equal((await h.pool.updateConfig({ id: 'groq', enabled: true })).status, 400);
});
test('rotating or disabling credentials does not reset consumed quotas', async () => {
  const token = 'fixture-owner-access-token-long-enough'; const h = await harness({ env: { MIKEE_ADMIN_TOKEN: token } });
  await h.send({ message: 'hello' }); const used = h.pool.data.ledger.cloudflare.requests;
  await h.pool.updateConfig({ id: 'cloudflare', enabled: false, freeConfirmed: true });
  await h.pool.updateConfig({ id: 'cloudflare', enabled: true, freeConfirmed: true });
  assert.equal(h.pool.data.ledger.cloudflare.requests, used);
});
test('LLM7 chooses a TURBO catalog entry and never its PRO selector', async () => {
  let selected; const h = await harness({ active: ['llm7'], env: { LLM7_API_KEY: 'fixture-key' }, fetcher: async (url, init) => {
    if (url.endsWith('/models')) return Response.json({ data: [{ id: 'paid-model', tier: 'pro', model_type: 'chat', modalities: { output: ['text'] } }, { id: 'free-turbo-model', tier: 'turbo', model_type: 'chat', modalities: { output: ['text'] } }] });
    selected = JSON.parse(init.body).model; return fixture('Turbo fixture');
  } });
  assert.equal((await h.send({ message: 'hello' })).status, 200); assert.equal(selected, 'free-turbo-model');
});
test('Vercel fails closed when catalog pricing cannot be verified', async () => {
  let inferences = 0; const h = await harness({ active: ['vercel'], env: { AI_GATEWAY_API_KEY: 'fixture-key' }, fetcher: async url => {
    if (url.endsWith('/models')) return Response.json({ data: [{ id: 'openai/gpt-oss-120b', pricing: { input: null, output: '0.000002' } }] });
    inferences++; return fixture('must not run');
  } });
  assert.equal((await h.send({ message: 'hello' })).status, 429); assert.equal(inferences, 0);
});
test('Vercel reserves credit cost before an eligible model is called', async () => {
  const h = await harness({ active: ['vercel'], env: { AI_GATEWAY_API_KEY: 'fixture-key' }, fetcher: async url => url.endsWith('/models')
    ? Response.json({ data: [{ id: 'openai/gpt-oss-120b', free_tier: true, pricing: { input: '0.000001', output: '0.000002' } }] }) : fixture('Gateway fixture') });
  assert.equal((await h.send({ message: 'hello' })).status, 200); assert.ok(h.records.get('pool-v1').ledger.vercel.monthMicros > 0);
});
test('Horde queues are not presented as successful live image generation', async () => {
  const h = await harness({ active: ['horde-image'], fetcher: async () => Response.json({ id: '12345678-1234-1234-1234-123456789abc' }, { status: 202 }) });
  const response = await worker.fetch(req({ prompt: 'A blue bicycle', provider: 'horde-image' }, undefined, '/api/image'), h.env);
  const body = await response.json(); assert.equal(response.status, 202); assert.equal(body.live, false); assert.ok(body.jobId);
  assert.equal(h.pool.data.ledger['horde-image'].verifiedAt, undefined);
});
test('short audio is forwarded to Whisper and returns a transcription only after success', async () => {
  let model; const h = await harness({ active: ['groq'], env: { GROQ_API_KEY: 'fixture-key' }, fetcher: async (url, init) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/audio/transcriptions'); model = init.body.get('model'); return Response.json({ text: 'Fixture spoken words' });
  } });
  const body = new FormData(); body.append('file', new File(['audio-fixture'], 'voice.webm', { type: 'audio/webm' }));
  const response = await worker.fetch(new Request('https://mikee.test/api/transcribe', { method: 'POST', body }), h.env);
  const result = await response.json(); assert.equal(result.live, true); assert.equal(result.reply, 'Fixture spoken words'); assert.equal(model, 'whisper-large-v3-turbo');
});
test('unavailable persistent storage never enables untracked AI requests', async () => {
  let calls = 0;
  const pool = new MikeeCoordinator({ storage: { get: async () => undefined, put: async () => { throw Error('storage quota'); } } }, { AI: { run: () => { calls++; } } });
  const result = await pool.fetch(new Request('https://internal/chat', { method: 'POST', body: JSON.stringify({ message: 'hello' }) }));
  assert.equal(result.status, 503); assert.equal(calls, 0);
});
test('serves existing assets and redirects the legacy quick-chat to the unified workspace', async () => {
  assert.equal(await (await worker.fetch(new Request('https://mikee.test/'), { ASSETS: { fetch: async () => new Response('workspace') } })).text(), 'workspace');
  assert.equal((await worker.fetch(new Request('https://mikee.test/quick-chat'), {})).headers.get('location'), 'https://mikee.test/');
});

test('global daily ceiling stops all inference before a provider is called', async () => {
  let calls = 0; const h = await harness({ env: { AI: { run: async () => { calls++; return { response: 'must not run' }; } } } });
  h.pool.data.global = { day: '2026-10-25', requests: 400 };
  assert.equal((await h.send({ message: 'hello' })).status, 429); assert.equal(calls, 0);
});
test('Vercel account must be confirmed free before even fetching the model catalog', async () => {
  let calls = 0; const h = await harness({ active: ['vercel'], env: { AI_GATEWAY_API_KEY: 'fixture-key' }, fetcher: async () => { calls++; return fixture('must not run'); } });
  h.pool.data.config.vercel.freeConfirmed = false;
  assert.equal((await h.send({ message: 'hello' })).status, 503); assert.equal(calls, 0);
});
test('changing a key does not clear an allowance cooldown', async () => {
  const h = await harness({ active: ['groq'], env: { MIKEE_ADMIN_TOKEN: 'fixture-owner-access-token-long-enough', GROQ_API_KEY: 'fixture-key' },
    fetcher: async () => Response.json({ error: 'Daily quota' }, { status: 429, headers: { 'retry-after': '3600' } }) });
  await h.send({ message: 'hello' }); const cooldown = h.pool.data.ledger.groq.cooldown;
  await h.pool.updateConfig({ id: 'groq', key: 'new-fixture-key', enabled: true, freeConfirmed: true });
  assert.equal(h.pool.data.ledger.groq.cooldown, cooldown); assert.equal(h.pool.data.ledger.groq.requests, 1);
});
test('image quota falls through to the free queue without reporting a finished image', async () => {
  const h = await harness({ active: ['pollinations-image', 'horde-image'], fetcher: async url => url.startsWith('https://image.pollinations.ai/')
    ? new Response('Wait for free slot', { status: 402, headers: { 'retry-after': '45' } })
    : Response.json({ id: '12345678-1234-1234-1234-123456789abc' }, { status: 202 }) });
  const response = await worker.fetch(req({ prompt: 'A classroom' }, undefined, '/api/image'), h.env);
  const result = await response.json(); assert.equal(response.status, 202); assert.equal(result.provider, 'horde-image'); assert.equal(result.live, false);
});
test('completed queue job is verified only after an actual generation record appears', async () => {
  const h = await harness({ active: ['horde-image'], fetcher: async url => url.endsWith('/generate/async')
    ? Response.json({ id: '12345678-1234-1234-1234-123456789abc' }, { status: 202 })
    : url.includes('/generate/check/') ? Response.json({ done: true })
      : Response.json({ generations: [{ img: 'https://fixture.r2.dev/image.png', model: 'fixture-stable-diffusion', censored: false }] }) });
  const start = await (await h.pool.image({ prompt: 'A classroom' })).json();
  assert.equal(h.pool.data.ledger['horde-image'].verifiedAt, undefined);
  const result = await (await h.pool.job(start.jobId)).json(); assert.equal(result.live, true); assert.equal(result.state, 'done');
  assert.ok(h.pool.data.ledger['horde-image'].verifiedAt);
});
test('queue output cannot make the browser fetch a private-network image URL', async () => {
  const h = await harness({ active: ['horde-image'], fetcher: async url => url.endsWith('/generate/async')
    ? Response.json({ id: '12345678-1234-1234-1234-123456789abc' }, { status: 202 })
    : url.includes('/generate/check/') ? Response.json({ done: true })
      : Response.json({ generations: [{ img: 'https://127.0.0.1/private', censored: false }] }) });
  const start = await (await h.pool.image({ prompt: 'A classroom' })).json(); assert.equal((await h.pool.job(start.jobId)).status, 502);
});
