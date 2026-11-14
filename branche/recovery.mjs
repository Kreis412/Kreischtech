import {randomBytes,createHash,scryptSync} from 'node:crypto';
import nodemailer from 'nodemailer';
const hash=v=>createHash('sha256').update(v).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export const recoverySchema='CREATE TABLE IF NOT EXISTS branche_recovery(uid TEXT PRIMARY KEY,token TEXT UNIQUE NOT NULL,expires BIGINT NOT NULL)';
export function recoveryHandler(q,{now=()=>Date.now(),sendMail,publicUrl=process.env.BRANCHE_PUBLIC_URL}={}){
 const enabled=Boolean(sendMail||(process.env.BRANCHE_GMAIL_APP_PASSWORD&&publicUrl));
 const mail=sendMail|| (async message=>{const transport=nodemailer.createTransport({service:'gmail',auth:{user:'kreischtech@gmail.com',pass:process.env.BRANCHE_GMAIL_APP_PASSWORD},connectionTimeout:10000,socketTimeout:15000});await transport.sendMail({from:'Branche by KreischTech <kreischtech@gmail.com>',...message});});
 return async({path,req,body,send,limit})=>{
 if(!['/api/branche/reset-request','/api/branche/reset-password'].includes(path))return false;
 if(req.method!=='POST')fail(405,'Method not allowed.');
 await limit('recovery:'+(req.socket?.remoteAddress||'shared'),10,3600000);
 if(path.endsWith('/reset-request')){
 if(!enabled)fail(503,'Email recovery is being connected. Contact kreischtech@gmail.com for help. Never send your password.');
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email address.');
 await limit('recovery-email:'+hash(email),3,3600000);
 const user=(await q('SELECT id FROM branche_users WHERE email=?',[email]))[0];
 if(user){const token=randomBytes(32).toString('base64url');await q('INSERT INTO branche_recovery VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET token=excluded.token,expires=excluded.expires',[user.id,hash(token),now()+1800000]);
 const link=new URL(publicUrl);if(link.protocol!=='https:')fail(503,'Recovery is not configured.');link.hash='reset/'+token;
 try{await mail({to:email,subject:'Reset your Branche password',text:'Someone requested a password reset for your Branche account. Open this link within 30 minutes: '+link.href+'\n\nIf you did not request this, ignore the email. Your password has not changed. Support: kreischtech@gmail.com'});}catch{await q('DELETE FROM branche_recovery WHERE uid=?',[user.id]);}
 }
 send(200,{message:'If an account matches, a reset link will be sent. Check spam too. If it does not arrive, contact kreischtech@gmail.com.'});return true;
 }
 if(typeof body.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.token))fail(400,'This reset link is invalid or expired.');
 if(typeof body.password==='string')body.password=body.password.trim();
 if(typeof body.password!=='string'||body.password.length<12||body.password.length>200)fail(400,'Use a password between 12 and 200 characters.');
 const row=(await q('DELETE FROM branche_recovery WHERE token=? AND expires>? RETURNING uid',[hash(body.token),now()]))[0];if(!row)fail(400,'This reset link is invalid, expired or already used.');
 const salt=randomBytes(16).toString('hex'),secret=scryptSync(body.password,salt,32).toString('hex');
 await q('UPDATE branche_users SET salt=?,secret=? WHERE id=?',[salt,secret,row.uid]);await q('DELETE FROM branche_sessions WHERE uid=?',[row.uid]);send(200,{saved:true});return true;
 };
}
