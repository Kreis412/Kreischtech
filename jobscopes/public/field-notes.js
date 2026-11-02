const DB='contractorsight-field-notes-v1', STORE='notes';
function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function allNotes(){const db=await openDb();return new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
async function putNote(note){const db=await openDb();return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(note);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
async function removeNote(id){const db=await openDb();return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
export const fieldNotes={
  mount(host,project,{write,esc,toast,getIdentity}){
    if(!host||!project)return;
    const pid=project.id,session=getIdentity(),email=session?.user?.email,company=session?.company?.id;
    if(!email||!company){host.innerHTML='<h2>Field notes</h2><p>Sign in to save jobsite notes.</p>';return;}
    let listening=false,recognition=null,syncing=false;
    host.innerHTML='<div class="section-head"><div><div class="eyebrow">Works offline</div><h2>Field notes</h2></div></div><p class="muted">Capture a discovery by voice or text. Notes save on this device first and wait here if service is unavailable.</p><label>What did you notice?<textarea id="field-note-text" maxlength="4000" placeholder="Say or type what you found, where it is, and what needs follow-up."></textarea></label><div class="upload-actions"><button type="button" data-field-note="dictate">Start voice input</button><button type="button" class="primary" data-field-note="save">Save field note</button></div><p class="notice">Voice input uses your device’s speech recognition when available. Offline voice recognition depends on your phone’s installed language support. The saved transcript stays on this device until it syncs.</p><div id="field-note-queue"></div>';
    const textarea=host.querySelector('#field-note-text'),queue=host.querySelector('#field-note-queue');
    async function renderQueue(trySync=true){
      const notes=(await allNotes()).filter(n=>n.email===email&&n.company===company&&n.projectId===pid).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
      if(!host.isConnected)return;
      queue.innerHTML='<h3>Waiting to sync ('+notes.length+')</h3>'+notes.map(n=>'<article class="discovery"><strong>'+esc(n.title)+'</strong><p>'+esc(n.description)+'</p><small>Saved '+new Date(n.createdAt).toLocaleString()+' on this device</small></article>').join('');
      if(trySync&&navigator.onLine&&notes.length)sync(notes);
    }
    async function sync(notes){
      if(syncing)return;syncing=true;
      try{for(const note of notes){
        if(!navigator.onLine)break;
        try{
          await write('/api/projects/'+encodeURIComponent(pid)+'/discoveries','POST',{title:note.title,description:note.description,category:'General',priority:'Medium',status:'Open',next_step:'',photo_id:''});
          await removeNote(note.id);
        }catch{break;}
      }}finally{syncing=false;}
      if(host.isConnected)renderQueue(false);
    }
    host.onclick=async event=>{
      const button=event.target.closest('[data-field-note]');if(!button)return;
      if(button.dataset.fieldNote==='dictate'){
        const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
        if(!Speech){toast('Voice input is not available in this browser. Use your phone keyboard microphone or type the note.',true);return;}
        if(listening){recognition?.stop();listening=false;button.textContent='Start voice input';return;}
        recognition=new Speech();recognition.lang=navigator.language||'en-US';recognition.interimResults=false;recognition.continuous=false;
        recognition.onresult=e=>{const phrase=e.results?.[0]?.[0]?.transcript||'';textarea.value=(textarea.value?textarea.value+' ':'')+phrase;};
        recognition.onerror=()=>toast('Voice input stopped. Your typed note is still here.',true);
        recognition.onend=()=>{listening=false;if(button.isConnected)button.textContent='Start voice input';};
        try{recognition.start();listening=true;button.textContent='Stop voice input';}catch{toast('Could not start voice input. Check microphone permission.',true);}
      }
      if(button.dataset.fieldNote==='save'){
        const description=textarea.value.trim();if(!description){textarea.focus();return;}
        const title=description.split(/[.!?\n]/)[0].slice(0,150)||'Jobsite observation';
        const note={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(16).slice(2)),email,company,projectId:pid,title,description,createdAt:new Date().toISOString()};
        try{await putNote(note);textarea.value='';await renderQueue();toast(navigator.onLine?'Field note saved and queued to sync.':'Field note saved on this device; it will sync when you reconnect.');}
        catch{toast('Could not save this note on the device. Keep the text before leaving this screen.',true);}
      }
    };
    window.addEventListener('online',renderQueue);renderQueue();
  }
};
