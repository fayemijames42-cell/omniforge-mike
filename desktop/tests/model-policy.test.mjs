import test from 'node:test';
import assert from 'node:assert/strict';
import {TIERS,recommendTier,getTier,canDownload} from '../model-policy.mjs';
const gb=n=>n*1073741824;
test('recommended model scales to available RAM',()=>{
 assert.equal(recommendTier(gb(3)),'lite');
 assert.equal(recommendTier(gb(4)),'lite');
 assert.equal(recommendTier(gb(8)),'standard');
 assert.equal(recommendTier(gb(16)),'pro');
 assert.equal(recommendTier(gb(32)),'studio');
});
test('models are allowlisted and require spare disk space',()=>{
 assert.equal(getTier('arbitrary:malicious'),null);
 assert.equal(getTier('qwen3.5:9b').id,'pro');
 assert.equal(canDownload('qwen3.5:9b',gb(6)),false);
 assert.equal(canDownload('qwen3.5:9b',gb(9)),true);
 assert.equal(new Set(TIERS.map(t=>t.model)).size,TIERS.length);
});
