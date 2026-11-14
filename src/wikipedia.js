/* Common Wikipedia request and reference data contracts for the app and Worker. */
(function (root) {
  'use strict';
  const license = 'https://creativecommons.org/licenses/by-sa/4.0/';
  const agent = 'OMNIFORGE-Reference/1.0 (https://github.com/fayemijames42-cell/omniforge-mike)';
  const snapshotUrl = 'https://raw.githubusercontent.com/fayemijames42-cell/omniforge-mike/reference-snapshots/snapshot.json';
  const maxRecords = 64;
  const maxBytes = 150000;
  const privateTopic = /\b(?:my|mine|our|ours|confidential|secret|private key|api key|access token|credit card|pin number|passport number|log(?:-| )?in|sign(?:-| )?in|matriculation number|medical records)\b|https?:|www\.|@|\b\d{7,}\b/i;
  const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  const validText = (value, limit) => typeof value === 'string' && !!value.trim() && value.length <= limit;
  const revision = value => Number.isSafeInteger(value) && value > 0;

  function validateSnapshot(data) {
    if (data?.format !== 1 || data.publisher !== 'Wikipedia' || data.license !== license ||
        !timestamp(data.updatedAt) || !Array.isArray(data.entries) ||
        !data.entries.length || data.entries.length > maxRecords) throw Error('Daily reference snapshot is unavailable.');
    const ids = new Set();
    for (const entry of data.entries) {
      if (!entry || typeof entry.id !== 'string' || !/^(?:wiki-\d{1,12}|lookup-\d{1,16})$/.test(entry.id) || ids.has(entry.id) ||
          !validText(entry.question, 130) || !validText(entry.answer, 680) ||
          typeof entry.tags !== 'string' || entry.tags.length > 160 || !timestamp(entry.retrievedAt) ||
          entry.retrievedAt > data.updatedAt ||
          typeof entry.url !== 'string' || !/^https:\/\/en\.wikipedia\.org\/w\/index\.php\?oldid=\d{1,16}$/.test(entry.url)) {
        throw Error('Invalid public reference record.');
      }
      ids.add(entry.id);
    }
    return data;
  }
  async function readJSON(response, signal) {
    const reader = response.body?.getReader();
    if (!reader) throw Error('Wikipedia response has no data.');
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', cancel, {once: true});
    try {
      if (!response.ok || Number(response.headers.get('content-length')) > maxBytes) throw Error('Wikipedia response is unavailable.');
      const decoder = new TextDecoder();
      let size = 0, text = '';
      for (;;) {
        const {done, value} = await reader.read();
        if (signal.aborted) throw Error('Wikipedia download cancelled.');
        if (done) return JSON.parse(text + decoder.decode());
        size += value.length;
        if (size > maxBytes) throw Error('Wikipedia response is too large.');
        text += decoder.decode(value, {stream: true});
      }
    } finally {
      signal.removeEventListener('abort', cancel);
      cancel();
    }
  }

  function topic(value) {
    if (typeof value !== 'string' || value.length > 150 || /[\u0000-\u001f\u007f]/.test(value)) return '';
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized.length < 2 || privateTopic.test(normalized) ? '' : normalized;
  }

  function apiUrl(parameters) {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.search = new URLSearchParams({action: 'query', format: 'json', formatversion: '2', ...parameters});
    return url.toString();
  }

  const introduction = {
    prop: 'extracts|info', exintro: '1', explaintext: '1', exchars: '620',
  };
  function lookupUrl(query, fromBrowser = false) {
    return apiUrl({
      ...introduction, generator: 'search', gsrsearch: query, gsrnamespace: '0',
      gsrlimit: '4', exlimit: '4', ...(fromBrowser ? {origin: '*'} : {}),
    });
  }
  const plain = (value, limit) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
  const revisionUrl = id => 'https://en.wikipedia.org/w/index.php?oldid=' + id;

  function article(page) {
    if (!page || !revision(page.lastrevid) || !validText(page.title, 130)) return null;
    const excerpt = plain(page.extract, 680);
    if (excerpt.length < 70) return null;
    return {title: plain(page.title, 130), url: revisionUrl(page.lastrevid), excerpt, publisher: 'Wikipedia', publishedAt: null};
  }

  function sources(data) {
    if (data?.error || !Array.isArray(data?.query?.pages)) return [];
    return data.query.pages.slice(0, 4).sort((left, right) => (left?.index ?? 5) - (right?.index ?? 5))
      .map(article).filter(Boolean);
  }

  function reply(evidence, cloudRetryAfter = null) {
    return {
      reply: (cloudRetryAfter !== null ? 'Cloud AI is unavailable. ' : '') + 'Wikipedia returned these excerpts:\n\n' +
        evidence.sources.map(item => '**' + item.title + '**\n' + item.excerpt).join('\n\n') + '\n\nRetrieved reference · no AI inference.',
      live: false, toolOnly: true, provider: 'reference-retrieval', providerName: 'Wikipedia reference retrieval',
      artifact: {type: 'text'}, cloudRetryAfter, sources: evidence.sources,
      research: {scope: evidence.scope, retrievedAt: evidence.retrievedAt, note: 'Open the linked articles for full context.'},
      orchestration: {kind: 'reference-retrieval', toolsUsed: ['reference-search']},
    };
  }

  root.OMNI_WIKIPEDIA = {license, agent, snapshotUrl, maxRecords, maxBytes, introduction, validateSnapshot, readJSON, topic, apiUrl, lookupUrl, plain, article, sources, reply};
})(typeof window === 'object' ? window : globalThis);
