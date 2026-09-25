// Pending originals stay on this browser until the server acknowledges them or the user discards them.
const database=new Promise((resolve,reject)=>{
 const request=indexedDB.open('contractorsight-pending-photos',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'id'});
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
database.catch(()=>{});
async function store(mode,action){const db=await database;return new Promise((resolve,reject)=>{const tx=db.transaction('photos',mode),request=action(tx.objectStore('photos'));let value;request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Photo storage was interrupted.'));});}
export async function pendingPhotos(owner,company,project){return (await store('readonly',s=>s.getAll())).filter(p=>p.owner===owner&&p.company===company&&p.project===project);}
export async function queuePhoto(file,session,project){
 if(file.size>15*1024*1024)throw new Error('Larger than 15 MB.');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG or WebP photo.');
 const photo={id:crypto.randomUUID(),owner:session.user.email,company:session.company.id,project,name:file.name,file};
 await store('readwrite',s=>s.put(photo));return photo;
}
export const discardPhoto=id=>store('readwrite',s=>s.delete(id));
export async function sendPhoto(photo,api){
 const session=await api('/api/account/session',{signal:AbortSignal.timeout(10000)});
 if(session.user?.email!==photo.owner||session.company?.id!==photo.company)throw new Error('Sign in to the original account and company to retry.');
 await api(`/api/projects/${photo.project}/photos?name=${encodeURIComponent(photo.name)}`,{method:'POST',headers:{'Content-Type':photo.file.type,'X-Upload-Id':photo.id,'X-Upload-Owner':encodeURIComponent(photo.owner),'X-Upload-Company':photo.company},body:photo.file,signal:AbortSignal.timeout(45000)});
 await discardPhoto(photo.id);
}
