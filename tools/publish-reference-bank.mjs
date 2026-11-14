import {readFile, rename, writeFile} from 'node:fs/promises';
import {refreshReferenceBank} from '../server/reference-bank.js';

const [output, event = 'manual'] = process.argv.slice(2);
if (!output) throw Error('Usage: node tools/publish-reference-bank.mjs <snapshot.json> [event]');
const source = event === 'schedule' ? 'scheduled' : event === 'push' ? 'release' : 'manual';
let previous = null;
try {
  previous = JSON.parse(await readFile(output, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const result = await refreshReferenceBank(previous, {source});
if (result !== previous) {
  await writeFile(output + '.tmp', JSON.stringify(result, null, 2) + '\n');
  await rename(output + '.tmp', output);
}
console.log(JSON.stringify({
  status: result === previous ? 'no-update-due' : result.status,
  attemptedBy: result.attemptedBy, attemptedDay: result.attemptedDay, updatedAt: result.updatedAt, entries: result.entries.length,
}));
