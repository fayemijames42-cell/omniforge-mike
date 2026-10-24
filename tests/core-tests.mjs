/** Dependency-free deterministic rules and export checks. */
import {readFileSync} from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ctx={window:{},crypto:{randomUUID:()=>`test-${Math.random()}`},console,Date};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../src/core.js',import.meta.url),'utf8'),ctx);const C=ctx.window.OMNI;
const prompts=['Build a website for a creative learning academy','Make an elegant perfume business website','Create a website for a community event'];
const sites=prompts.map(s=>C.callTool('create_website',null,{prompt:s}));
assert.equal(sites[0].website.layout,'education');assert.equal(sites[1].website.layout,'collection');assert.equal(sites[2].website.layout,'event');
assert.notEqual(sites[0].website.pages[0].sections.map(s=>s.type).join(','),sites[1].website.pages[0].sections.map(s=>s.type).join(','));
const before=C.snapshot(sites[0]);const changed=C.callTool('update_website',sites[0],{instruction:'Make the headings larger and add a contact page'});assert.equal(changed.changed,true);assert.equal(changed.project.website.pages.length,3);assert(changed.project.website.headingScale>1);const undone=C.undo(changed.project);assert.equal(undone.website.pages.length,2);assert.equal(JSON.stringify(C.snapshot(undone)),JSON.stringify(before));
const html=C.renderSite(changed.project);assert(html.includes('data-page="contact"'));assert(html.includes('href="#/contact"'));assert(html.includes('<script>'));
assert.throws(()=>C.callTool('update_website',sites[0],{instruction:5}),/validation/);
assert.throws(()=>C.callTool('unknown',sites[0],{}),/Unknown/);
console.log('PASS: three website layouts, same-site follow-up, undo, local HTML navigation, malformed tool arguments');
const aiHTML='<!doctype html><html><head><title>AI fixture</title></head><body>Generated document</body></html>';
const aiProject=C.change(sites[0],p=>{p.website.rawHtml=aiHTML}).project;
assert.equal(C.renderSite(aiProject),aiHTML);
assert.equal(C.renderSite(C.undo(aiProject)),C.renderSite(sites[0]));
console.log('PASS: AI document export and undo preserve the actual HTML');
