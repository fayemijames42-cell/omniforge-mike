// Optional browser QA. Uses explicit provider fixtures; never claims live inference.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { MikeeCoordinator } from '../server/coordinator.js';
import { PROFILES } from '../server/catalog.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwright = await import(process.env.MIKEE_QA_PLAYWRIGHT || 'playwright');
let launch = { headless: true };
if (process.env.MIKEE_QA_CHROMIUM) {
  const { default: chromium } = await import(process.env.MIKEE_QA_CHROMIUM);
  launch = { ...launch, executablePath: await chromium.executablePath(), args: chromium.args };
}
let time = Date.now(), fixtureCalls = 0;
const storageData = new Map();
const storage = { get: async key => structuredClone(storageData.get(key)), put: async (key, value) => storageData.set(key, structuredClone(value)) };
const doc = navy => '<!doctype html><html><head><title>Elegant Fashion</title><style>body{background:' + (navy ? 'navy' : 'white') + ';color:gold}</style></head><body><main><h1>Elegant Fashion</h1><p>Clothes made for you.</p></main></body></html>';
const answer = messages => {
  const last = messages.at(-1).content;
  if (Array.isArray(last)) return 'Fixture photo analysis.';
  if (/incomplete HTML fixture/.test(last)) return '<!doctype html><html><body>incomplete';
  return doc(/navy/.test(last));
};
const allow={limit:async()=>({success:true})};
const env = {CHAT_VISITOR_LIMIT:allow,CHAT_SHARED_LIMIT:allow,IMAGE_VISITOR_LIMIT:allow,IMAGE_SHARED_LIMIT:allow,DAILY_BUDGET:{getByName:()=>({fetch:async()=>Response.json({allowed:true})})}, MIKEE_ADMIN_TOKEN: 'fixture-owner-token-at-least-24-characters', AI: { run: async (_, input) => {
  fixtureCalls++; await new Promise(r => setTimeout(r, 350)); return { response: answer(input.messages) };
} } };
const fixtureImage = Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=', 'base64'), Buffer.alloc(80)]);
const pool = new MikeeCoordinator({ storage }, env, { now: () => time, fetch: async (url, init) => {
  if (url.startsWith('https://image.pollinations.ai/')) return new Response(fixtureImage, { headers: { 'content-type': 'image/png' } });
  if (url.endsWith('/audio/transcriptions')) return Response.json({ text: 'Fixture audio transcript ready for review.' });
  const input = JSON.parse(init.body); fixtureCalls++;
  return Response.json({ model: input.model, choices: [{ message: { content: answer(input.messages) }, finish_reason: 'stop' }] });
} });
await pool.ready;
for (const p of PROFILES) pool.data.config[p.id] = { enabled: ['cloudflare', 'pollinations-image'].includes(p.id), freeConfirmed: true };
await pool.persist();
env.MIKEE_POOL = { idFromName: x => x, get: () => ({ fetch: request => { time += 2000; return pool.fetch(request); } }) };
env.ASSETS = { fetch: async request => {
  const path = new URL(request.url).pathname, file = resolve(root, 'public', path === '/' ? 'index.html' : '.' + path);
  if (!file.startsWith(resolve(root, 'public') + '/')) return new Response('', { status: 404 });
  try { return new Response(await readFile(file), { headers: { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[extname(file)] || 'application/octet-stream' } }); }
  catch { return new Response('', { status: 404 }); }
} };
const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
    const request = new Request('http://127.0.0.1:' + server.address().port + incoming.url, { method: incoming.method, headers: incoming.headers,
      ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Buffer.concat(chunks) } : {}) });
    const response = await worker.fetch(request, env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { outgoing.writeHead(500); outgoing.end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await playwright.chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
const go=async tab=>{await page.locator('#mobileMenuButton').click();await page.locator('[data-mobile="'+tab+'"]').click()};
const settings=async()=>{await page.locator('#mobileMenuButton').click();await page.locator('[data-drawer-action="settings"]').click()};
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.setExtraHTTPHeaders({origin:'http://127.0.0.1:'+server.address().port});
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.OMNI_TEST && !!window.MIKEE_POOL.catalog());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('#prompt').fill('Create a website for a fashion business.');
  await page.locator('#sendBtn').click(); await page.locator('#typingIndicator').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.OMNI_TEST.getProject()?.messages.some(m => m.engine === 'LIVE AI'));
  await page.locator('#typingIndicator').waitFor({ state: 'hidden' });
  assert.ok(await page.evaluate(() => window.OMNI_TEST.getProject().website.rawHtml.includes('Elegant Fashion')));
  await go('chat');
  await page.locator('#prompt').fill('Make the main background navy.'); await page.locator('#sendBtn').click();
  await page.waitForFunction(() => window.OMNI_TEST.getProject()?.website.rawHtml.includes('background:navy'));
  await page.locator('#typingIndicator').waitFor({ state: 'hidden' });
  const before = await page.evaluate(() => window.OMNI_TEST.getProject().website.rawHtml);
  await go('chat'); await page.locator('#prompt').fill('Update the website with incomplete HTML fixture.'); await page.locator('#sendBtn').click();
  await page.waitForFunction(() => window.OMNI_TEST.getProject().messages.at(-1).text.includes('incomplete HTML'));
  await page.locator('#typingIndicator').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.OMNI_TEST.getProject().website.rawHtml), before);
  time+=61000; // Move the fixture clock past the existing three-request minute allowance.
  await page.locator('#prompt').fill('Explain how to create a website.'); await page.locator('#sendBtn').click();
  await page.locator('#typingIndicator').waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.OMNI_TEST.getProject().messages.at(-1)?.role==='assistant');
  assert.equal(await page.evaluate(()=>window.OMNI_TEST.getProject().website.rawHtml),before);
  assert.ok(await page.evaluate(()=>!window.OMNI_TEST.getProject().messages.at(-1).text.startsWith('Your website is updated')));
  await page.locator('#composerMode').selectOption('image'); await page.locator('#prompt').fill('A classroom illustration.'); await page.locator('#sendBtn').click();
  await page.waitForFunction(() => window.OMNI_TEST.getProject().assets.length === 1);
  await page.locator('#typingIndicator').waitFor({ state: 'hidden' });
  await go('photos');
  await page.locator('.asset-tile').click(); await page.locator('#addPhoto').click();
  await page.waitForFunction(() => window.OMNI_TEST.getProject().website.rawHtml.includes('omniforge-asset://'));
  const exported = await page.evaluate(async () => window.OMNI.renderSite(window.OMNI_TEST.getProject(), await window.OMNI.assetMap(window.OMNI_TEST.getProject())));
  assert.ok(exported.includes('data:image/png;base64,'));
  await settings(); await page.locator('.connections-section > summary').click();
  await page.locator('#ownerToken').fill(env.MIKEE_ADMIN_TOKEN); await page.locator('#unlockOwner').click();
  await page.locator('#ownerLock').waitFor({ state: 'visible' });
  await page.locator('[data-connection="groq"] > summary').click();
  await page.locator('[data-connection="groq"] .connection-key').fill('private-fixture-provider-key');
  await page.locator('[data-connection="groq"] .connection-free').check();
  await page.locator('[data-connection="groq"] .connection-enabled').check();
  await page.locator('[data-save-connection="groq"]').click();
  await page.waitForFunction(() => document.querySelector('#connectionNotice').textContent.includes('Connection saved'));
  assert.ok(!JSON.stringify(storageData.get('pool-v1')).includes('private-fixture-provider-key'));
  assert.equal(await page.evaluate(async () => await window.OMNI.pref('GROQ_API_KEY')), undefined);
  await page.locator('#saveSettings').click(); await go('chat');
  await page.locator('#audioFile').setInputFiles({ name: 'fixture.webm', mimeType: 'audio/webm', buffer: Buffer.from('fixture audio') });
  await page.waitForFunction(() => document.querySelector('#prompt').value === 'Fixture audio transcript ready for review.');
  await page.locator('#typingIndicator').waitFor({ state: 'hidden' });
  await page.screenshot({ path: resolve(root, '../mikee-mobile-qa.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS mobile UI: typing feedback, same-site edit, incomplete HTML preservation, HTML explanation keeps the current project, image generation/save/placement/export, encrypted owner connection, audio draft; provider responses are fixtures. Calls:', fixtureCalls);
} catch(error) {console.log('UI failure state',JSON.stringify(await page.evaluate(()=>({messages:window.OMNI_TEST?.getProject()?.messages?.slice(-2),assets:window.OMNI_TEST?.getProject()?.assets?.length,toast:document.querySelector('#toast')?.textContent,local:window.OMNI_OFFLINE_UI?.isOffline()}))),errors);throw error;} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
