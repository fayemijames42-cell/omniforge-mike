import {MikeeCoordinator} from '../../server/coordinator.js';
import {PROFILES} from '../../server/catalog.js';
export async function withTestPool(env){
 if(env.MIKEE_POOL)return env;
 const runtime={...env},records=new Map();let reported=false;
 const storage={get:async key=>structuredClone(records.get(key)),put:async(key,value)=>{
  records.set(key,structuredClone(value));
  if(!reported&&(value.ledger?.cloudflare?.requests||value.ledger?.['cloudflare-image']?.requests)){reported=true;runtime.POOL_RESERVE?.();}
 }};
 const coordinator=new MikeeCoordinator({storage},runtime,{fetch:async()=>{throw Error('Unexpected external network in provider fixture')}});
 await coordinator.ready;
 for(const profile of PROFILES)coordinator.data.config[profile.id]={enabled:['cloudflare','cloudflare-image'].includes(profile.id),freeConfirmed:true};
 runtime.MIKEE_POOL={idFromName:x=>x,get:()=>({fetch:request=>coordinator.fetch(request)})};
 runtime.POOL_FIXTURE=coordinator;
 return runtime;
}
