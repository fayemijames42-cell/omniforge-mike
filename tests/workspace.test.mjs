import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const runtime={window:{crypto:{randomUUID:(()=>{let i=0;return()=>String(++i)})()}},Date,Math};
vm.createContext(runtime);
const code=readFileSync(new URL('../src/workspace.js',import.meta.url),'utf8');
vm.runInContext(code,runtime);
const W=runtime.window.OMNI_WORKSPACE;
const p=()=>({name:'New Chat',messages:[],updatedAt:0});

test('Notes are local artifacts, not assumed websites',()=>{
 const project=p();
 assert.equal(W.notesOf(project).length,0);
 const one=W.createNote(project,'Calculus Practice','f(x)=x²');
 assert.equal(one.title,'Calculus Practice');
 assert.equal(W.findNote(project,one.id).body,'f(x)=x²');
 assert.equal(project.activeNoteId,one.id);
 assert.equal(project.notes.length,1);
 assert.equal(project.website,undefined);
});
test('Editing saves version history and supports Undo',()=>{
 const project=p(),note=W.createNote(project,'Original','abc');
 assert.equal(W.updateNote(project,note.id,'Updated','abcd'),true);
 assert.equal(W.updateNote(project,note.id,'Updated','abcd'),false);
 assert.equal(note.history.length,1);
 W.undoNote(project,note.id);
 assert.equal(note.title,'Original');assert.equal(note.body,'abc');
 assert.throws(()=>W.undoNote(project,note.id),/no previous/i);
});
test('Deletion selects next note and prevents phantom access',()=>{
 const project=p(),first=W.createNote(project,'A','a'),second=W.createNote(project,'B','b');
 W.deleteNote(project,second.id);
 assert.equal(project.activeNoteId,first.id);
 assert.equal(W.findNote(project,second.id),null);
 assert.throws(()=>W.deleteNote(project,'missing'),/not be found/);
});
test('Hard local storage limits are enforced',()=>{
 const project=p(),note=W.createNote(project,'A','a');
 assert.throws(()=>W.updateNote(project,note.id,'A','x'.repeat(16001)),/16,000/);
 for(let i=1;i<20;i++)W.createNote(project,'Note '+i,'');
 assert.throws(()=>W.createNote(project),/20-note limit/);
});
test('NEXUS: ordinary subject question does not generate a website',()=>{
 const task=W.route('Explain what a website is and how it works','general',false);
 assert.equal(task.includeWebsite,false);assert.equal(task.action,'chat');
 assert.equal(task.local,true);
});
test('NEXUS: website creation and contextual updates are distinct',()=>{
 const create=W.route('Create a website for NOVATECH','general',false);
 assert.equal(create.action,'website-create');assert.equal(create.includeWebsite,false);
 const edit=W.route('Change the hero section on this website','general',true);
 assert.equal(edit.action,'website-edit');assert.equal(edit.includeWebsite,true);
 assert.equal(W.route('hi','general',true).includeWebsite,false);
});
test('NEXUS: focus inferred locally; explicit focus wins',()=>{
 assert.equal(W.route('Teach me basic electronics').focus,'learn');
 assert.equal(W.route('Debug this javascript function').focus,'code');
 assert.equal(W.route('Plan a community event','write').focus,'write');
});
test('Reply title and export filename use safe, bounded text',()=>{
 assert.equal(W.replyTitle('# Title\nBody'),'Title');
 assert.equal(W.filename('My notes: Chapter 2'), 'my-notes-chapter-2.md');
 assert.equal(W.filename('My notes: Chapter 2','txt'), 'my-notes-chapter-2.txt');
});
