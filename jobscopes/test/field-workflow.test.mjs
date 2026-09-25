import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createProduct} from '../server.mjs';

test('photo retry and discovery pricing stay inside the original workspace',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'field-workflow-')),server=createProduct({dataDir:dir});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;let cookie;
 async function req(path,body,method=body?'POST':'GET',status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie||''},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b;}
 await req('/api/account/register',{email:'field@example.test',password:'field test password 2026',name:'Field tester',company:'Test company'},'POST',201);
 const session=await req('/api/account/session');
 const a=await req('/api/projects',{name:'First project',type:'Deck',status:'Discovery'},'POST',201),b=await req('/api/projects',{name:'Other project',type:'Deck',status:'Discovery'},'POST',201);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 const headers={Cookie:cookie,'X-Upload-Id':randomUUID(),'X-Upload-Owner':'field%40example.test','X-Upload-Company':session.company.id};
 async function upload(pid=a.id,extra={}){return fetch(base+`/api/projects/${pid}/photos?name=test.png`,{method:'POST',headers:{...headers,...extra},body:png});}
 const one=await upload();assert.equal(one.status,201);const photo=await one.json();
 const retry=await upload();assert.equal(retry.status,200);assert.equal((await retry.json()).id,photo.id);
 assert.equal((await upload(b.id)).status,409);assert.equal((await upload(a.id,{'X-Upload-Company':'wrong'})).status,409);
 assert.equal((await req(`/api/projects/${a.id}`)).photos.length,1);
 const finding={title:'Drain route',observation:'Route needs checking',status:'Needs review'};
 const op=await req(`/api/projects/${a.id}/operations/findings`,finding,'POST',201);
 const f=op;
 await req(`/api/projects/${a.id}/estimate/sources/${f.id}`,{kind:'finding',reviewed:true,revision:f.revision},'POST',400);
 const confirmed=await req(`/api/projects/${a.id}/operations/findings/${f.id}`,{...f,status:'Confirmed',review_notes:'Measured on site'},'PUT');
 const cf=confirmed,source={kind:'finding',reviewed:true,revision:cf.revision};
 const linked=await req(`/api/projects/${a.id}/estimate/sources/${f.id}`,source);
 assert.equal(linked.items.length,1);assert.equal(linked.items[0].status,'Suggested');assert.equal(linked.items[0].unit_cents,null);assert.equal(linked.totals.total_cents,0);
 assert.equal((await req(`/api/projects/${a.id}/estimate/sources/${f.id}`,source)).items.length,1);
 await req(`/api/projects/${b.id}/estimate/sources/${f.id}`,source,'POST',404);
 await req(`/api/projects/${a.id}/operations/findings/${f.id}`,{...cf,observation:'Route changed after measurement'},'PUT');
 const changed=await req(`/api/projects/${a.id}/estimate`);assert.ok(changed.flags.some(f=>f.message.startsWith('Source changed:')));
 await req(`/api/projects/${a.id}/estimate/sources/${f.id}`,source,'POST',409);
 const latest=changed.sources[0];const reviewed=await req(`/api/projects/${a.id}/estimate/sources/${f.id}`,{...source,revision:latest.revision,acknowledge:true});assert.ok(!reviewed.flags.some(f=>f.message.startsWith('Source changed:')));
 const item=reviewed.items[0];await req(`/api/projects/${a.id}/estimate/items/${item.id}`,{...item,status:'Included',quantity:1,unit_price:'1000',price_source:'Test quote'},'PUT');
 await req(`/api/projects/${a.id}/estimate/pricing`,{markup:29.9,revision:0},'PUT');
 const report=await req('/api/company?year=2026&quarter=ytd');assert.equal(report.profitability[0].profit_cents,29900);assert.equal(report.profitability[0].return_percent,29.9);
});
