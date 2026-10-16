import {createPrivateKey,sign} from 'node:crypto';
export const PLAY_PACKAGE='com.kreischtech.contractorsight';
const fail=()=>{throw Object.assign(new Error('Google Play could not verify this purchase. Please try Check purchases again.'),{status:503});};
// Credentials stay on the server. All request destinations and the package are fixed.
export function googlePlayClient(credentials,{request=fetch,now=()=>Date.now()}={}){
 const key=createPrivateKey(credentials.private_key),email=credentials.client_email;
 if(typeof email!=='string'||!email.endsWith('.gserviceaccount.com'))throw Error('Invalid Google service account.');
 let access,expires=0;
 async function call(product,token,consume=false){
  try{
   if(!access||now()>=expires){
    const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
    const payload=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:Math.floor(now()/1000),exp:Math.floor(now()/1000)+3600});
    const assertion=payload+'.'+sign('RSA-SHA256',Buffer.from(payload),key).toString('base64url');
    const response=await request('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString()});
    if(!response.ok)fail();const body=await response.json();if(!body.access_token)fail();access=body.access_token;expires=now()+Math.min(Number(body.expires_in)||3600,3600)*1000-60000;
   }
   const url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE}/purchases/products/${encodeURIComponent(product)}/tokens/${encodeURIComponent(token)}${consume?':consume':''}`;
   const response=await request(url,{method:consume?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+access}});
   if(!response.ok){if(response.status===401)expires=0;fail();}
   return consume?null:await response.json();
  }catch{fail();}
 }
 return {get:(product,token)=>call(product,token),consume:(product,token)=>call(product,token,true)};
}
