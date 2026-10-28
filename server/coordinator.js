import {VERSION} from './config.js';
import { PROFILES, BY_ID, PARKED, estimateTokens } from './catalog.js';
import { ProviderError, chatCall, transcribeCall, cloudflareImage, pollinationsImage, startHorde, checkHorde, gatewayPrice } from './providers.js';

export const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', ...extra }
});
const dayOf = now => new Date(now).toISOString().slice(0, 10);
const nextDay = now => Date.parse(dayOf(now) + 'T00:00:00Z') + 86400000;
const nextMonth = now => { const date = new Date(now); return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1); };
const pauseMessages = { allowance: 'Free allowance reached', credentials: 'Check account key/access', model_unavailable: 'Model unavailable',
  free_model_unverified: 'Free eligibility could not be verified', timeout: 'Taking too long', capacity: 'Service busy', network: 'Connection unavailable',
  empty_response: 'No answer returned', invalid_response: 'Unreadable provider response', invalid_image: 'No usable image returned' };
const cleanReason = reason => pauseMessages[reason] || 'Temporarily unavailable';

function base64(bytes) { let out = ''; for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(out); }
function unbase64(text) { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); }
async function vaultKey(token) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('OMNIFORGE/provider-vault/v1\n' + token));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(value, token, id) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) },
    await vaultKey(token), new TextEncoder().encode(value));
  return { iv: base64(iv), value: base64(new Uint8Array(encrypted)) };
}
async function unseal(record, token, id) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(record.iv), additionalData: new TextEncoder().encode(id) },
    await vaultKey(token), unbase64(record.value));
  return new TextDecoder().decode(plain);
}
export async function ownerAuthorized(request, env) {
  if (typeof env.MIKEE_ADMIN_TOKEN !== 'string' || env.MIKEE_ADMIN_TOKEN.length < 24) return false;
  const given = request.headers.get('authorization') || '';
  const hash = async text => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const [a, b] = await Promise.all([hash(given), hash('Bearer ' + env.MIKEE_ADMIN_TOKEN)]);
  let different = 0; for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}

// One SQLite-backed Durable Object coordinates the whole deployment. It persists reservations before
// requests, so restarts, concurrent tabs, and different edge locations cannot each spend a fresh quota.
export class MikeeCoordinator {
  constructor(ctx, env, options = {}) {
    this.ctx = ctx; this.env = env; this.fetcher = options.fetch || fetch; this.now = options.now || Date.now;
    this.tail = Promise.resolve();
    this.ready = ctx.storage.get('pool-v1').then(data => { this.data = data || { config: {}, ledger: {}, jobs: {}, global: {} }; });
  }
  async locked(fn) {
    await this.ready;
    const next = this.tail.then(fn); this.tail = next.catch(() => {}); return next;
  }
  async persist() { await this.ctx.storage.put('pool-v1', this.data); }
  config(profile) { return this.data.config[profile.id] || {}; }
  hasKey(profile) { return !profile.key || !!this.env[profile.key] || !!this.config(profile).secret; }
  async key(profile) {
    if (this.env[profile.key]) return this.env[profile.key];
    const secret = this.config(profile).secret;
    if (!secret) return null;
    try { return await unseal(secret, this.env.MIKEE_ADMIN_TOKEN, profile.id); }
    catch { throw new ProviderError('credentials', { retryAfter: 86400000 }); }
  }
  eligible(profile) {
    const cfg = this.config(profile);
    if (cfg.enabled === false) return 'paused';
    if (profile.id.startsWith('cloudflare') && !this.env.AI) return 'needs_binding';
    if (!this.hasKey(profile)) return 'needs_key';
    const confirmedEnv = (this.env.MIKEE_FREE_PROVIDERS || '').split(',').map(x => x.trim()).includes(profile.id);
    if (!profile.public && cfg.freeConfirmed !== true && !confirmedEnv) return 'free_confirmation';
    if (profile.developmentOnly && this.env.MIKEE_DEVELOPMENT_ONLY !== 'true') return 'development_only';
    return 'ready';
  }
  ledger(id, now) {
    const day = dayOf(now), month = day.slice(0, 7);
    let item = this.data.ledger[id];
    if (!item) item = this.data.ledger[id] = { day, month, requests: 0, tokens: 0, monthTokens: 0, monthMicros: 0, audioJobs: 0, recent: [], cooldown: 0, busyUntil: 0, last: 0 };
    if (item.month !== month) { item.month = month; item.monthTokens = 0; item.monthMicros = 0; }
    if (item.day !== day) { item.day = day; item.requests = 0; item.tokens = 0; item.audioJobs = 0; }
    item.recent = item.recent.filter(x => x.at > now - 60000);
    return item;
  }
  limits(profile) {
    const result = { ...profile.limits };
    for (const [name, value] of Object.entries(this.config(profile).limits || {})) {
      if (name in result && Number.isInteger(value) && value > 0) result[name] = name === 'gapMs' ? Math.max(value, result[name]) : Math.min(value, result[name]);
    }
    return result;
  }
  model(profile, capability) {
    if (profile.id === 'zai' && capability === 'vision') return 'glm-4.6v-flash';
    if (profile.id === 'zai' && this.config(profile).model === 'glm-4.6v-flash') return 'glm-4.7-flash';
    return this.config(profile).model || profile.models[0];
  }
  async reserve(profile, tokens, { audio = false, micros = 0, preview = false } = {}) {
    return this.locked(async () => {
      const now = this.now(), state = this.eligible(profile);
      if (state !== 'ready') return { ok: false, reason: state };
      const q = this.ledger(profile.id, now), limits = this.limits(profile);
      let until = 0, reason = 'cooldown';
      if (q.cooldown > now) { until = q.cooldown; reason = q.reason || 'cooldown'; }
      else if (q.busyUntil > now) { until = q.busyUntil; reason = 'busy'; }
      else if (q.requests >= limits.requestsDay || q.tokens + tokens > limits.tokensDay || (audio && q.audioJobs >= 6)) { until = nextDay(now); reason = 'daily_budget'; }
      else if (q.monthTokens + tokens > limits.tokensMonth || q.monthMicros + micros > 4000000) { until = nextMonth(now); reason = 'monthly_budget'; }
      else if (tokens > limits.tokensMinute) return { ok: false, reason: 'request_too_large' };
      else if (q.last && q.last + limits.gapMs > now) { until = q.last + limits.gapMs; }
      else if (q.recent.length >= limits.requestsMinute || q.recent.reduce((sum, x) => sum + x.tokens, 0) + tokens > limits.tokensMinute) { until = (q.recent[0]?.at || now) + 60000; }
      if (until) return { ok: false, reason, retryAt: until };
      if (preview) return { ok: true };
      const reservation = crypto.randomUUID();
      q.requests++; q.tokens += tokens; q.monthTokens += tokens; q.monthMicros += micros; q.audioJobs += audio ? 1 : 0;
      q.last = now; q.busyUntil = now + 65000; q.reservation = reservation;
      q.recent.push({ at: now, tokens, reservation });
      await this.persist();
      return { ok: true, reservation };
    });
  }
  async finish(profile, reservation, error, result) {
    await this.locked(async () => {
      const now = this.now(), q = this.ledger(profile.id, now);
      if (q.reservation === reservation) q.busyUntil = 0;
      if (error) {
        q.reason = error.kind || 'capacity'; q.cooldown = now + Math.max(1000, error.retryAfter || 30000);
      } else {
        q.cooldown = 0; q.reason = ''; if(!result.pending)q.verifiedAt = now; q.lastModel = result.model;
      }
      // No refunds for failed/uncertain calls. Providers can count rejected or timed-out attempts.
      await this.persist();
    });
  }
  async status(owner = false) {
    return this.locked(() => {
      const now = this.now();
      return { mode: 'free-pool', version: VERSION, verified: false,
        ownerSetup: typeof this.env.MIKEE_ADMIN_TOKEN === 'string' && this.env.MIKEE_ADMIN_TOKEN.length >= 24,
        providers: PROFILES.map(profile => {
          const q = this.ledger(profile.id, now), cfg = this.config(profile), eligibility = this.eligible(profile);
          const limits = this.limits(profile);
          const dayExhausted=q.requests>=limits.requestsDay||q.tokens>=limits.tokensDay;
          const monthExhausted=q.monthTokens>=limits.tokensMonth||q.monthMicros>=4000000;
          const exhausted=dayExhausted||monthExhausted;
          const spacing=q.last?q.last+limits.gapMs:0;
          const minute=q.recent.length>=limits.requestsMinute||q.recent.reduce((n,x)=>n+x.tokens,0)>=limits.tokensMinute?(q.recent[0]?.at||now)+60000:0;
          const retryAt=Math.max(q.cooldown||0,q.busyUntil||0,spacing,minute,dayExhausted?nextDay(now):0,monthExhausted?nextMonth(now):0);
          const state=eligibility!=='ready'?eligibility:exhausted?'budget_reached':retryAt>now?'cooldown':'ready';
          return { id: profile.id, name: profile.name, capabilities: profile.capabilities, state,
            model: this.model(profile, 'chat'), models: profile.models, note: profile.note, signup: profile.signup,
            enabled: cfg.enabled !== false, hasKey: this.hasKey(profile), freeConfirmed: profile.public || cfg.freeConfirmed === true || eligibility === 'ready',
            verifiedAt: q.verifiedAt || null, retryAt: eligibility==='ready'&&retryAt>now?retryAt:null,
            ...(owner ? { limits, usage: { requestsDay: q.requests, tokensDay: q.tokens, tokensMonth: q.monthTokens, reservedCreditDollars: q.monthMicros / 1000000, audioJobsDay: q.audioJobs }, reason: q.reason ? cleanReason(q.reason) : null } : {}) };
        }), parked: PARKED };
    });
  }
  async updateConfig(input) {
    return this.locked(async () => {
      const profile = BY_ID[input.id];
      if (!profile) return json({ error: 'Unknown provider.' }, 400);
      if (typeof input.enabled !== 'boolean' || (input.enabled && !profile.public && input.freeConfirmed !== true)) return json({ error: 'Confirm that this account uses a free allowance with paid billing and top-ups disabled.' }, 400);
      if (input.model && !profile.models.includes(input.model)) return json({ error: 'That model is outside the approved free pool.' }, 400);
      if (input.key && (typeof input.key !== 'string' || input.key.length < 8 || input.key.length > 1024 || /\s/.test(input.key))) return json({ error: 'Invalid API key format.' }, 400);
      const old = this.config(profile), cfg = { ...old, enabled: input.enabled, freeConfirmed: input.freeConfirmed === true, model: input.model || old.model || profile.models[0] };
      if (input.key && profile.key) cfg.secret = await seal(input.key, this.env.MIKEE_ADMIN_TOKEN, profile.id);
      if (input.removeKey) delete cfg.secret;
      if (input.limits) {
        cfg.limits = {};
        for (const [name, value] of Object.entries(input.limits)) {
          if (!(name in profile.limits) || !Number.isInteger(value) || value < 1 ||
            (name === 'gapMs' ? value < profile.limits[name] : value > profile.limits[name])) return json({ error: 'Budgets can only be reduced, and request spacing increased.' }, 400);
          cfg.limits[name] = value;
        }
      }
      this.data.config[profile.id] = cfg;
      // A repaired credential may clear an authentication failure, never the quota/budget counters.
      const q = this.ledger(profile.id, this.now());
      if ((input.key || input.removeKey) && ['credentials', 'model_unavailable'].includes(q.reason)) { q.cooldown = 0; q.reason = ''; }
      await this.persist(); return json({ ok: true });
    });
  }
  async globalPermit() {
    return this.locked(async () => {
      const now = this.now(), day = dayOf(now);
      if (this.data.global.day !== day) this.data.global = { day, requests: 0 };
      if (this.data.global.requests >= 400) return false;
      this.data.global.requests++; await this.persist(); return true;
    });
  }
  unavailable(attempts, retryAt) {
    const eligible=attempts.filter(x=>!['needs_key','needs_binding','paused','free_confirmation','development_only'].includes(x.reason));
    if(eligible.length&&eligible.every(x=>x.reason==='request_too_large'))return json({error:'This request is too large for the connected free services. Shorten the message or current document; nothing was truncated.',code:'FREE_POOL_REQUEST_TOO_LARGE',attempts},413);
    const now = this.now(), retryAfter = Math.max(1, Math.ceil(((retryAt || now + 60000) - now) / 1000));
    const hasReady = attempts.some(x => !['needs_key', 'needs_binding', 'paused', 'free_confirmation', 'development_only'].includes(x.reason));
    return json({ error: hasReady ? 'MICHELLE tried the connected free AI services, but none can answer right now. Your project is saved. MICHELLE will choose a service automatically when you try again.' :
      'MICHELLE has no connected free AI service for this task. Provider selection is automatic; only the owner needs to configure API connections.',
      code: hasReady ? 'FREE_POOL_WAIT' : 'FREE_POOL_NOT_CONNECTED', attempts, retryAfter }, hasReady ? 429 : 503, { 'retry-after': String(retryAfter) });
  }
  async route(data, capability = 'chat', audio) {
    if(capability!=='transcribe'&&(!Array.isArray(data.messages)||!data.messages.length))return json({error:'A prepared conversation is required.'},400);
    if (!await this.globalPermit()) return this.unavailable([{ reason: 'daily_budget' }], nextDay(this.now()));
    const requested = data.provider || 'auto';
    if (requested !== 'auto' && !BY_ID[requested]) return json({ error: 'Unknown provider.' }, 400);
    let candidates = PROFILES.filter(p => p.capabilities.includes(capability) && (requested === 'auto' || requested === p.id));
    if (capability === 'transcribe') candidates = candidates.sort((a, b) => (a.id === 'groq' ? -1 : b.id === 'groq' ? 1 : 0));
    const messages = capability === 'transcribe' ? null : data.messages;
    const maxTokens = Math.min(3000,Math.max(500,Number(data.maxTokens)||3000)), attempts = [], started = this.now(); let calls = 0, retryAt = 0;
    for (const profile of candidates) {
      if (calls >= 5 || this.now() - started > 75000) break;
      const model = this.model(profile, capability);
      let tokens = capability === 'transcribe' ? profile.id === 'gemini' ? 16000 : 2000 : estimateTokens(messages, maxTokens);
      let reservation;
      try {
        const eligibility = await this.locked(() => this.eligible(profile));
        if (eligibility !== 'ready') { attempts.push({ provider: profile.id, reason: eligibility }); continue; }
        const key = await this.key(profile);
        let micros = 0;
        if (profile.creditBudget) {
          const check = await this.reserve(profile, tokens, { preview: true });
          if (!check.ok) { attempts.push({ provider: profile.id, reason: check.reason }); if (check.retryAt && (!retryAt || check.retryAt < retryAt)) retryAt = check.retryAt; continue; }
          micros = await gatewayPrice(this.fetcher, profile, key, model, tokens - maxTokens, maxTokens);
        }
        const grant = await this.reserve(profile, tokens, { audio: capability === 'transcribe', micros });
        if (!grant.ok) {
          attempts.push({ provider: profile.id, reason: grant.reason });
          if (grant.retryAt && (!retryAt || grant.retryAt < retryAt)) retryAt = grant.retryAt;
          continue;
        }
        reservation = grant.reservation; calls++;
        const timeout = Math.max(1000, Math.min(maxTokens >= 3000 ? 45000 : 30000, 85000 - (this.now() - started)));
        const result = capability === 'transcribe'
          ? await transcribeCall({ fetcher: this.fetcher, profile, key, model, ...audio, timeout })
          : await chatCall({ fetcher: this.fetcher, env: this.env, profile, key, model, messages, maxTokens, timeout });
        await this.finish(profile, reservation, null, result);
        return json({ ...result, provider: profile.id, providerName: profile.name, live: true, attempts,
          fallbackCount: attempts.filter(a => !['needs_key', 'needs_binding', 'paused', 'free_confirmation', 'development_only'].includes(a.reason)).length });
      } catch (error) {
        const issue = error instanceof ProviderError ? error : new ProviderError('capacity');
        if (reservation) await this.finish(profile, reservation, issue);
        else await this.locked(async () => { const q = this.ledger(profile.id, this.now()); q.reason = issue.kind; q.cooldown = this.now() + (issue.retryAfter || 30000); await this.persist(); });
        if (issue.definitive) return json({ error: issue.kind === 'refused' ? 'The service declined this request. Please revise it.' : 'The service rejected this request. Please revise the input.', code: issue.kind }, issue.status);
        attempts.push({ provider: profile.id, reason: issue.kind });
        const next = this.now() + (issue.retryAfter || 30000); if (!retryAt || next < retryAt) retryAt = next;
      }
    }
    return this.unavailable(attempts, retryAt);
  }
  async image(data) {
    if (!await this.globalPermit()) return this.unavailable([{ reason: 'daily_budget' }], nextDay(this.now()));
    const attempts = []; let retryAt = 0;
    if (data.provider && data.provider !== 'auto' && !['cloudflare-image', 'pollinations-image', 'horde-image'].includes(data.provider)) return json({ error: 'Unknown image provider.' }, 400);
    for (const profile of PROFILES.filter(p => p.capabilities.includes('image') && (!data.provider || data.provider === 'auto' || data.provider === p.id))) {
      const grant = await this.reserve(profile, 0);
      if (!grant.ok) { attempts.push({ provider: profile.id, reason: grant.reason }); if (grant.retryAt && (!retryAt || grant.retryAt < retryAt)) retryAt = grant.retryAt; continue; }
      try {
        if (profile.id === 'pollinations-image' || profile.id === 'cloudflare-image') {
          const result = profile.id === 'cloudflare-image' ? await cloudflareImage(this.env, data.prompt) : await pollinationsImage(this.fetcher, data.prompt, crypto.getRandomValues(new Uint32Array(1))[0]);
          await this.finish(profile, grant.reservation, null, result);
          return json({ ...result, provider: profile.id, providerName: profile.name, live: true, attempts });
        }
        const externalId = await startHorde(this.fetcher, data.prompt), id = crypto.randomUUID();
        await this.locked(async () => {
          for (const [key, job] of Object.entries(this.data.jobs)) if (job.expires < this.now()) delete this.data.jobs[key];
          this.data.jobs[id] = { externalId, expires: this.now() + 600000, lastPoll: 0, provider: profile.id, state: 'queued' };
          await this.persist();
        });
        await this.finish(profile, grant.reservation, null, { model: 'stable_diffusion', pending: true });
        return json({ jobId: id, state: 'queued', provider: profile.id, providerName: profile.name, live: false, attempts, pollAfter: 10 }, 202);
      } catch (error) {
        const issue = error instanceof ProviderError ? error : new ProviderError('capacity');
        await this.finish(profile, grant.reservation, issue);
        if (issue.definitive) return json({ error: 'The image request was declined. Please revise it.' }, 422);
        attempts.push({ provider: profile.id, reason: issue.kind });
      }
    }
    return this.unavailable(attempts, retryAt);
  }
  async job(id, cancel = false) {
    const job = await this.locked(async () => {
      const j = this.data.jobs[id];
      if (!j || j.expires < this.now()) return null;
      if (j.result || j.state === 'cancelled') return structuredClone(j);
      if (!cancel && this.now() - j.lastPoll < 8000) return { throttled: true };
      j.lastPoll = this.now(); await this.persist(); return structuredClone(j);
    });
    if (!job) return json({ error: 'Image job expired or was not found.' }, 404);
    if (job.throttled) return json({ state: 'queued', pollAfter: 10 });
    if (job.result) return json(job.result);
    if (job.state === 'cancelled') return json({ state: 'cancelled' });
    try {
      const result = await checkHorde(this.fetcher, job.externalId, cancel);
      const response = { ...result, provider: job.provider, providerName: 'AI Horde Images', live: result.state === 'done', pollAfter: 10 };
      if (cancel || result.state === 'done') await this.locked(async () => {
        const current = this.data.jobs[id]; if (current) { current.state = result.state; if (!cancel) current.result = response; if(result.state==='done')this.ledger(job.provider,this.now()).verifiedAt=this.now(); await this.persist(); }
      });
      return json(response);
    } catch (error) { return json({ error: error?.kind === 'refused' ? 'The image was declined by the provider.' : 'The image queue is unavailable. Please try again later.' }, error?.kind === 'refused' ? 422 : 502); }
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/providers') return json(await this.status());
      if (path.startsWith('/admin/')) {
        if (!await ownerAuthorized(request, this.env)) return json({ error: 'Owner access required.' }, 401);
        if (request.method === 'GET') return json(await this.status(true));
        if (request.method === 'PUT') return await this.updateConfig(await request.json());
      }
      if (path === '/completion') {const data=await request.json();return await this.route(data,data.image?'vision':'chat');}
      if (path === '/image') return await this.image(await request.json());
      if (path.startsWith('/image/')) return await this.job(path.split('/')[2], request.method === 'DELETE');
      if (path === '/transcribe') {
        const form = await request.formData(), file = form.get('file');
        return await this.route({ provider: form.get('provider') || 'auto' }, 'transcribe', { audio: await file.arrayBuffer(), mimeType: file.type, filename: file.name });
      }
      return json({ error: 'Not found.' }, 404);
    } catch {
      // Storage/quota failures must stop requests, never fall back to untracked in-memory budgets.
      return json({ error: 'The free-usage coordinator is unavailable. Your saved project is unchanged.' }, 503);
    }
  }
}
