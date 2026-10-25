import { json, ownerAuthorized } from './coordinator.js';
export { MikeeCoordinator } from './coordinator.js';

const audioTypes = new Set(['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/flac', 'video/webm']);
async function readBody(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) return null;
  const reader = request.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > limit) return null; chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
export async function bodyJSON(request, limit = 800000, requireType = true) {
  if (requireType && !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return { error: json({ error: 'Send JSON.' }, 415) };
  const bytes = await readBody(request, limit);
  if (bytes === null) return { error: json({ error: 'Request too large.' }, 413) };
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
    return { data, bytes: bytes.length };
  } catch { return { error: json({ error: 'A valid JSON object is required.' }, 400) }; }
}
export function validImage(value) {
  if (typeof value !== 'string' || value.length > 500000) return false;
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return false;
  try {
    const bytes = atob(match[2].slice(0, 32));
    return match[1] === 'jpeg' ? bytes.startsWith('\xff\xd8\xff') : match[1] === 'png' ? bytes.startsWith('\x89PNG\r\n\x1a\n') : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
  } catch { return false; }
}
function pool(env) {
  if (!env.MIKEE_POOL) return null;
  return env.MIKEE_POOL.get(env.MIKEE_POOL.idFromName('omniforge-free-pool-v1'));
}
function forward(stub, path, method, body, authorization) {
  const headers = {};
  if (authorization) headers.authorization = authorization;
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  return stub.fetch(new Request('https://mikee.internal' + path, { method, headers, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) }));
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'Cross-origin requests are not allowed.' }, 403);
    const known = ['/api/providers', '/api/image', '/api/transcribe', '/api/admin/providers'].includes(path) || /^\/api\/image\/[a-f0-9-]{36}$/.test(path);
    if (!known) return json({ error: 'Not found.' }, 404);
    if (path.startsWith('/api/admin/') && !await ownerAuthorized(request, env)) return json({ error: 'Owner access required. Configure MIKEE_ADMIN_TOKEN as a Worker secret to manage connections.' }, 401);
    const stub = pool(env);
    if (!stub) return json({ error: 'The free-usage coordinator binding is missing. Deploy the repository configuration before using AI.' }, 503);
    try {
      if (path === '/api/providers' && request.method === 'GET') return await forward(stub, '/providers', 'GET');
      if (path === '/api/admin/providers') {
        if (request.method === 'GET') return await forward(stub, '/admin/providers', 'GET', null, request.headers.get('authorization'));
        if (request.method === 'PUT') {
          const parsed = await bodyJSON(request, 6000); if (parsed.error) return parsed.error;
          return await forward(stub, '/admin/providers', 'PUT', parsed.data, request.headers.get('authorization'));
        }
      }
      if (path === '/api/image' && request.method === 'POST') {
        const parsed = await bodyJSON(request, 6000); if (parsed.error) return parsed.error;
        const data = parsed.data;
        if (typeof data.prompt !== 'string' || data.prompt.trim().length < 3 || data.prompt.length > 1500) return json({ error: 'Describe an image in 3–1,500 characters.' }, 400);
        return await forward(stub, '/image', 'POST', { prompt: data.prompt.trim(), provider: data.provider || 'auto' });
      }
      if (/^\/api\/image\/[a-f0-9-]{36}$/.test(path) && ['GET', 'DELETE'].includes(request.method)) return await forward(stub, path.slice(4), request.method);
      if (path === '/api/transcribe' && request.method === 'POST') {
        if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) return json({ error: 'Upload an audio file.' }, 415);
        const bytes = await readBody(request, 2200000);
        if (!bytes) return json({ error: 'Use a short recording under 2 MB.' }, 413);
        const form = await new Request(request.url, { method: 'POST', headers: { 'content-type': request.headers.get('content-type') }, body: bytes }).formData();
        const file = form.get('file');
        if (!(file instanceof Blob) || !file.size || file.size > 2097152 || !audioTypes.has(file.type.split(';')[0])) return json({ error: 'Use a supported audio recording under 2 MB.' }, 400);
        const clean = new FormData(); clean.append('file', file, String(file.name || 'recording.webm').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80));
        clean.append('provider', typeof form.get('provider') === 'string' ? form.get('provider') : 'auto');
        return await forward(stub, '/transcribe', 'POST', clean);
      }
      return json({ error: 'Method not allowed.' }, 405);
    } catch { return json({ error: 'The free-usage coordinator is temporarily unavailable. Please try again later.' }, 503); }
  }
};

export async function complete(request,env,data){
 const stub=pool(env);if(!stub)return json({error:'Shared free-provider protection is not configured.',protectionUnavailable:true},503);
 return forward(stub,'/completion','POST',data);
}
