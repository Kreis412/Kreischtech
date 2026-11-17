// Keep one navigation bar outside the section that its renderer owns.
export function sectionTabs(host,groups,{label='Sections',selected='',onSelect=()=>{}}={}){
 const nav=document.createElement('nav');nav.className='settings-nav section-tabs';nav.setAttribute('aria-label',label);nav.setAttribute('role','tablist');
 const choose=id=>{groups.forEach(g=>{const active=g.id===id;g.nodes.forEach(n=>n.hidden=!active);g.button.setAttribute('aria-selected',String(active));g.button.tabIndex=active?0:-1;});onSelect(id);};
 groups.forEach((g,i)=>{const b=document.createElement('button');g.button=b;b.type='button';b.textContent=g.label;b.id='section-tab-'+g.id;b.setAttribute('role','tab');b.setAttribute('aria-controls',g.nodes.map((n,j)=>{n.id||='section-panel-'+g.id+'-'+j;n.setAttribute('role','tabpanel');n.setAttribute('aria-labelledby',b.id);return n.id;}).join(' '));b.onclick=()=>choose(g.id);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const next=e.key==='Home'?0:e.key==='End'?groups.length-1:(i+(e.key==='ArrowRight'?1:groups.length-1))%groups.length;choose(groups[next].id);groups[next].button.focus();};nav.append(b);});
 host.prepend(nav);choose(groups.some(g=>g.id===selected)?selected:groups[0].id);return nav;
}
export async function renderSettingsSection(host,{render,navigation,isCurrent=()=>true}){
  const section=document.createElement('div');
  section.dataset.settingsContent='';
  host.replaceChildren(section);
  await render(section);
  if(!isCurrent()||!section.isConnected)return;
  host.insertAdjacentHTML('afterbegin',navigation());
}

// Lightweight decorative graphics: no image downloads, tracking, or billing changes.
export function installPageGraphics(host){
 const paths={
  home:'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',
  camera:'M3 7h4l2-3h6l2 3h4v14H3zM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  stack:'M7 3h14v14M4 6h14v14H4zM6 17l4-4 3 3 2-2 3 3M9 10h.01',
  solo:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3',
  pro:'M8 7V3h8v4M3 7h18v14H3zM3 12l9 3 9-3M12 12v5',
  team:'M15 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6 21v-4a6 6 0 0 1 12 0v4M3 7a3 3 0 0 0 0 6M21 7a3 3 0 0 1 0 6M2 21v-3l2-2M22 21v-3l-2-2',
  chat:'M3 3h18v14H9l-6 4zM7 8h10M7 12h6',
  money:'M3 5h18v14H3zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M5 8h2M17 16h2',
  chart:'M4 3v18h18M8 17v-5M13 17V8M18 17V4',
  calendar:'M3 5h18v16H3zM7 2v6M17 2v6M3 10h18M7 14h2M13 14h2M7 18h2',
  tools:'M14 3a6 6 0 0 0-7 8L2 17l5 5 6-6a6 6 0 0 0 8-7l-4 4-5-5z',
  calculator:'M5 2h14v20H5zM8 5h8v4H8zM8 13h1M15 13h1M8 17h1M15 17h1',
  book:'M12 5C9 2 5 2 2 3v17c3-1 7-1 10 2 3-3 7-3 10-2V3c-3-1-7-1-10 2v17',
  shield:'M12 2 3 6v6c0 5 5 8 9 10 4-2 9-5 9-10V6zM7 12l3 3 7-7',
  branch:'M12 22V9M12 15C4 15 2 11 2 5c7 0 10 3 10 10M12 11C12 4 16 2 22 2c0 6-3 9-10 9',
  settings:'M12 3v3M12 18v3M3 12h3M18 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0'
 };
 function paint(){
  host.querySelectorAll('h1,.plan-card h2,.plan-card h3,.home-community h2,.home-capture h2').forEach(heading=>{
   if(heading.querySelector('.mini-graphic'))return;
   const title=heading.textContent.toLowerCase();
   const kind=/team/.test(title)?'team':/solo/.test(title)?'solo':/^pro(?:\s|$)/.test(title)?'pro':/photo|analys/.test(title)?(/^(5|12)\b/.test(title)?'stack':'camera'):/branche|community/.test(title)?'branch':/joe/.test(title)?'chat':/plan|credit|payment|estimate/.test(title)?'money':/insight|statistic/.test(title)?'chart':/appointment|check-in/.test(title)?'calendar':/equipment|fleet/.test(title)?'tools':/calculator/.test(title)?'calculator':/help|guide|tutorial/.test(title)?'book':/security|privacy/.test(title)?'shield':/setting|appearance|profession/.test(title)?'settings':/company|business/.test(title)?'pro':'home';
   const graphic=document.createElement('span');graphic.className='mini-graphic graphic-'+kind;graphic.setAttribute('aria-hidden','true');
   graphic.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="'+paths[kind]+'"/></svg>';
   heading.prepend(graphic);
  });
 }
 const observer=new MutationObserver(paint);observer.observe(host,{childList:true,subtree:true});paint();return ()=>observer.disconnect();
}
