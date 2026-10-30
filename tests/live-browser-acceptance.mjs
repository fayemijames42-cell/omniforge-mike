// Opt-in production checks. Real free-provider calls; isolated synthetic browser data.
import assert from 'node:assert/strict';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
if(process.env.OMNIFORGE_LIVE_TEST!=='1'){console.log('Not run. Set OMNIFORGE_LIVE_TEST=1 to spend existing free allowances.');process.exit(0);}
const base='https://omniforge-mike.fayemijames42.workers.dev';
const destination=process.env.OMNIFORGE_BROWSER_OUTPUT||'docs/verification/michelle-browser-2026-10-29.json';
const report={date:new Date().toISOString(),base,environment:'Real production requests, no provider fixtures. Isolated browser profile; synthetic test conversation only.',checks:[]};
const save=async()=>{await mkdir(dirname(destination),{recursive:true});await writeFile(destination,JSON.stringify(report,null,2)+'\n');};
const playwright=await import(process.env.MIKEE_QA_PLAYWRIGHT||'playwright');
let launch={headless:true};
if(process.env.MIKEE_QA_CHROMIUM){const {default:chromium}=await import(process.env.MIKEE_QA_CHROMIUM);launch={...launch,executablePath:await chromium.executablePath(),args:chromium.args};}
const browser=await playwright.chromium.launch(launch),context=await browser.newContext({viewport:{width:360,height:780},acceptDownloads:true}),page=await context.newPage();
page.setDefaultTimeout(120000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
let chatRequests=0,lastCall=0;
page.on('request',request=>{if(new URL(request.url()).pathname==='/api/chat')chatRequests++;});
const project=()=>page.evaluate(()=>window.OMNI_TEST.getProject());
const go=async tab=>{await page.locator('#mobileMenuButton').click();await page.locator('[data-mobile="'+tab+'"]').click();};
async function send(message,{local=false}={}){
 if(!local){const wait=22000-(Date.now()-lastCall);if(wait>0)await new Promise(r=>setTimeout(r,wait));lastCall=Date.now();}
 await go('chat');const count=(await project())?.messages?.length||0;
 await page.locator('#prompt').fill(message);await page.locator('#sendBtn').click();
 await page.waitForFunction(n=>window.OMNI_TEST.getProject()?.messages?.length>=n+2&&window.OMNI_TEST.getProject().messages.at(-1).role==='assistant',count);
 await page.locator('#typingIndicator').waitFor({state:'hidden'});
 const current=await project(),reply=current.messages.at(-1);
 report.checks.push({message,engine:reply.engine,reply:reply.text,receipt:reply.receipt,passed:reply.engine!=='ERROR'});await save();
 assert.notEqual(reply.engine,'ERROR',reply.text);return current;
}
try{
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.OMNI_TEST&&!!window.MIKEE_POOL.catalog());
 report.build=await (await page.request.get(base+'/build-info.json')).json();
 assert.equal(report.build.sourceCommit,process.env.OMNIFORGE_EXPECTED_COMMIT,'Intended candidate must be deployed before model calls.');
 assert.equal(await page.locator('.pane-title .assistantName').textContent(),'MICHELLE');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 let current=await send('Create a compact one-page website for a fictional Sunrise Bakery. Include a title, a heading, and the text Fresh bread daily. Use inline CSS, no external resources, no invented contact details. Keep the HTML under 1800 characters.');
 assert.match(current.website.rawHtml,/Sunrise Bakery/);assert.match(current.website.rawHtml,/Fresh bread daily/i);
 current=await send('Make the website pink. Set the body background to #ffc0cb and preserve Sunrise Bakery and Fresh bread daily.');
 assert.equal(current.messages.at(-2).route,'Website editing');assert.match(current.website.rawHtml,/Sunrise Bakery/);assert.match(current.website.rawHtml,/Fresh bread daily/i);
 await go('preview');await page.frameLocator('#siteFrame').locator('body').waitFor();
 report.previewBackground=await page.frameLocator('#siteFrame').locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.equal(report.previewBackground,'rgb(255, 192, 203)');
 const website=current.website.rawHtml;
 current=await send('How are you?');assert.equal(current.website.rawHtml,website);assert.doesNotMatch(current.messages.at(-1).text,/<html|<!doctype|<svg/i);
 const beforeRecall=chatRequests;
 current=await send('What website did we just create?',{local:true});assert.match(current.messages.at(-1).text,/Sunrise Bakery/);assert.equal(chatRequests,beforeRecall);assert.equal(current.messages.at(-1).engine,'LOCAL PROJECT CONTEXT · NO AI');
 await send('Check whether the website is working.',{local:true});assert.equal(chatRequests,beforeRecall);
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.OMNI_TEST?.getProject());assert.equal((await project()).website.rawHtml,website);
 current=await send('Generate a realistic image of a flying cow above green farmland under a blue sky.');const image=current.messages.at(-1);assert.ok(image.imageId);assert.equal(image.receipt.provider,'cloudflare-image');
 const img=page.locator('.real-image-artifact img').last();await img.waitFor();await img.evaluate(el=>el.decode());
 report.image=await img.evaluate(el=>({width:el.naturalWidth,height:el.naturalHeight}));
 const blob=await page.evaluate(async id=>{const b=await window.OMNI.getBlob(id);return {bytes:b.size,mime:b.type};},image.imageId);Object.assign(report.image,blob,{provider:image.receipt.provider,model:image.receipt.model});
 const downloaded=page.waitForEvent('download');await page.locator('[data-download-image="'+image.id+'"]').click();const file=await downloaded;
 const bytes=await readFile(await file.path());assert.equal(bytes.length,blob.bytes);report.image.downloadSHA256=createHash('sha256').update(bytes).digest('hex');
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.OMNI_TEST?.getProject());
 await go('chat');const restored=page.locator('.real-image-artifact img').last();await restored.waitFor();await restored.evaluate(el=>el.decode());
 assert.equal((await project()).website.rawHtml,website);await go('photos');assert.ok(await page.locator('.asset-tile').count()>0);
 report.reloadPreservedWebsiteAndImage=true;report.noPageErrors=errors.length===0;assert.deepEqual(errors,[]);
 report.finalBuild=await (await page.request.get(base+'/build-info.json')).json();assert.equal(report.finalBuild.sourceCommit,report.build.sourceCommit,'Deployment changed during acceptance.');
 report.passed=true;
}catch(error){report.passed=false;report.error=String(error.stack||error);process.exitCode=1;}
finally{report.chatRequests=chatRequests;report.pageErrors=errors;await save();await browser.close();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,error:report.error,image:report.image}));}
