import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {put,get,del} from '@vercel/blob';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export const mediaSchemas=[
'CREATE TABLE IF NOT EXISTS branche_media(id TEXT PRIMARY KEY,uid TEXT NOT NULL,path TEXT NOT NULL,created BIGINT NOT NULL)',
'CREATE TABLE IF NOT EXISTS branche_media_config(kind TEXT NOT NULL,target TEXT NOT NULL,uid TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,target))'];
export function safeLink(value,video=false){
 if(!value)return '';
 let url;try{url=new URL(value);}catch{fail(400,'Use a complete https:// link.');}
 if(url.protocol!=='https:'||url.username||url.password||url.href.length>1000)fail(400,'Use a public HTTPS link without login details.');
 if(video&&!['youtube.com','www.youtube.com','youtu.be','m.youtube.com'].includes(url.hostname))fail(400,'Use a YouTube video link for now.');
 return url.href;
}
export async function sanitizeImage(base64){
 if(typeof base64!=='string'||base64.length>2800000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(base64))fail(400,'Choose a JPEG, PNG or WebP photo under 2 MB.');
 const input=Buffer.from(base64.slice(base64.indexOf(',')+1),'base64');
 try{const image=sharp(input,{limitInputPixels:24000000,animated:false});const m=await image.metadata();if(!['jpeg','png','webp'].includes(m.format))fail(400,'Unsupported image.');return await image.rotate().resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer();}catch{fail(400,'This image could not be read. Try a smaller JPEG or PNG.');}
}
export function mediaHandler(q,{storage={put:async(path,bytes)=>(await put(path,bytes,{access:'private',contentType:'image/webp',addRandomSuffix:false})).pathname,get:async path=>{const r=await get(path,{access:'private'});return r?.statusCode===200?Buffer.from(await new Response(r.stream).arrayBuffer()):null;},del}}={}){
 async function parent(kind,target){if(kind==='profile')return (await q('SELECT uid,published FROM branche_profiles WHERE uid=?',[target]))[0];if(kind==='post'){const p=(await q('SELECT uid,state FROM branche_posts WHERE id=?',[target]))[0];return p&&{uid:p.uid,published:p.state==='published'?1:0};}fail(400,'Unknown media destination.');}
 return async({path,req,res,url,u,body,send,limit})=>{
 if(!['/api/branche/media-upload','/api/branche/media-config','/api/branche/media-file','/api/branche/media'].includes(path))return false;
 if(path.endsWith('/media')&&req.method==='GET'){
 const rows=await q('SELECT * FROM branche_media_config');const configs=[];for(const r of rows){const p=await parent(r.kind,r.target);if(p&&(p.published||p.uid===u?.id))configs.push({kind:r.kind,target:r.target,...JSON.parse(r.payload)});}send(200,{configs});return true;
 }
 if(path.endsWith('/media-file')&&req.method==='GET'){
 const id=url.searchParams.get('id');const m=(await q('SELECT * FROM branche_media WHERE id=?',[id]))[0];if(!m)fail(404,'Image not found.');
 let allowed=u?.id===m.uid;
 if(!allowed){const configs=await q('SELECT * FROM branche_media_config WHERE uid=?',[m.uid]);for(const c of configs){const p=JSON.parse(c.payload);if([p.logo,...p.photos].includes(id)&&(await parent(c.kind,c.target))?.published){allowed=true;break;}}}
 if(!allowed)fail(404,'Image not found.');const bytes=await storage.get(m.path);if(!bytes)fail(404,'Image not found.');res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);return true;
 }
 if(!u)fail(401,'Please sign in to upload or change media.');
 if(path.endsWith('/media-upload')&&req.method==='GET'){send(200,{images:await q('SELECT id FROM branche_media WHERE uid=? ORDER BY created DESC',[u.id])});return true;}
 if(path.endsWith('/media-upload')&&req.method==='POST'){
 await limit('media:'+u.id,20,86400000);
 if((await q('SELECT id FROM branche_media WHERE uid=?',[u.id])).length>=30)fail(400,'Your image library is full. Remove unused images before adding more.');
 const bytes=await sanitizeImage(body.image);const id=randomUUID();const stored=await storage.put('branche/'+u.id+'/'+id+'.webp',bytes);
 try{await q('INSERT INTO branche_media VALUES(?,?,?,?)',[id,u.id,stored,Date.now()]);}catch(e){await storage.del(stored);throw e;}
 send(201,{id});return true;
 }
 if(path.endsWith('/media-config')&&req.method==='PUT'){
 const p=await parent(body.kind,body.target);if(!p||p.uid!==u.id)fail(404,'Your page or post was not found.');
 const logo=typeof body.logo==='string'?body.logo:'';const photos=Array.isArray(body.photos)?body.photos:[];if(photos.length>6)fail(400,'Choose up to six photos.');
 for(const id of [logo,...photos].filter(Boolean))if(typeof id!=='string'||!(await q('SELECT id FROM branche_media WHERE id=? AND uid=?',[id,u.id])).length)fail(400,'Choose images from your own uploads.');
 const payload=JSON.stringify({logo:body.kind==='profile'?logo:'',photos:[...new Set(photos)],link:safeLink(body.link),video:safeLink(body.video,true)});
 await q('INSERT INTO branche_media_config VALUES(?,?,?,?) ON CONFLICT(kind,target) DO UPDATE SET payload=excluded.payload',[body.kind,body.target,u.id,payload]);send(200,{saved:true});return true;
 }
 if(path.endsWith('/media-upload')&&req.method==='DELETE'){
 const m=(await q('SELECT * FROM branche_media WHERE id=? AND uid=?',[body.id,u.id]))[0];if(!m)fail(404,'Your image was not found.');
 const configs=await q('SELECT payload FROM branche_media_config WHERE uid=?',[u.id]);if(configs.some(c=>{const p=JSON.parse(c.payload);return [p.logo,...p.photos].includes(body.id);}))fail(409,'Remove this image from your page or post first.');
 await storage.del(m.path);await q('DELETE FROM branche_media WHERE id=? AND uid=?',[body.id,u.id]);send(200,{saved:true});return true;
 }
 fail(405,'Method not allowed.');
 };
}
