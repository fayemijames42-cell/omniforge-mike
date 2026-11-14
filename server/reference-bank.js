import {fetchBounded, ProviderError, retryDelay} from './providers.js';

const DAY = 86400000;
const LIMIT = 64;
const BATCH = 8;
const ANCHORS = 6;
const KEY = 'reference-bank-v1';
const LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/';
const PROJECT = 'https://github.com/fayemijames42-cell/omniforge-mike';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'OMNIFORGE-Reference/1.0 (' + PROJECT + ')',
  'Api-User-Agent': 'OMNIFORGE-Reference/1.0 (' + PROJECT + ')',
};
const TOPICS = [
  ['Mathematics', 'maths math numbers'],
  ['Physics', 'physical science matter energy'],
  ['Satoru Gojo', 'saturo gojo satori gojo jjk jujutsu kaisen character'],
  ['List of tallest buildings', 'tallest highest building buildings skyscraper world'],
  ['Chemistry', 'chemical science reactions'],
  ['Biology', 'life science organisms'],
  ['Electricity', 'electric charge energy'],
  ['Computer science', 'computing computers'],
  ['Artificial intelligence', 'AI machine intelligence'],
  ['Nigeria', 'Nigerian country Africa'],
  ['Lagos', 'Lagos Nigeria city'],
  ['Water cycle', 'hydrologic cycle evaporation condensation precipitation'],
  ['Binary number', 'binary numbers base two bits'],
  ['Ohm\'s law', 'ohms law voltage current resistance'],
  ['Calculus', 'calculus integration differentiation'],
  ['Solar System', 'planets sun astronomy'],
  ['Photosynthesis', 'plants sunlight chlorophyll'],
  ['Internet', 'internet computer networks world wide web'],
  ['World Wide Web', 'web websites web pages'],
  ['Jujutsu Kaisen', 'jjk manga anime'],
  ['Burj Khalifa', 'tallest building Dubai skyscraper'],
  ['Engineering', 'engineering applied science technology'],
  ['Economics', 'economics markets resources'],
  ['World history', 'world history civilizations'],
  ['Earth', 'earth planet world'],
  ['Geography', 'geography world places'],
  ['Education', 'education teaching learning'],
  ['Probability', 'probability chance chance mathematics'],
  ['Statistics', 'statistics analysing data'],
  ['Algebra', 'algebra unknowns equations'],
  ['Geometry', 'geometry shapes space'],
  ['Language', 'language linguistics communication'],
  ['Literature', 'literature written works'],
  ['Renewable energy', 'renewable energy solar wind'],
  ['Climate change', 'global warming climate'],
  ['History', 'history historical records sources'],
  ['English grammar', 'grammar English language'],
  ['Set (mathematics)', 'set sets mathematics set theory'],
  ['Percentage', 'percent percentages maths'],
  ['Ratio', 'ratio proportion mathematics'],
  ['Web accessibility', 'accessible websites WCAG'],
  ['HTML', 'website web markup'],
  ['CSS', 'website styles cascading style sheets'],
  ['JavaScript', 'browser programming web scripting'],
];

const dayOf = time => new Date(time).toISOString().slice(0, 10);
const plain = (value, limit) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
const emptyState = () => ({attemptedDay: '', attemptedBy: null, updatedAt: null, nextTopic: 0, retryAt: 0, status: 'pending', entries: []});

function chooseTopics(previous) {
  const today = TOPICS.slice(0, ANCHORS);
  const rotation = TOPICS.slice(today.length);
  const start = previous.nextTopic % rotation.length;
  for (let i = 0; i < BATCH - ANCHORS; i++) today.push(rotation[(start + i) % rotation.length]);
  return {topics: today, nextTopic: (start + BATCH - ANCHORS) % rotation.length};
}

export function referenceRequest(env, method = 'GET', scheduledTime) {
  if (!env.DAILY_BUDGET?.getByName) throw Error('Reference storage is unavailable.');
  const stub = env.DAILY_BUDGET.getByName('omniforge-public-reference-v1');
  const options = method === 'POST' ? {
    method,
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({scheduledTime}),
  } : {method};
  return stub.fetch(new Request('https://budget.internal/reference-bank', options));
}

export async function refreshScheduledReference(env, scheduledTime) {
  const response = await referenceRequest(env, 'POST', scheduledTime);
  if (!response.ok) throw Error('Scheduled reference refresh failed.');
  return response.json();
}

export async function updateReferenceBank(state, fetcher = fetch, scheduledTime = Date.now(), now = Date.now, source = 'scheduled') {
  const day = dayOf(scheduledTime);
  const claimed = await state.storage.transaction(async tx => {
    const current = await tx.get(KEY) || emptyState();
    if (current.attemptedDay >= day || current.retryAt > now()) return null;
    await tx.put(KEY, {...current, attemptedDay: day, attemptedBy: source, status: 'checking'});
    return current;
  });
  if (!claimed) return {status: 'already-attempted'};
  const {topics, nextTopic} = chooseTopics(claimed);
  const url = new URL('https://en.wikipedia.org/w/api.php');
  for (const [name, value] of Object.entries({
    action: 'query', prop: 'extracts|info', titles: topics.map(topic => topic[0]).join('|'),
    exlimit: 'max', exintro: '1', explaintext: '1', exchars: '620',
    redirects: '1', format: 'json', formatversion: '2',
  })) url.searchParams.set(name, value);
  let entries, retryAt = 0;
  try {
    const {bytes} = await fetchBounded(fetcher, url.toString(), {headers: HEADERS}, {
      timeout: 6500, maximum: 70000, validate(response) {
        if (!response.ok) throw new ProviderError('reference_unavailable', {
          retryAfter: retryDelay(response.headers.get('retry-after'), now()),
        });
      },
    });
    const query = JSON.parse(new TextDecoder().decode(bytes)).query;
    const aliases = new Map(topics);
    const redirects = Array.isArray(query?.redirects) ? query.redirects : [];
    for (const {from, to} of redirects) {
      if (aliases.has(from) && typeof to === 'string') aliases.set(to, aliases.get(from));
    }
    const retrievedAt = new Date(now()).toISOString();
    const byId = new Map(claimed.entries.map(entry => [entry.id, entry]));
    for (const page of (Array.isArray(query?.pages) ? query.pages : []).slice(0, BATCH)) {
      if (!page || !aliases.has(page.title) || !Number.isSafeInteger(page.pageid) || page.pageid < 1 ||
          !Number.isSafeInteger(page.lastrevid) || page.lastrevid < 1) continue;
      const title = plain(page.title, 130), answer = plain(page.extract, 680);
      if (answer.length < 70) continue;
      const id = 'wiki-' + page.pageid;
      const aliasesForPage = [byId.get(id)?.tags, aliases.get(page.title)].filter(Boolean).join(' ').split(' ');
      byId.set(id, {
        id, question: title, tags: plain([...new Set(aliasesForPage)].join(' '), 160), answer,
        url: 'https://en.wikipedia.org/w/index.php?oldid=' + page.lastrevid,
        retrievedAt,
      });
      entries = byId;
    }
  } catch (error) {
    if (error instanceof ProviderError && error.retryAfter > 0) retryAt = now() + error.retryAfter;
  }

  return state.storage.transaction(async tx => {
    const current = await tx.get(KEY);
    if (current?.attemptedDay !== day) return {status: 'superseded'};
    if (!entries) {
      await tx.put(KEY, {...current, retryAt, status: 'unavailable'});
      return {status: 'unavailable'};
    }
    const ordered = [...entries.values()].sort((left, right) => right.retrievedAt.localeCompare(left.retrievedAt)).slice(0, LIMIT);
    const updatedAt = new Date(now()).toISOString();
    await tx.put(KEY, {...current, updatedAt, nextTopic, retryAt: 0, status: 'updated', entries: ordered});
    return {status: 'updated', updatedAt, count: ordered.length};
  });
}

export async function referenceSnapshot(state) {
  const value = await state.storage.get(KEY) || emptyState();
  return {
    format: 1, updatedAt: value.updatedAt, attemptedDay: value.attemptedDay || null, attemptedBy: value.attemptedBy,
    status: value.status, publisher: 'Wikipedia', license: LICENSE, entries: value.entries,
  };
}
