import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,scryptSync} from 'node:crypto';
import {openStore} from '../app.mjs';
import {recoveryHandler} from '../recovery.mjs';
test('recovery uses expiring single-use tokens, hides unknown emails and revokes sessions',async()=>{
 const db=await openStore({directory:mkdtempSync(join(tmpdir(),'branche-recovery-'))});let now=1000,mail;
 await db.query('INSERT INTO branche_users VALUES(?,?,?,?,?,?,?,?)',['owner','owner@example.test','Owner','contractor','salt','secret','test',0]);
 await db.query('INSERT INTO branche_sessions VALUES(?,?,?)',['session','owner',999999]);
 const handle=recoveryHandler(db.query,{now:()=>now,publicUrl:'https://branche.example/',sendMail:async m=>{mail=m;}});
 const call=async(path,body)=>{let data;await handle({path:'/api/branche/'+path,req:{method:'POST',socket:{remoteAddress:'test'}},body,send:(status,b)=>{data={status,...b};},limit:async()=>{}});return data;};
 try{
 const known=await call('reset-request',{email:'owner@example.test'}),unknown=await call('reset-request',{email:'nobody@example.test'});assert.deepEqual(known,unknown);
 const token=mail.text.match(/#reset\/([\w-]+)/)[1];const rows=await db.query('SELECT * FROM branche_recovery');
 assert.equal(rows[0].token,createHash('sha256').update(token).digest('hex'));assert.ok(!JSON.stringify(rows).includes(token));
 assert.equal((await call('reset-password',{token,password:'new-password-1234'})).saved,true);
 assert.equal((await db.query('SELECT * FROM branche_sessions')).length,0);
 const user=(await db.query('SELECT * FROM branche_users'))[0];assert.equal(user.secret,scryptSync('new-password-1234',user.salt,32).toString('hex'));
 await assert.rejects(call('reset-password',{token,password:'other-password-1234'}),/already used/);
 await call('reset-request',{email:'owner@example.test'});const expired=mail.text.match(/#reset\/([\w-]+)/)[1];now+=1800001;
 await assert.rejects(call('reset-password',{token:expired,password:'other-password-1234'}),/expired/);
 }finally{await db.close();}
});
