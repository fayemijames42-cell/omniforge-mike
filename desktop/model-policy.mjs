// Fixed allowlist: no arbitrary model names are accepted by the desktop IPC.
export const TIERS=Object.freeze([
  Object.freeze({id:'lite',name:'Lite',model:'qwen3.5:0.8b',ramGB:4,downloadGB:1.3,note:'Small model for older laptops; limited reasoning.'}),
  Object.freeze({id:'standard',name:'Standard',model:'qwen3.5:4b',ramGB:8,downloadGB:4.0,note:'Balanced everyday writing and assistance.'}),
  Object.freeze({id:'pro',name:'Pro',model:'qwen3.5:9b',ramGB:16,downloadGB:7.6,note:'Stronger responses; more memory and CPU time.'}),
  Object.freeze({id:'studio',name:'Studio',model:'qwen3.5:27b',ramGB:32,downloadGB:20,note:'Large model; fast GPU strongly recommended.'})
]);
export function recommendTier(totalBytes) {
  const gb=Math.max(0,Number(totalBytes)||0)/1073741824;
  return [...TIERS].reverse().find(tier=>gb>=tier.ramGB)?.id||'lite';
}
export function getTier(model) {
  return TIERS.find(tier=>tier.model===model)||null;
}
export function canDownload(model,freeBytes) {
  const tier=getTier(model);
  return !!tier&&Number(freeBytes)>=(tier.downloadGB+1)*1073741824;
}
