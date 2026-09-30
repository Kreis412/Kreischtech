const install=document.getElementById('install-app'),help=document.getElementById('install-help'),status=document.getElementById('connection-status'),menu=document.getElementById('phone-menu');
let promptEvent;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function installed(){install.hidden=standalone();if(standalone())help.hidden=true;}
installed();
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;installed();});
window.addEventListener('appinstalled',()=>{promptEvent=null;install.hidden=true;help.hidden=true;});
install.addEventListener('click',async()=>{
 if(promptEvent){const event=promptEvent;promptEvent=null;try{await event.prompt();await event.userChoice;}catch{help.hidden=false;}}
 else help.hidden=!help.hidden;
});
function connection(){status.hidden=navigator.onLine;status.textContent='Offline — project updates and AI analysis need a connection. Keep this page open to queue photos; retry them once connected.';}
connection();window.addEventListener('offline',connection);window.addEventListener('online',connection);
function closeMenu(){document.body.classList.remove('phone-menu-open');menu.setAttribute('aria-expanded','false');}
menu.addEventListener('click',()=>{const open=document.body.classList.toggle('phone-menu-open');menu.setAttribute('aria-expanded',String(open));});
document.querySelectorAll('.sidebar a').forEach(a=>a.addEventListener('click',closeMenu));
window.addEventListener('hashchange',closeMenu);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{help.textContent='Installation support could not load. You can still use this website. Reconnect and reload to try again.';});
