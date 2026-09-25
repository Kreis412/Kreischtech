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
