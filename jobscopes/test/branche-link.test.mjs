import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {brancheLink} from '../branche-link.mjs';
test('owner connection codes expire, cannot replay and do not expose subscription data',()=>{
 let time=1000,owner=true;
 const link=brancheLink(mkdtempSync(join(tmpdir(),'branche-link-')),{now:()=>time,member:()=>owner});
 const session={role:'Owner',user_id:'owner',company_id:'business',company_name:'Test Business'};
 try{
  assert.throws(()=>link.issue({...session,role:'Manager'}),e=>e.status===403);
  const first=link.issue(session);const second=link.issue(session);
  assert.throws(()=>link.redeem(first.code,'test'),e=>e.status===400);
  assert.deepEqual(link.redeem(second.code,'test'),{user_id:'owner',company_id:'business',company_name:'Test Business'});
  assert.throws(()=>link.redeem(second.code,'test'),e=>e.status===400);
  const third=link.issue(session);time+=600001;
  assert.throws(()=>link.redeem(third.code,'test'),e=>e.status===400);
  const fourth=link.issue(session);owner=false;
  assert.throws(()=>link.redeem(fourth.code,'test'),e=>e.status===400);
 }finally{link.close();}
});
