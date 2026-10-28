/* OMNIFORGE / NEXUS local-first workspace utilities.
 * Zero network calls, no model invocation, no third-party dependencies.
 */
(function(root){
'use strict';
const MAX_NOTES=20, MAX_BODY=16000, MAX_TITLE=80, MAX_REVISIONS=12;
const clipped=(value,limit)=>String(value??'').trim().slice(0,limit);
function notesOf(project){
 if(!project||typeof project!=='object')throw Error('Open a conversation first.');
 if(!Array.isArray(project.notes))project.notes=[];
 return project.notes;
}
function createNote(project,title='Untitled Note',body=''){
 const notes=notesOf(project);
 if(notes.length>=MAX_NOTES)throw Error('This chat has reached the 20-note limit. Export or remove a note first.');
 const now=Date.now();
 const note={id:root.crypto?.randomUUID?.()||'note-'+now+'-'+Math.random().toString(36).slice(2),title:clipped(title,MAX_TITLE)||'Untitled Note',body:clipped(body,MAX_BODY),createdAt:now,updatedAt:now,history:[]};
 notes.push(note);project.activeNoteId=note.id;project.updatedAt=now;
 return note;
}
function findNote(project,id){return notesOf(project).find(item=>item.id===id)||null}
function updateNote(project,id,title,body){
 const note=findNote(project,id);
 if(!note)throw Error('This note could not be found.');
 const t=clipped(title,MAX_TITLE)||'Untitled Note';
 const raw=String(body??'');
 if(raw.length>MAX_BODY)throw Error('Notes can contain up to 16,000 characters.');
 if(note.title===t&&note.body===raw)return false;
 note.history=[...(note.history||[]),{title:note.title,body:note.body}].slice(-MAX_REVISIONS);
 note.title=t;note.body=raw;note.updatedAt=Date.now();project.updatedAt=note.updatedAt;
 return true;
}
function undoNote(project,id){
 const note=findNote(project,id);
 if(!note||!note.history?.length)throw Error('This note has no previous saved version.');
 const previous=note.history.at(-1);note.history=note.history.slice(0,-1);
 note.title=previous.title;note.body=previous.body;note.updatedAt=Date.now();project.updatedAt=note.updatedAt;
 return note;
}
function deleteNote(project,id){
 const notes=notesOf(project),index=notes.findIndex(item=>item.id===id);
 if(index<0)throw Error('This note could not be found.');
 notes.splice(index,1);project.activeNoteId=notes[0]?.id||null;project.updatedAt=Date.now();
}
function replyTitle(text){
 const line=String(text||'').split(/\r?\n/).map(x=>x.replace(/^[\s#*>\-]+/,'').trim()).find(Boolean)||'';
 return clipped(line,MAX_TITLE).replace(/[.!?:]+$/,'')||'Saved Reply';
}
function route(message,selectedFocus='general',hasWebsite=false,history){
 const text=String(message||'').toLowerCase().replace(/\s+/g,' ').trim();
 const artifactAction=root.OMNI_CONTEXT.websiteAction(text,hasWebsite,history);
 // Explicit construction language is required; saying "what is a website" is not a creation request.
 const newWebsite=artifactAction==='website-create',editWebsite=artifactAction==='website-edit';
 let focus='general',label='General conversation',action='chat';
 if(newWebsite||editWebsite){focus='create';label=newWebsite?'Website creation':'Website editing';action=newWebsite?'website-create':'website-edit'}
 else if(root.OMNI_CONTEXT?.programmingRequest(text)){focus='code';label='Coding assistance'}
 else if(/\b(explain|teach|understand|study|learn|lesson|quiz|homework|mathematics|physics|engineering|science)\b/i.test(text)){focus='learn';label='Learning and explanation'}
 else if(/\b(write|draft|essay|report|letter|proposal|document|story|article|summary)\b/i.test(text)){focus='write';label='Writing assistance'}
 else if(/\b(create|design|plan|brainstorm|ideas|project)\b/i.test(text)){focus='create';label='Creative planning'}
 const allowed=['general','learn','write','code','create'];
 const mode=allowed.includes(selectedFocus)&&selectedFocus!=='general'?selectedFocus:focus;
 return {label,focus:mode,action,includeWebsite:editWebsite,includeProject:!!hasWebsite&&root.OMNI_CONTEXT?.websiteReference(text),local:true};
}
function filename(title,extension='md'){const safe=String(title||'note').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,55)||'note';return safe+'.'+extension}
root.OMNI_WORKSPACE={MAX_NOTES,MAX_BODY,MAX_TITLE,createNote,findNote,notesOf,updateNote,undoNote,deleteNote,replyTitle,route,filename};
})(window);
