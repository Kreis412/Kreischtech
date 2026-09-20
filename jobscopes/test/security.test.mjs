import { request } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../workspace.mjs';
import { decryptBackup, restoreBackup, guardLocalRequest } from '../security.mjs';

test('local boundary and encrypted backup restore preserve real record shapes', async t=>{
  const dir=mkdtempSync(join(tmpdir(),'jobscopes-security-'));
  const server=createApp({dataDir:join(dir,'source')});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`, password='test-only long passphrase 2026';
  t.after(async()=>{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
  const post=(path,b,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(b)});
  let project, photo;
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  await t.test('normal access works; rebinding, proxy and foreign origins fail',async()=>{
    assert.equal((await fetch(base+'/api/projects')).status,200);
    const hostileHost=await new Promise((resolve,reject)=>{const req=request(base+'/api/projects',{headers:{Host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(hostileHost,403);
    for(const headers of [{'X-Forwarded-For':'127.0.0.1'},{Origin:'https://attacker.example'}]) assert.equal((await fetch(base+'/api/projects',{headers})).status,403);
    assert.throws(()=>guardLocalRequest({socket:{remoteAddress:'192.168.1.1',localPort:3100},headers:{host:'localhost:3100'}}));
    assert.equal((await fetch(base+'/security.mjs')).status,404);
    assert.equal((await fetch(base+'/public/security.js')).status,404);
    const r=await post('/api/projects',{name:'Private backup project',type:'Basement',status:'Planning',notes:'Private scope',client:'Test customer'});assert.equal(r.status,201);project=await r.json();
    photo=await (await fetch(base+`/api/projects/${project.id}/photos?name=test.png`,{method:'POST',body:png})).json();
    assert.equal((await post('/api/company/entries',{entry_date:'2026-01-01',type:'Payment received',category:'Other',amount:'123.45',description:'Backup ledger test',status:'Recorded',project_id:project.id})).status,201);
  });
  let encrypted;
  await t.test('export validates passphrases, uses authenticated encryption and includes WAL data',async()=>{
    assert.equal((await post('/api/security/backup',{password:'short'})).status,400);
    const r=await post('/api/security/backup',{password});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/octet-stream');
    encrypted=Buffer.from(await r.arrayBuffer());assert.equal(encrypted.includes(Buffer.from('Private backup project')),false);
    const again=Buffer.from(await (await post('/api/security/backup',{password})).arrayBuffer());assert.notDeepEqual(encrypted,again);
    assert.ok((await decryptBackup(encrypted,password)).subarray(0,16).equals(Buffer.from('SQLite format 3\0')));
    await assert.rejects(decryptBackup(encrypted,'incorrect long password'));
    const tampered=Buffer.from(encrypted);tampered[tampered.length-1]^=1;await assert.rejects(decryptBackup(tampered,password));
    await assert.rejects(decryptBackup(encrypted.subarray(0,30),password));
  });
  await t.test('restore verifies database and refuses to overwrite existing work',async()=>{
    const file=join(dir,'backup.jobscopes');writeFileSync(file,encrypted);
    const target=join(dir,'restored');await restoreBackup(file,target,password);
    const db=new DatabaseSync(join(target,'contractoros.sqlite'),{readOnly:true});
    try {assert.equal(db.prepare('SELECT name FROM projects WHERE id=?').get(project.id).name,'Private backup project');assert.deepEqual(Buffer.from(db.prepare('SELECT content FROM photos WHERE id=?').get(photo.id).content),png);assert.equal(db.prepare('SELECT amount_cents FROM cash_entries').get().amount_cents,12345);} finally {db.close();}
    const original=readFileSync(join(target,'contractoros.sqlite'));
    await assert.rejects(restoreBackup(file,target,password));assert.deepEqual(readFileSync(join(target,'contractoros.sqlite')),original);
    const badTarget=join(dir,'wrong-password');await assert.rejects(restoreBackup(file,badTarget,'incorrect long password'));assert.equal(existsSync(badTarget),false);
  });
});
