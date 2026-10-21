import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {googlePlayClient} from '../google-play-client.mjs';
test('Google client signs server OAuth assertions, fixes package and origin, caches access and hides errors',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const calls=[];let fail=false;
 const client=googlePlayClient({private_key:privateKey.export({type:'pkcs8',format:'pem'}),client_email:'billing@test.iam.gserviceaccount.com'},{request:async(url,options)=>{
  calls.push(url);assert.equal(options.redirect,'error');assert.ok(options.signal);
  if(url==='https://oauth2.googleapis.com/token'){
   const jwt=new URLSearchParams(options.body).get('assertion').split('.');assert.ok(verify('RSA-SHA256',Buffer.from(jwt.slice(0,2).join('.')),publicKey,Buffer.from(jwt[2],'base64url')));
   const body=JSON.parse(Buffer.from(jwt[1],'base64url'));assert.equal(body.scope,'https://www.googleapis.com/auth/androidpublisher');
   return {ok:true,json:async()=>({access_token:'private-access',expires_in:3600})};
  }
  assert.equal(options.headers.Authorization,'Bearer private-access');if(fail)throw Error('secret-token-network-error');
  if(url.includes('subscriptionsv2'))assert.equal(options.method,'GET');
  if(url.endsWith(':acknowledge')){assert.equal(options.method,'POST');assert.equal(options.body,'{}');}
  return {ok:true,json:async()=>({purchaseState:0})};
 }});
 await client.get('analysis_5','token/with?characters');await client.consume('analysis_5','token/with?characters');assert.equal(calls.length,3);
 assert.match(calls[1],/applications\/com.kreischtech.contractorsight\/purchases\/products\/analysis_5\/tokens\/token%2Fwith%3Fcharacters$/);
 assert.ok(calls[2].endsWith(':consume'));
 await client.subscription('token/with?characters');await client.acknowledge('contractorsight_pro','token/with?characters');
 assert.match(calls[3],/purchases\/subscriptionsv2\/tokens\/token%2Fwith%3Fcharacters$/);
 assert.match(calls[4],/purchases\/subscriptions\/contractorsight_pro\/tokens\/token%2Fwith%3Fcharacters:acknowledge$/);
 fail=true;await assert.rejects(client.get('analysis_5','private-token'),e=>e.status===503&&!e.message.includes('secret-token'));
});
