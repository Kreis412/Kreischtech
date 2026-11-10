import sharp from 'sharp';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const share=new URL(process.env.BRANCHE_TEST_SHARE),base=share.origin;
let url=share.href,protection='';
for(let i=0;i<5;i++){
 const r=await fetch(url,{redirect:'manual',headers:{cookie:protection}});
 const cookies=r.headers.getSetCookie().map(v=>v.split(';')[0]);
 protection=[protection,...cookies].filter(Boolean).join('; ');
 if(!r.headers.get('location'))break;
 url=new URL(r.headers.get('location'),url).href;
 assert.equal(new URL(url).origin,base,'Unexpected authentication redirect');
}
const call=async(path,body,cookie='',method=body?'POST':'GET')=>{
 const r=await fetch(base+'/api/branche/'+path,{method,redirect:'manual',headers:{cookie:[protection,cookie].filter(Boolean).join('; '),origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{throw Error('Non-JSON response: '+r.status);}
 return {status:r.status,data,cookie:r.headers.getSetCookie().find(x=>x.startsWith('branche_session='))?.split(';')[0]};
};
const session=await call('session');assert.equal(session.status,200);
const run=randomUUID(),password=randomUUID()+randomUUID();
const signup=async(role)=>{const r=await call('register',{name:'QA test '+role,email:role+'-'+run+'@example.test',password,role,terms:session.data.termsVersion});assert.equal(r.status,200,JSON.stringify(r.data));return r;};
const c=await signup('customer'),p=await signup('contractor');
const profile={name:'QA test — not a real business',contact:'QA operator',category:'Carpentry',city:'Mentor',region:'Ohio',description:'Automated private test. Not a real business.',services:'Test only',published:true};
let job,mediaId;
try{
 assert.equal((await call('profile',profile,p.cookie,'PUT')).status,200);
 const image='data:image/png;base64,'+(await sharp({create:{width:40,height:40,channels:3,background:'#225c44'}}).png().toBuffer()).toString('base64');
 const upload=await call('media-upload',{image},p.cookie);assert.equal(upload.status,201,JSON.stringify(upload.data));mediaId=upload.data.id;
 const config={kind:'profile',target:p.data.user.id,logo:mediaId,photos:[mediaId],link:'https://example.com',video:'https://youtu.be/test'};
 assert.equal((await call('media-config',config,c.cookie,'PUT')).status,404);
 assert.equal((await call('media-config',config,p.cookie,'PUT')).status,200);
 const pic=await fetch(base+'/api/branche/media-file?id='+mediaId,{headers:{cookie:protection}});
 assert.equal(pic.status,200);assert.equal((await sharp(Buffer.from(await pic.arrayBuffer())).metadata()).format,'webp');
 console.log('PASS hosted image upload, logo/gallery linking, WebP download and ownership');
 job=await call('jobs',{title:'QA test — not a real job',category:'Carpentry',city:'Mentor',description:'Automated private test only.',timing:'Test only'},c.cookie);assert.equal(job.status,201,JSON.stringify(job.data));
 const t=await call('threads',{job:job.data.id,message:'QA test inquiry'},p.cookie);assert.equal(t.status,201,JSON.stringify(t.data));
 assert.equal((await call('messages',{thread:t.data.id,message:'QA test reply'},c.cookie)).status,201);
 assert.equal((await call('messages?thread='+t.data.id,null,p.cookie)).data.messages.length,2);
 assert.equal((await call('messages?thread='+t.data.id)).status,401);
 assert.equal((await call('block',{target:p.data.user.id},c.cookie)).status,200);
 assert.equal((await call('messages',{thread:t.data.id,message:'Should be blocked'},p.cookie)).status,403);
 console.log('PASS hosted signup, profile, job, private conversation, reply, authentication and blocking');
}finally{
 if(job?.data.id)assert.equal((await call('job-state',{id:job.data.id,state:'closed'},c.cookie,'PUT')).status,200);
 assert.equal((await call('profile',{...profile,published:false},p.cookie,'PUT')).status,200);
 if(mediaId){await call('media-config',{kind:'profile',target:p.data.user.id,logo:'',photos:[],link:'',video:''},p.cookie,'PUT');assert.equal((await call('media-upload',{id:mediaId},p.cookie,'DELETE')).status,200);}
 for(const a of [c,p])assert.equal((await call('account-delete',{password},a.cookie)).status,200);
 console.log('QA job closed, QA media removed and both QA accounts deleted.');
}
