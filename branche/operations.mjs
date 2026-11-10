import {scryptSync,timingSafeEqual} from 'node:crypto';
import {del} from '@vercel/blob';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export const operationsSchema='CREATE TABLE IF NOT EXISTS branche_suspensions(uid TEXT PRIMARY KEY,reason TEXT NOT NULL,created BIGINT NOT NULL)';
export function operations(store,{adminIds=(process.env.BRANCHE_ADMIN_IDS||'').split(',').filter(Boolean),deleteFile=del}={}){
 const q=store.query,isAdmin=u=>Boolean(u&&adminIds.includes(u.id));
 return {isAdmin,handle:async({path,req,url,u,body,send,limit})=>{
 if(path==='/api/branche/account-delete'){
 if(!u)fail(401,'Please sign in first.');if(req.method!=='POST')fail(405,'Method not allowed.');
 await limit('delete-account:'+u.id,5,3600000);
 const me=(await q('SELECT salt,secret FROM branche_users WHERE id=?',[u.id]))[0];
 if(typeof body.password!=='string'||body.password.length>200||!timingSafeEqual(scryptSync(body.password.trim(),me.salt,32),Buffer.from(me.secret,'hex')))fail(401,'Your password is incorrect.');
 const media=await q('SELECT path FROM branche_media WHERE uid=?',[u.id]);try{for(const m of media)await deleteFile(m.path);}catch{fail(503,'Image deletion could not finish. Please retry; some images may already have been removed.');}
 await store.transaction(async t=>{
 const threads=await t('SELECT id FROM branche_threads WHERE customer=? OR contractor=?',[u.id,u.id]);
 const posts=await t('SELECT id FROM branche_posts WHERE uid=?',[u.id]);const jobs=await t('SELECT id FROM branche_jobs WHERE uid=?',[u.id]);
 for(const row of threads){await t('DELETE FROM branche_messages WHERE thread=?',[row.id]);await t('DELETE FROM branche_reports WHERE kind=? AND target=?',['conversation',row.id]);}
 for(const [kind,rows]of [['post',posts],['job',jobs]])for(const row of rows)await t('DELETE FROM branche_reports WHERE kind=? AND target=?',[kind,row.id]);
 await t('DELETE FROM branche_reports WHERE uid=? OR (kind=? AND target=?)',[u.id,'profile',u.id]);
 await t('DELETE FROM branche_threads WHERE customer=? OR contractor=?',[u.id,u.id]);
 await t('DELETE FROM branche_blocks WHERE uid=? OR target=?',[u.id,u.id]);
 for(const table of ['branche_media_config','branche_media','branche_profiles','branche_posts','branche_jobs','branche_workspaces','branche_recovery','branche_suspensions','branche_sessions'])await t('DELETE FROM '+table+' WHERE uid=?',[u.id]);
 await t('DELETE FROM branche_users WHERE id=?',[u.id]);
 });send(200,{deleted:true});return true;
 }
 if(!path.startsWith('/api/branche/admin'))return false;
 if(!isAdmin(u))fail(403,'Operator access is required.');if(req.method!=='GET')await limit('admin:'+u.id,30,60000);
 if(path==='/api/branche/admin/reports'&&req.method==='GET'){
 const reports=await q('SELECT * FROM branche_reports ORDER BY created DESC LIMIT 100');send(200,{reports});return true;
 }
 if(path==='/api/branche/admin/report'&&req.method==='GET'){
 const r=(await q('SELECT * FROM branche_reports WHERE id=?',[url.searchParams.get('id')]))[0];if(!r)fail(404,'Report not found.');
 let content;if(r.kind==='profile')content=await q('SELECT uid,name,description FROM branche_profiles WHERE uid=?',[r.target]);else if(r.kind==='job')content=await q('SELECT uid,title,description FROM branche_jobs WHERE id=?',[r.target]);else if(r.kind==='post')content=await q('SELECT uid,title,description FROM branche_posts WHERE id=?',[r.target]);else content=await q('SELECT uid,body,created FROM branche_messages WHERE thread=? ORDER BY created DESC LIMIT 30',[r.target]);
 send(200,{report:r,content});return true;
 }
 if(path==='/api/branche/admin/report'&&req.method==='PUT'){
 const r=(await q('SELECT * FROM branche_reports WHERE id=?',[body.id]))[0];if(!r)fail(404,'Report not found.');
 if(!['dismiss','suspend'].includes(body.action))fail(400,'Choose an action.');
 if(body.action==='suspend'){
 let authors;if(r.kind==='profile')authors=await q('SELECT uid FROM branche_profiles WHERE uid=?',[r.target]);else if(r.kind==='job')authors=await q('SELECT uid FROM branche_jobs WHERE id=?',[r.target]);else if(r.kind==='post')authors=await q('SELECT uid FROM branche_posts WHERE id=?',[r.target]);else authors=await q('SELECT uid FROM branche_messages WHERE thread=?',[r.target]);
 if(!authors.some(a=>a.uid===body.author)||adminIds.includes(body.author))fail(400,'Select a reported author who is not an operator.');
 await q('INSERT INTO branche_suspensions VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET reason=excluded.reason,created=excluded.created',[body.author,'Community report reviewed by operator',Date.now()]);
 await q('UPDATE branche_profiles SET published=0 WHERE uid=?',[body.author]);await q("UPDATE branche_posts SET state='removed' WHERE uid=?",[body.author]);await q("UPDATE branche_jobs SET state='closed' WHERE uid=?",[body.author]);
 }
 await q('UPDATE branche_reports SET state=? WHERE id=?',[body.action==='dismiss'?'dismissed':'actioned',r.id]);send(200,{saved:true});return true;
 }
 fail(405,'Method not allowed.');
 }};
}
