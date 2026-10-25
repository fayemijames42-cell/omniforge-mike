import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const runtime={window:{},Date,Math,JSON,Error,Number,String,Set};
vm.createContext(runtime);
vm.runInContext(readFileSync(new URL('../src/core.js',import.meta.url),'utf8'),runtime);
vm.runInContext(readFileSync(new URL('../src/projectfiles.js',import.meta.url),'utf8'),runtime);
const F=runtime.window.OMNI_FILES;
const newProject=()=>({codeWorkspace:F.fresh('My Project'),updatedAt:0});
test('Static code projects contain three local editable files',()=>{
 const p=newProject();assert.equal(F.KEYS.length,3);
 assert.match(F.validate(p).files['index.html'],/styles\.css/);
 assert.equal(p.messages,undefined);
});
test('File editing produces snapshots, reviewable diff, and Undo',()=>{
 const p=newProject(),prior=p.codeWorkspace.files['styles.css'];
 assert.equal(F.write(p,'styles.css',prior+'\nh1{color:green}'),true);
 assert.equal(p.codeWorkspace.version,2);
 assert.match(F.diff(prior,p.codeWorkspace.files['styles.css']),/\+ h1/);
 assert.equal(F.undo(p),'styles.css');
 assert.equal(p.codeWorkspace.files['styles.css'],prior);
 assert.throws(()=>F.undo(p),/No saved edit/);
});
test('Untrusted imported code has strict size and filename validation',()=>{
 const p=newProject();
 assert.throws(()=>F.write(p,'evil.js','alert(1)'),/Unknown/);
 assert.throws(()=>F.write(p,'styles.css','x'.repeat(160001)),/too long/);
 assert.throws(()=>F.fromHtml('x'.repeat(160001)),/too long/);
 assert.throws(()=>F.validate({codeWorkspace:{files:{'index.html':'x'}}}),/Missing/);
});
test('Preview code is embedded with a deny-by-default content security policy',()=>{
 const html=runtime.window.OMNI.sandboxHTML(F.exportDocument(newProject()));
 assert.match(html,/default-src 'none'/);
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/form-action 'none'/);
 assert.match(html,/Hello from OMNIFORGE/);
 assert.ok(!html.includes('src="app.js"'));
 assert.ok(!html.includes('href="styles.css"'));
});
