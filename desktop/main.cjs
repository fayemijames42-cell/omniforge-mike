/* OMNIFORGE Desktop — an offline-capable, locally served AI workspace.
   The Electron window has no Node integration. IPC is restricted to the local setup page.
   No model pulls, shell commands or internet access occur without an explicit setup action.
*/
const {app,BrowserWindow,Menu,dialog}=require('electron');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {once}=require('node:events');

const LOCAL_OLLAMA='http://127.0.0.1:11434';
const setupPage=path.join(__dirname,'setup.html');
const resources=app.isPackaged?process.resourcesPath:path.resolve(__dirname,'..');
const publicDir=path.join(resources,'public');
const runtimeFile=path.join(resources,'server','local-runtime.mjs');
const portableEngine=path.join(resources,'engine','ollama.exe');

let win=null;
let engine=null;
let localServer=null;
let localPort=null;
let installing=false;
let starting=false;
let shuttingDown=false;

function modelDirectory(){return path.join(app.getPath('userData'),'models')}
function configurationPath(){return path.join(app.getPath('userData'),'desktop.json')}
function engineEnvironment(){
 return {...process.env,OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_MODELS:modelDirectory()};
}
async function probe(){
 try{
  const reply=await fetch(LOCAL_OLLAMA+'/api/tags',{signal:AbortSignal.timeout(2000)});
  if(!reply.ok)return null;
  const data=await reply.json();
  return Array.isArray(data.models)?data.models:[];
 }catch{return null}
}
function findEngine(){
 const possible=[
  portableEngine,
  path.join(resources,'engine','ollama','ollama.exe'),
  path.join(process.env.LOCALAPPDATA||'', 'Programs','Ollama','ollama.exe'),
  path.join(process.env.ProgramFiles||'', 'Ollama','ollama.exe')
 ];
 return possible.find(file=>fs.existsSync(file)&&fs.statSync(file).isFile())||null;
}
async function ensureEngine(){
 const current=await probe();
 if(current!==null)return true; // A user-installed Ollama may already be serving locally.
 const executable=findEngine();
 if(!executable)return false;
 if(!engine){
  engine=spawn(executable,['serve'],{env:engineEnvironment(),windowsHide:true,stdio:'ignore'});
  engine.on('error',()=>{engine=null});
  engine.on('exit',()=>{engine=null});
 }
 for(let attempt=0;attempt<25;attempt++){
  await new Promise(resolve=>setTimeout(resolve,400));
  if(await probe()!==null)return true;
 }
 return false;
}
function sendProgress(value){
 if(win&&!win.isDestroyed())win.webContents.send('desktop:progress',String(value).slice(-280));
}
async function stageBundledModels(){
 const src=path.join(resources,'offline-models');
 if(!fs.existsSync(path.join(src,'blobs'))||!fs.existsSync(path.join(src,'manifests')))return;
 const destination=modelDirectory();
 if(fs.existsSync(path.join(destination,'manifests')))return;
 sendProgress('Importing the included offline model library...');
 await fsp.mkdir(destination,{recursive:true});
 await fsp.cp(src,destination,{recursive:true,force:false,errorOnExist:false,filter:source=>!source.endsWith('README.md')});
}
function setupOnly(event){
 if(!win||event.sender!==win.webContents||
    event.sender.getURL()!==pathToFileURL(setupPage).href){
  throw Error('This action is available only from the local setup screen.');
 }
}
async function deviceStatus(){
 const {TIERS,recommendTier}=await import('./model-policy.mjs');
 await fsp.mkdir(app.getPath('userData'),{recursive:true});
 let freeBytes=0;
 try{const disk=fs.statfsSync(app.getPath('userData'));freeBytes=disk.bavail*disk.bsize}catch{}
 await stageBundledModels();
 const available=await ensureEngine();
 const installed=available?await probe():[];
 const bytes=os.totalmem();
 let chosen;
 try{chosen=JSON.parse(await fsp.readFile(configurationPath(),'utf8')).model}catch{}
 const recommended=recommendTier(bytes);
 return {tiers:TIERS,ramGB:Math.round(bytes/1073741824*10)/10,freeGB:Math.round(freeBytes/1073741824*10)/10,
  platform:process.platform,arch:process.arch,recommended,
  selected:TIERS.some(t=>t.model===chosen)?chosen:TIERS.find(t=>t.id===recommended).model,
  engineAvailable:available,engineBundled:!!findEngine(),installed:(installed||[]).map(item=>item.name||item.model).filter(Boolean)};
}
async function downloadModel(model){
 const {getTier,canDownload}=await import('./model-policy.mjs');
 const tier=getTier(model);
 if(!tier)throw Error('Select a model from the approved list.');
 if(installing)throw Error('A model is already downloading.');
 if(!await ensureEngine())throw Error('The local AI engine is unavailable. Use a Windows package containing Ollama, or install Ollama from its official website.');
 const info=await deviceStatus();
 if(info.installed.some(v=>v===model||v.startsWith(model+'-')))return 'Model is already installed.';
 if(!canDownload(model,info.freeGB*1073741824))throw Error('Not enough free disk space for this model and its working files.');
 const executable=findEngine();
 if(!executable)throw Error('Ollama is running, but its command-line installer was not found on this computer.');
 installing=true;
 sendProgress('Downloading '+model+' from the model registry. Internet is needed once.');
 try{
  await new Promise((resolve,reject)=>{
   const child=spawn(executable,['pull',model],{env:engineEnvironment(),windowsHide:true,stdio:['ignore','pipe','pipe']});
   let trailing='';
   const onText=buffer=>{
    trailing+=buffer.toString();
    if(trailing.length>10000)trailing=trailing.slice(-5000);
    const lines=trailing.replace(/\r/g,'\n').split('\n');
    if(lines.length>1){
     const last=lines.filter(Boolean).at(-1);
     if(last)sendProgress(last);
     trailing=lines.at(-1)||'';
    }
   };
   child.stdout.on('data',onText);child.stderr.on('data',onText);
   child.on('error',reject);
   child.on('close',code=>code===0?resolve():reject(Error('Model download failed or was interrupted (exit '+code+').')));
  });
  const installed=await probe();
  if(!installed?.some(item=>(item.name||item.model)===model))throw Error('The model download ended, but Ollama did not report the model as installed.');
  sendProgress('Model installed. It can now answer offline.');
  return 'Model installed successfully.';
 }finally{installing=false}
}
async function openWorkspace(model){
 const {getTier}=await import('./model-policy.mjs');
 if(!getTier(model))throw Error('Select a listed AI model.');
 if(starting)throw Error('OMNIFORGE is already opening.');
 starting=true;
 try{
  await fsp.mkdir(app.getPath('userData'),{recursive:true});
  await fsp.writeFile(configurationPath(),JSON.stringify({model},null,2));
  if(localServer){
   await new Promise(resolve=>localServer.close(resolve));
   localServer=null;
  }
  const runtime=await import(pathToFileURL(runtimeFile).href);
  localServer=runtime.startLocalServer({port:4321,host:'127.0.0.1',publicDir,model});
  try{await once(localServer,'listening')}
  catch{localServer=null;throw Error('Port 4321 is in use. Close any other local OMNIFORGE server, then try again. No saved data has been touched.')}
  localPort=4321;
  await win.loadURL('http://127.0.0.1:'+localPort+'/');
  return true;
 }finally{starting=false}
}
async function createWindow(){
 win=new BrowserWindow({
  width:1200,height:780,minWidth:760,minHeight:550,show:false,
  backgroundColor:'#0c101b',webPreferences:{
   preload:path.join(__dirname,'preload.cjs'),
   nodeIntegration:false,contextIsolation:true,sandbox:true,
   webSecurity:true,webviewTag:false
  }
 });
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 win.webContents.on('will-navigate',(event,url)=>{
  const permitted=url===pathToFileURL(setupPage).href||
   (localPort!==null&&url.startsWith('http://127.0.0.1:'+localPort+'/'));
  if(!permitted)event.preventDefault();
 });
 win.once('ready-to-show',()=>win.show());
 const menu=Menu.buildFromTemplate([{label:'OMNIFORGE',submenu:[
  {label:'AI model settings',click:()=>win.loadFile(setupPage)},
  {type:'separator'},{role:'quit'}
 ]}]);
 Menu.setApplicationMenu(menu);
 await win.loadFile(setupPage);
}
if(!app.requestSingleInstanceLock()){app.quit();}
else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
 app.whenReady().then(async()=>{
  const {getTier}=await import('./model-policy.mjs');
  const guard=fn=>async(event,...args)=>{setupOnly(event);return fn(...args)};
  require('electron').ipcMain.handle('desktop:status',guard(deviceStatus));
  require('electron').ipcMain.handle('desktop:install-model',guard(downloadModel));
  require('electron').ipcMain.handle('desktop:start',guard(openWorkspace));
  await createWindow();
 }).catch(error=>{
  dialog.showErrorBox('OMNIFORGE could not start',String(error.message||error));
  app.quit();
 });
 app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
 app.on('before-quit',()=>{
  shuttingDown=true;
  if(engine){engine.kill();engine=null}
  if(localServer){localServer.close();localServer=null}
 });
}
