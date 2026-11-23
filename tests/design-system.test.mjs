import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../src/visual-refresh.css',import.meta.url),'utf8');

test('visual release stylesheet is loaded by the existing app without replacing controls',()=>{
 assert.match(html,/<link rel="stylesheet" href="\.\/src\/style\.css">/);
 assert.match(html,/<link rel="stylesheet" href="\.\/src\/visual-refresh\.css">/);
 for(const id of ['chatStream','prompt','sendBtn','mobileMenuButton','mobileDrawer','siteFrame','settingsButton'])
   assert.match(html,new RegExp('id="'+id+'"'));
});
test('unified visual design supports mobile and reduced motion with no external assets',()=>{
 assert.match(css,/@media\(max-width:800px\)/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.mobile-drawer/);
 assert.match(css,/\.composer/);
 assert.match(css,/\.message\.assistant/);
 assert.doesNotMatch(css,/@import|https?:\/\/|backdrop-filter\s*:/i);
});
