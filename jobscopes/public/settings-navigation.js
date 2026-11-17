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
