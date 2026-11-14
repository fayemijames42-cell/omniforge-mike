import {fetchBounded, ProviderError, retryDelay} from './providers.js';
import '../src/wikipedia.js';

const wiki = globalThis.OMNI_WIKIPEDIA;
const DAY = 86400000;
const ANCHORS = 7;
const ROTATING = 7;
const SEED_SIZE = 20;
const TOPICS = [
  ['Mathematics', 'maths math numbers'],
  ['Physics', 'physical science matter energy'],
  ['Satoru Gojo', 'saturo gojo satori gojo jjk jujutsu kaisen character'],
  ['List of tallest buildings', 'tallest highest building buildings skyscraper world burj khalifa'],
  ['Chemistry', 'chemical science reactions'],
  ['Biology', 'life science organisms'],
  ['Pythagorean theorem', 'pythagoras theorem right triangle hypotenuse'],
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
const headers = {Accept: 'application/json', 'User-Agent': wiki.agent, 'Api-User-Agent': wiki.agent};
const retriesOn = (response, now) => {
  const retryAfter = retryDelay(response.headers.get('retry-after'), now);
  if (response.status === 429 || retryAfter > 0) return retryAfter || DAY;
  return 0;
};

export async function refreshReferenceBank(previous, {fetcher = fetch, now = Date.now, source = 'scheduled'} = {}) {
  const start = now(), day = dayOf(start);
  if (previous?.attemptedDay >= day || Number(previous?.retryAt) > start) return previous;
  const last = previous ? wiki.validateSnapshot(previous) : {entries: []};
  const rotation = TOPICS.slice(ANCHORS);
  const offset = Number.isInteger(last.nextTopic) && last.nextTopic >= 0 ? last.nextTopic % rotation.length : 0;
  const topics = previous ? TOPICS.slice(0, ANCHORS) : TOPICS.slice(0, SEED_SIZE);
  if (previous) {
    for (let i = 0; i < ROTATING; i++) topics.push(rotation[(offset + i) % rotation.length]);
  }
  const nextTopic = (offset + topics.length - ANCHORS) % rotation.length;
  const attempted = {...last, attemptedDay: day, attemptedBy: source};
  try {
    const url = wiki.apiUrl({...wiki.introduction, titles: topics.map(topic => topic[0]).join('|'), exlimit: 'max', redirects: '1', maxlag: '5'});
    const {bytes} = await fetchBounded(fetcher, url, {headers}, {
      timeout: 18000, maximum: 95000, validate(response) {
        const retryAfter = retriesOn(response, now());
        if (!response.ok || retryAfter) throw new ProviderError('reference_unavailable', {retryAfter});
      },
    });
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (data.error?.code === 'maxlag') throw new ProviderError('reference_unavailable', {retryAfter: DAY});
    const query = data.query;
    const aliases = new Map(topics);
    const redirects = Array.isArray(query?.redirects) ? query.redirects : [];
    for (const {from, to} of redirects) {
      if (aliases.has(from) && typeof to === 'string') aliases.set(to, aliases.get(from));
    }
    const retrievedAt = new Date(now()).toISOString();
    const byId = new Map(last.entries.map(entry => [entry.id, entry]));
    let refreshed = 0;
    for (const page of (Array.isArray(query?.pages) ? query.pages : []).slice(0, topics.length)) {
      const article = wiki.article(page);
      if (!article || !aliases.has(page.title) || !Number.isSafeInteger(page.pageid) || page.pageid < 1) continue;
      const id = 'wiki-' + page.pageid;
      const aliasesForPage = [byId.get(id)?.tags, aliases.get(page.title)].filter(Boolean).join(' ').split(' ');
      byId.set(id, {
        id, question: article.title, tags: wiki.plain([...new Set(aliasesForPage)].join(' '), 160),
        answer: article.excerpt, url: article.url, retrievedAt,
      });
      refreshed++;
    }
    if (!refreshed) throw Error('Wikipedia returned no usable introductions.');
    const entries = [...byId.values()].sort((left, right) =>
      right.retrievedAt.localeCompare(left.retrievedAt) || left.question.localeCompare(right.question)).slice(0, wiki.maxRecords);
    return wiki.validateSnapshot({
      ...attempted, format: 1, publisher: 'Wikipedia', license: wiki.license, updatedAt: retrievedAt,
      nextTopic, retryAt: 0, status: 'updated', entries,
    });
  } catch (error) {
    if (!previous) throw error;
    return {...attempted, status: 'unavailable', retryAt: error?.retryAfter > 0 ? now() + error.retryAfter : 0};
  }
}

export async function publishedReference(seed, fetcher = fetch) {
  try {
    const {bytes} = await fetchBounded(fetcher, wiki.snapshotUrl, {
      headers: {Accept: 'application/json'},
      cf: {cacheEverything: true, cacheTtlByStatus: {'200-299': 300, '404': 60, '500-599': 0}},
    }, {
      timeout: 3500, maximum: wiki.maxBytes,
      validate(response) {
        if (!response.ok) throw Error('Published reference unavailable.');
      },
    });
    const latest = wiki.validateSnapshot(JSON.parse(new TextDecoder().decode(bytes)));
    if (latest.updatedAt >= seed.updatedAt) return {...latest, delivery: 'published'};
  } catch {}
  return {...seed, delivery: 'bundled'};
}
