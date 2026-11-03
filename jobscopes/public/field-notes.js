const DB='contractorsight-field-notes-v1', STORE='notes';
async function store(mode,action){
  const db=await new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode),r=action(tx.objectStore(STORE));let value;
    r.onsuccess=()=>{value=r.result;};
    tx.oncomplete=()=>{db.close();resolve(value);};
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||new Error('Device storage was interrupted.'));};
  });
}
export const fieldNoteStorage={all:()=>store('readonly',s=>s.getAll()),put:n=>store('readwrite',s=>s.put(n)),remove:id=>store('readwrite',s=>s.delete(id))};
let config,cleanup,refresh,onlineTarget,inFlight;
const owns=(n,s)=>n.email===s?.user?.email&&n.company===s?.company?.id;
const online=()=>fieldNotes.sync().catch(()=>{});
export const fieldNotes={
  configure(options){
    config=options;
    if(onlineTarget!==window){onlineTarget?.removeEventListener('online',online);onlineTarget=window;window.addEventListener('online',online);}
    this.sync().catch(()=>{});
  },
  unmount(){cleanup?.();cleanup=null;refresh=null;},
  sync(){
    if(inFlight)return inFlight;
    if(!config||!navigator.onLine)return Promise.resolve();
    const options=config;
    inFlight=(async()=>{
      const session=options.getIdentity();if(!session?.user||!['Owner','Manager'].includes(session.company?.role))return;
      for(const note of (await fieldNoteStorage.all()).filter(n=>owns(n,session))){
        if(!navigator.onLine||!owns(note,options.getIdentity()))break;
        try{
          const saved=await options.api('/api/projects/'+encodeURIComponent(note.projectId)+'/discoveries',{
            method:'POST',headers:{'Content-Type':'application/json','X-Note-Company':note.company,'X-Note-Owner':encodeURIComponent(note.email)},
            body:JSON.stringify({client_note_id:note.id,title:note.title,description:note.description,category:'General',priority:'Medium',status:'Open',next_step:'',photo_id:''}),signal:AbortSignal.timeout(30000)
          });
          await fieldNoteStorage.remove(note.id);
          if(owns(note,options.getIdentity()))options.onSynced?.(note,saved);
        }catch(error){await fieldNoteStorage.put({...note,lastError:error.message||'Could not sync. Your note is saved on this device.'});}
      }
    })().finally(async()=>{inFlight=null;await refresh?.();});
    return inFlight;
  },
  mount(host,project,{esc,toast,getIdentity}){
    this.unmount();if(!host||!project)return;
    const pid=project.id,session=getIdentity(),email=session?.user?.email,company=session?.company?.id;
    if(!email||!company){host.textContent='Sign in to save jobsite notes.';return;}
    if(!['Owner','Manager'].includes(session.company.role)){host.textContent='Your access is read-only. An owner or manager can add field notes.';return;}
    let recognition,listening=false,disposed=false,saving=false;
    host.innerHTML='<h2>Field notes</h2><p class="muted">Open this project before losing service. Notes save here while offline and sync when this app reconnects. Reopening the app requires a connection.</p><label>What did you notice?<textarea maxlength="4000" placeholder="Say or type what you found and what needs follow-up."></textarea></label><div class="upload-actions"><button type="button" data-field-note="dictate">Start voice input</button><button type="button" class="primary" data-field-note="save">Save field note</button><button type="button" data-field-note="retry">Retry saved notes</button></div><p class="notice">Voice dictation may require internet and microphone permission. You can type while this screen is open. Clearing browser storage removes unsynced notes.</p><p data-note-status role="status" aria-live="polite"></p><div data-note-queue></div>';
    const textarea=host.querySelector('textarea'),queue=host.querySelector('[data-note-queue]'),status=host.querySelector('[data-note-status]');
    const current=()=>!disposed&&host.isConnected&&owns({email,company},getIdentity());
    async function render(){
      try{
        const notes=(await fieldNoteStorage.all()).filter(n=>n.email===email&&n.company===company&&n.projectId===pid).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
        if(current())queue.innerHTML='<h3>Waiting to sync ('+notes.length+')</h3>'+notes.map(n=>'<article class="discovery"><strong>'+esc(n.title)+'</strong><p>'+esc(n.description)+'</p><small>Saved '+esc(new Date(n.createdAt).toLocaleString())+' on this device</small>'+(n.lastError?'<p class="error">'+esc(n.lastError)+'</p>':'')+'</article>').join('');
      }catch{if(current())status.textContent='Device storage is unavailable. Keep a copy of your note before leaving.';}
    }
    refresh=render;cleanup=()=>{disposed=true;recognition?.abort();host.onclick=null;};
    host.onclick=async event=>{
      const button=event.target.closest('[data-field-note]');if(!button||!current())return;
      const action=button.dataset.fieldNote;
      if(action==='retry'){button.disabled=true;try{await fieldNotes.sync();}catch{status.textContent='Could not access saved notes. Please try again.';}finally{button.disabled=false;}return;}
      if(action==='dictate'){
        const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
        if(!Speech){toast('Use your phone keyboard microphone or type the note. Voice input is unavailable in this browser.',true);return;}
        if(listening){recognition?.stop();return;}
        recognition=new Speech();recognition.lang=navigator.language||'en-US';recognition.interimResults=false;recognition.continuous=false;
        recognition.onresult=e=>{if(!current())return;const next=(textarea.value?textarea.value+' ':'')+(e.results?.[0]?.[0]?.transcript||'');if(next.length>4000){toast('This note is full. Save it, then start another note.',true);return;}textarea.value=next;};
        recognition.onerror=()=>{if(current())toast('Voice input stopped. Check your connection and microphone permission. Your text is still here.',true);};
        recognition.onend=()=>{listening=false;if(current())button.textContent='Start voice input';};
        try{recognition.start();listening=true;button.textContent='Stop voice input';}catch{toast('Could not start voice input. Check microphone permission.',true);}return;
      }
      if(action==='save'){
        if(saving)return;
        const description=textarea.value.trim();if(!description){textarea.focus();return;}
        if(description.length>4000){toast('Keep each note under 4,000 characters.',true);return;}
        saving=true;button.disabled=true;recognition?.stop();
        const note={id:crypto.randomUUID(),email,company,projectId:pid,title:description.split(/[.!?\n]/)[0].slice(0,150)||'Jobsite observation',description,createdAt:new Date().toISOString()};
        try{
          await fieldNoteStorage.put(note);
          if(current()){if(textarea.value.trim()===description)textarea.value='';status.textContent='Saved on this device. It will sync when connected.';await render();}
          await fieldNotes.sync();
          if(current()&&!(await fieldNoteStorage.all()).some(n=>n.id===note.id))status.textContent='Saved to the Discovery Log.';
        }catch{if(current())status.textContent='Could not finish saving. Keep a copy of your text and check Waiting to sync before trying again.';}
        finally{saving=false;button.disabled=false;}
      }
    };render();
  }
};
