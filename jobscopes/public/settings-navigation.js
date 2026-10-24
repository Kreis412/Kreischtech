// Keep one navigation bar outside the section that its renderer owns.
export async function renderSettingsSection(host,{render,navigation,isCurrent=()=>true}){
  const section=document.createElement('div');
  section.dataset.settingsContent='';
  host.replaceChildren(section);
  await render(section);
  if(!isCurrent()||!section.isConnected)return;
  host.insertAdjacentHTML('afterbegin',navigation());
}
