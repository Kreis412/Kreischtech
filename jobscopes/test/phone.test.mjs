import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import vm from 'node:vm';
import sharp from 'sharp';
import {createProduct} from '../server.mjs';
test('phone installation resources are public while company records remain protected',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'contractorsight-phone-')),server=createProduct({dataDir:dir});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(r=>{server.close(r);server.closeIdleConnections();});rmSync(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(base+'/manifest.webmanifest');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/manifest\+json/);const manifest=await response.json();assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');
 for(const icon of manifest.icons){const r=await fetch(base+icon.src);assert.equal(r.status,200);const meta=await sharp(Buffer.from(await r.arrayBuffer())).metadata();assert.equal(`${meta.width}x${meta.height}`,icon.sizes);}
 for(const path of ['/phone.js','/sw.js','/offline.html'])assert.equal((await fetch(base+path)).status,200);
 for(const path of ['/api/projects','/api/photos/private','/api/company'])assert.equal((await fetch(base+path)).status,401);
});
test('offline fallback intercepts only app navigation and never API, photos or writes',async()=>{
 const handlers={},matched=[];let online=false;
 vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{URL,self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn},fetch:async()=>{if(!online)throw new Error('offline');return 'fresh';},caches:{open:async()=>({match:async key=>{matched.push(key);return 'offline page';}})}});
 function event(path,method='GET',mode='navigate'){let response;handlers.fetch({request:{url:'https://example.test'+path,method,mode},respondWith:p=>response=p});return response;}
 assert.equal(event('/api/photos/private'),undefined);assert.equal(event('/api/projects','POST'),undefined);assert.equal(event('/app.js','GET','cors'),undefined);
 assert.equal(await event('/'),'offline page');assert.deepEqual(matched,['/offline.html']);online=true;assert.equal(await event('/'),'fresh');
});
