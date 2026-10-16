const METHOD='https://play.google.com/billing';
export async function playBillingView(host,{api,esc}){
 const navigation=host.querySelector('.settings-nav')?.outerHTML||'';
 const data=await api('/api/billing/play');
 host.innerHTML=navigation+`<section class="page-heading"><h1>Photo analysis packs</h1></section><section class="panel"><h2>Your allowance</h2><p><strong data-balance>${esc(data.balance)} photo analyses remaining</strong></p><p>${esc(data.joe_balance)} Joe answers remaining</p><p>Purchased photo credits carry over until used. No subscription required. Packs do not include Joe answers.</p></section><section class="panel"><div class="plan-grid" data-play-packs></div><p role="status" aria-live="polite" data-play-status></p><button type="button" data-restore hidden>Check purchases</button><p>Credits are added to the company you are signed into. Monthly credits are used first. Failed analyses return their credit.</p><p><a href="/terms.html">Terms</a> · <a href="/refunds.html">Refund policy</a> · <a href="mailto:kreischtech@gmail.com">Get help</a></p></section>`;
 const message=host.querySelector('[data-play-status]');
 if(!data.purchase_enabled){message.textContent=data.ready?'Only the company owner can buy or restore packs.':'Google Play purchases are being connected. Your existing allowance is still available.';return;}
 let service,details;
 try{service=await window.getDigitalGoodsService(METHOD);details=await service.getDetails(data.packs.map(p=>p.id));}
 catch{message.textContent='To buy packs, open the latest ContractorSight app installed from Google Play. If you just updated it, close and reopen the app.';return;}
 const write=(path,body)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const confirm=async purchase=>{
  const result=await write('/api/billing/play/confirm',{product:purchase.itemId,token:purchase.purchaseToken});
  if(result.confirmed)host.querySelector('[data-balance]').textContent=result.balance+' photo analyses remaining';
  return result;
 };
 let busy=false;
 async function action(fn){if(busy)return;busy=true;host.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){message.textContent=e.name==='AbortError'?'Purchase canceled.':(e.message||'Purchase could not finish. Tap Check purchases before buying again.');}finally{busy=false;host.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 const available=details.filter(item=>data.packs.some(p=>p.id===item.itemId));
 host.querySelector('[data-play-packs]').innerHTML=available.map(item=>{
  const p=data.packs.find(p=>p.id===item.itemId),price=new Intl.NumberFormat(navigator.language,{style:'currency',currency:item.price.currency}).format(Number(item.price.value));
  return `<article class="plan-card"><h2>${esc(p.name)}</h2><p>${esc(price)} once</p><button type="button" class="primary" data-buy="${esc(p.id)}">Buy ${esc(p.analyses)} ${p.analyses===1?'analysis':'analyses'}</button></article>`;
 }).join('');
 message.textContent=available.length?'Choose a pack. Google Play will confirm the price before you pay.':'These packs are not available for your Google Play account yet.';
 host.querySelectorAll('[data-buy]').forEach(button=>button.onclick=()=>action(async()=>{
  const item=available.find(p=>p.itemId===button.dataset.buy);
  // Open directly from the click so browser user-activation is preserved.
  const response=await new PaymentRequest([{supportedMethods:METHOD,data:{sku:item.itemId}}],{total:{label:item.title||'Photo analyses',amount:item.price}}).show();
  message.textContent='Verifying your purchase…';
  try{const result=await confirm({itemId:item.itemId,purchaseToken:response.details.purchaseToken||response.details.token});await response.complete(result.confirmed?'success':'unknown');message.textContent=result.confirmed?'Your credits are ready.':'Payment is pending. Tap Check purchases after Google confirms payment.';}
  catch(e){await response.complete('unknown').catch(()=>{});throw new Error('Your payment may have succeeded. Tap Check purchases to finish adding credits. Do not pay again.');}
 }));
 const restore=host.querySelector('[data-restore]');restore.hidden=false;
 restore.onclick=()=>action(async()=>{
  message.textContent='Checking Google Play purchases…';let pending=false;
  for(const p of await service.listPurchases()){if(!data.packs.some(pack=>pack.id===p.itemId))continue;const result=await confirm(p);pending ||= !!result.pending;}
  await write('/api/billing/play/sync',{});
  const refreshed=await api('/api/billing/play');host.querySelector('[data-balance]').textContent=refreshed.balance+' photo analyses remaining';
  message.textContent=pending?'A payment is still pending with Google. Check again after it completes.':'Your purchased credits are up to date.';
 });
}
