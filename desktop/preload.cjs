const {contextBridge,ipcRenderer}=require('electron');
if(location.protocol==='file:'){
 contextBridge.exposeInMainWorld('omniforgeDesktop',Object.freeze({
  status:()=>ipcRenderer.invoke('desktop:status'),
  install:model=>ipcRenderer.invoke('desktop:install-model',model),
  start:model=>ipcRenderer.invoke('desktop:start',model),
  onProgress:callback=>{
   if(typeof callback!=='function')return ()=>{};
   const listener=(_event,value)=>callback(String(value).slice(0,300));
   ipcRenderer.on('desktop:progress',listener);
   return ()=>ipcRenderer.removeListener('desktop:progress',listener);
  }
 }));
}
