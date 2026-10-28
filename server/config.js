import manifest from '../package.json' with {type:'json'};
import '../src/context.js';
export const VERSION=manifest.version;
export const IDENTITY=globalThis.OMNI_CONTEXT.IDENTITY;
