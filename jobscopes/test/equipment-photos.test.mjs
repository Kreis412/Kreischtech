import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {equipmentStore} from '../equipment.mjs';
import {equipmentPhotos} from '../equipment-photos.mjs';
import {normalizeCurrency} from '../public/currency.js';

test('dollar entry accepts familiar US formats without changing cents or hiding invalid input',()=>{
 for(const [input,expected] of [['25','25.00'],['25.50','25.50'],['$1,250.00','1250.00'],['.75','0.75'],['25.','25.00'],['',''],['0','0.00']])assert.equal(normalizeCurrency(input),expected);
 for(const input of ['12,50','1.234','-5','abc','1e3','1,23,456'])assert.throws(()=>normalizeCurrency(input));
});

test('asset photos persist, enforce roles and asset ownership, require consent, and reuse saved analysis',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'asset-photos-'));let db;let calls=0;
 const open=()=>{db=new DatabaseSync(join(dir,'test.sqlite'));db.exec('PRAGMA foreign_keys=ON;');equipmentStore(db);return equipmentPhotos(db,{body:async req=>req.bytes,imageType:bytes=>{if(bytes.toString()!=='photo')throw Object.assign(Error('Not an image'),{status:415});return 'image/jpeg';},cloud:{status:()=>({remaining_attempts:2}),analyze:async()=>{calls++;return {summary:'Visible wear',findings:[{title:'Wear',observation:'Worn surface',uncertainty:'Depth unknown',next_step:'Inspect surface'}]};}}});};
 let store=open();
 const call=async(method,path,b={},role='Owner',bytes=Buffer.from('photo'))=>{let result;await store.handle({method,bytes,jobscopesActor:{role,name:'Tester'}},new URL('http://localhost/api/equipment/'+path),async()=>b,(status,value)=>result={status,value});return result;};
 try{
  for(const id of ['one','two'])db.prepare('INSERT INTO equipment VALUES(?,?,?,1)').run(id,id,'{}');
  await assert.rejects(call('POST','one/photos',{},'Viewer'),e=>e.status===403);
  await assert.rejects(call('POST','one/photos',{},'Owner',Buffer.from('bad')),e=>e.status===415);
  const {value:{id}}=await call('POST','one/photos');
  assert.equal((await call('GET','one/photos/'+id,{},'Viewer')).value.toString(),'photo');
  await assert.rejects(call('GET','two/photos/'+id),e=>e.status===404);
  await assert.rejects(call('POST','one/photos/'+id+'/analysis',{context:''}),e=>e.status===400);
  assert.equal(calls,0);
  await call('POST','one/photos/'+id+'/analysis',{context:'Check wheel',cloud_consent:true});
  assert.equal((await call('POST','one/photos/'+id+'/analysis',{})).value.reused,true);assert.equal(calls,1);
  db.close();store=open();
  const saved=(await call('GET','one/photos')).value.photos[0];assert.equal(saved.analysis.context,'Check wheel');assert.equal(saved.analysis.findings.length,1);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('scan imports isolate asset history, require consent and charge once after save',async()=>{
 const db=new DatabaseSync(':memory:');equipmentStore(db);for(const id of ['truck','other'])db.prepare('INSERT INTO equipment VALUES(?,?,?,1)').run(id,id,'{}');
 let calls=0,charged=0,failNext=true;
 const store=equipmentPhotos(db,{scan:true,body:async r=>r.bytes,imageType:()=> 'image/png',cloud:{status:()=>({}),runSaved:async(kind,key,op)=>{assert.equal(kind,'analysis');const result=await op();charged++;return result;},analyze:async(image,context,prompt)=>{calls++;assert.match(prompt,/OBD-II/);if(failNext){failNext=false;throw Error('provider unavailable');}if(image===null)assert.match(context,/P0300/);return {summary:'Check misfire causes',findings:[]};}}});
 const call=async(method,path,b={},role='Owner',mime='text/plain',bytes=Buffer.from('P0300'))=>{let result;await store.handle({method,headers:{'content-type':mime},bytes,jobscopesActor:{role,name:'Tester'}},new URL('http://local/api/equipment/'+path),async()=>b,(status,value)=>result={status,value});return result;};
 try{
  await assert.rejects(call('POST','truck/scans',{},'Viewer'),e=>e.status===403);
  await assert.rejects(call('POST','truck/scans',{},'Owner','text/plain',Buffer.from(' ')),e=>e.status===400);
  const {value:{id}}=await call('POST','truck/scans');
  await assert.rejects(call('GET','other/scans/'+id),e=>e.status===404);
  await assert.rejects(call('POST','truck/scans/'+id+'/analysis',{context:''}),e=>e.status===400);assert.equal(calls,0);
  const consent={context:'2015 Silverado, rough idle',cloud_consent:true};
  await assert.rejects(call('POST','truck/scans/'+id+'/analysis',consent));assert.equal(charged,0);assert.equal((await call('GET','truck/scans')).value.photos[0].analysis,null);
  await call('POST','truck/scans/'+id+'/analysis',consent);await call('POST','truck/scans/'+id+'/analysis',consent);assert.equal(charged,1);assert.equal(calls,2);
  const screenshot=await call('POST','truck/scans',{},'Owner','image/png',Buffer.from('screenshot'));await call('POST','truck/scans/'+screenshot.value.id+'/analysis',consent);assert.equal(charged,2);
  assert.equal(db.prepare('SELECT count(*) n FROM equipment_scans').get().n,2);
 }finally{db.close();}
});

test('scan bundles keep ordered frames private, scoped and charge once per bundle',async()=>{
 const db=new DatabaseSync(':memory:');equipmentStore(db);for(const id of ['truck','other'])db.prepare('INSERT INTO equipment VALUES(?,?,?,1)').run(id,id,'{}');let calls=0;
 const store=equipmentPhotos(db,{scan:true,body:async r=>r.bytes,imageType:bytes=>{if(bytes.toString()!=='image')throw Object.assign(Error('bad image'),{status:415});return 'image/png';},cloud:{status:()=>({}),analyze:async(images,context)=>{calls++;assert.equal(images.length,2);assert.match(context,/Video 1/);return {summary:'Sampled data',findings:[]};}}});
 const mime='application/vnd.contractorsight.scan+json',bundle={source:'video',frames:[{data:Buffer.from('image').toString('base64'),label:'Video 0 seconds'},{data:Buffer.from('image').toString('base64'),label:'Video 1 seconds'}]};
 async function call(method,path,b={},upload=bundle){let result;await store.handle({method,headers:{'content-type':mime},bytes:Buffer.from(JSON.stringify(upload)),jobscopesActor:{role:'Owner',name:'Test'}},new URL('http://local/api/equipment/'+path),async()=>b,(status,value)=>result={status,value});return result;}
 try{
  await assert.rejects(call('POST','truck/scans',{}, {...bundle,frames:Array(7).fill(bundle.frames[0])}),e=>e.status===400);
  const {value:{id}}=await call('POST','truck/scans');const list=(await call('GET','truck/scans')).value.photos[0];assert.equal(list.frames.length,2);assert.equal(list.frames[0].data,undefined);assert.equal(list.bundle_content,undefined);
  assert.equal((await call('GET','truck/scans/'+id+'?frame=1')).value.toString(),'image');await assert.rejects(call('GET','other/scans/'+id+'?frame=0'),e=>e.status===404);await assert.rejects(call('GET','truck/scans/'+id+'?frame=9'),e=>e.status===400);
  await call('POST','truck/scans/'+id+'/analysis',{context:'Silverado',cloud_consent:true});await call('POST','truck/scans/'+id+'/analysis',{});assert.equal(calls,1);
 }finally{db.close();}
});
