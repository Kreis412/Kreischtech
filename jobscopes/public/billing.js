import {playBillingView} from './play-billing.js';
// Distribution hint controls presentation only; it never grants account access or credits.
export function isPlayDistribution(search,referrer,storage){
 const incoming=new URLSearchParams(search).get('distribution')==='google-play'||referrer.startsWith('android-app://com.kreischtech.contractorsight');
 try{if(incoming)storage.setItem('cs-play-distribution','1');return incoming||storage.getItem('cs-play-distribution')==='1';}catch{return incoming;}
}
export async function billingView(host,{api,esc}){
 const data=await api('/api/billing');
 if(isPlayDistribution(location.search,document.referrer,sessionStorage)){
  await playBillingView(host,{api,esc});
  return;
 }
 const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:data.currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
 const testing=data.mode==='stripe-test';
 const live=data.mode==='stripe-live',active=data.subscriptions?.find(s=>!['canceled','incomplete_expired'].includes(s.status));
 const navigation=host.querySelector('.settings-nav')?.outerHTML||'';
 host.innerHTML=navigation+(live?`<section class="page-heading"><div><div class="eyebrow">Workspace settings</div><h1>Plan &amp; usage</h1><p>${active?'Manage your subscription and AI allowance.':'Choose the allowance and team size that fit your business.'}</p></div></section>
 <section class="panel"><h2>Your AI allowance</h2><p><strong>${esc(data.balance)} photo analyses remaining</strong></p><p><strong>${esc(data.joe_balance)} Joe answers remaining</strong></p><p>${esc(data.carryover_balance??0)} of these photo credits are purchased packs that carry over until used. Photo and chat balances are separate. Site, blueprint and equipment analyses share the photo allowance.</p></section>
 <section class="panel"><h2>Monthly plans</h2><p>Core project tools, customer updates, appointments, equipment and calculators are included in every plan. Customer portal visitors do not use team seats.</p><div class="plan-grid">${(data.plans||[]).map(p=>`<article class="plan-card"><h3>${esc(p.name)}</h3><p class="plan-price">${esc(money(p.price_cents))}<small> / month</small></p><p>${p.seats===1?'1 user':`Up to ${esc(p.seats)} users`}</p><p><strong>${esc(p.analyses)} photo analyses + ${esc(p.joe_answers)} Joe answers</strong> per billing month${p.seats>1?' shared across your company':''}.</p>${active?.plan===p.id?'<span class="badge">Current plan</span>':active?(data.checkout_enabled&&p.purchase_enabled&&!data.scheduled_change?`<button type="button" data-change="${esc(p.id)}">Change to ${esc(p.name)}</button>`:'<p>Manage your scheduled change below.</p>'):p.purchase_enabled?`<button type="button" class="primary" data-test-plan="${esc(p.id)}">Subscribe to ${esc(p.name)} — ${esc(money(p.price_cents))}/month</button>`:'<p>Checkout not connected yet.</p>'}</article>`).join('')}</div>
 <p>USD billed monthly until canceled. Monthly allowances do not roll over. Purchased extra photo credits carry over. Photo and Joe balances are separate.</p><p>Credits are used when a new result is saved. Viewing saved results is free. Failed results return the credit. AI needs internet and human review. Service spending limits may temporarily pause AI.</p>
 ${!active&&data.checkout_enabled?'<label><input type="checkbox" id="billing-consent"> I agree to the <a href="/terms.html">terms</a>, <a href="/privacy.html">privacy notice</a> and <a href="/refunds.html">refund policy</a>, and authorize the selected plan price each month until canceled.</label>':''}
 ${active?`<p>Subscription: <strong>${esc((data.plans||[]).find(p=>p.id===active.plan)?.name||active.plan)}</strong> · ${esc(active.status)} · Period ends ${esc(new Date(active.period_end).toLocaleDateString())}${active.cancel_at_end?' · Renewal canceled':''}</p>${data.checkout_enabled&&!active.cancel_at_end?'<button type="button" data-cancel>Cancel renewal at period end</button>':''}`:''}
 <p>Full refund available within 7 days of the first subscription payment. Later requests reviewed individually. Refunded or disputed payments may reduce unused allowances.</p>${data.checkout_enabled?'<button type="button" data-sync>Check payment status</button>':''}</section>`:`<section class="page-heading"><div><div class="eyebrow">Workspace settings</div><h1>Plan &amp; usage</h1><p>${esc(data.message)}</p></div></section>
 <section class="panel"><h2>Current access: Pilot</h2><p>No real subscription payment is collected here.</p><p>${esc(data.joe_message)}</p><p>Launch trial proposal: ${esc(data.trial_analyses)} analyses. This does not reset your current pilot allowance.</p></section>
 <section class="panel"><h2>Proposed launch pricing</h2><p>USD. Allowances and terms will be confirmed before purchases open.</p><div class="plan-grid">${(data.plans||[]).map(p=>`<article class="plan-card"><h3>${esc(p.name)}</h3><p class="plan-price">${esc(money(p.price_cents))}<small> / ${p.interval==='month'?'month':'10-analysis pack'}</small></p><p>${esc(p.seats===1?'1 user':`Up to ${p.seats} users`)}</p><p>${esc(p.analyses)} analyses ${p.interval==='month'?'per billing month':'per pack'}</p><p>${p.id==='crew'?'Shared company projects and core project tools.':p.id==='solo'?'Core project tools, estimates and photo analysis.':'Basic workspace with no monthly subscription.'}</p>${data.checkout_enabled?`<button type="button" data-test-plan="${esc(p.id)}">Test ${esc(p.name)} checkout</button>`:'<span class="badge">Not available to purchase yet</span>'}</article>`).join('')}</div></section>
 ${testing?`<section class="panel"><h2>Stripe test results</h2><p><strong>${esc(data.test_balance)} simulated analysis credits</strong> — separate from real AI usage.</p><p>Test subscriptions do not change team access. Only use Stripe test card details.</p>${data.subscriptions.map(s=>`<p>${esc(s.plan)}: ${esc(s.status)}${s.cancel_at_end?' · cancellation scheduled':''} · period ends ${esc(new Date(s.period_end).toLocaleDateString())}</p>`).join('')}${data.checkout_enabled?'<button type="button" data-sync>Check test payment</button><details><summary>Cancel a test subscription</summary><p>This stops renewal at the end of the test billing period. Your projects and pilot access remain available.</p><button type="button" data-cancel>Schedule test cancellation</button></details>':''}</section>`:''}
 `)+`${live?`<section class="panel"><h2>One-time photo analysis packs</h2><p>No monthly subscription required. Purchased credits carry over until used, including after a subscription ends. Monthly credits are used first. Packs do not include Joe answers or additional team seats.</p><div class="plan-grid">${(data.packs||[]).map(p=>`<article class="plan-card"><h3>${esc(p.name)}</h3><p class="plan-price">${esc(money(p.price_cents))}<small> once</small></p>${p.purchase_enabled?`<button type="button" data-test-plan="${esc(p.id)}">Buy ${esc(p.analyses)} ${p.analyses===1?'analysis':'analyses'}</button>`:'<span class="badge">Coming soon</span>'}</article>`).join('')}</div><label><input type="checkbox" id="pack-consent"> I agree to the <a href="/terms.html">terms</a> and <a href="/refunds.html">refund policy</a> for this one-time purchase.</label></section>`:''}<section class="panel"><h2>Billing help</h2><p>For support, billing questions or refund requests, email <a href="mailto:kreischtech@gmail.com">kreischtech@gmail.com</a>. Include your account email and a short description. Never send passwords, API keys or full card details.</p><a href="#help">Open Help</a> · <a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a> · <a href="/refunds.html">Refund policy</a></section>
 <p role="status" aria-live="polite" id="billing-message"></p>`;
 const write=(path,body)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const message=host.querySelector('#billing-message');
 const changeArea=document.createElement('section');changeArea.className='panel';changeArea.hidden=true;host.append(changeArea);
 const pending=data.scheduled_change;
 if(pending){changeArea.hidden=false;changeArea.innerHTML=`<h2>Scheduled plan change</h2><p>${esc(pending.plan.toUpperCase())} starts ${esc(new Date(pending.effective_at).toLocaleDateString())}. Your current credits remain until renewal. Purchased packs carry over.</p>${data.checkout_enabled?(pending.state==='creating'?'<p>We are checking whether Stripe saved your change.</p><button type="button" data-retry-change>Finish checking plan change</button>':'<button type="button" data-cancel-change>Cancel plan change</button>'):''}`;}

 async function action(button,fn){const buttons=[...host.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message.textContent='Working…';try{await fn();}catch(e){message.textContent=e.message;message.scrollIntoView({block:'center',behavior:'smooth'});}finally{buttons.forEach(b=>b.disabled=false);}}
 host.querySelectorAll('[data-test-plan]').forEach(button=>button.onclick=()=>action(button,async()=>{
  const pack=button.dataset.testPlan.startsWith('analysis_');
  if(live&&!host.querySelector(pack?'#pack-consent':'#billing-consent')?.checked)throw new Error('Please check the agreement for this purchase before continuing.');
  const result=await write('/api/billing/checkout',{plan:button.dataset.testPlan,...(live?{terms_version:'2026-10-01'}:{})});
  const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Unexpected checkout address.');
  location.assign(url.href);
 }));
 host.querySelectorAll('[data-change]').forEach(button=>button.onclick=()=>action(button,async()=>{
  const q=await write('/api/billing/change/preview',{plan:button.dataset.change});
  changeArea.hidden=false;changeArea.innerHTML=`<h2>Review plan change</h2><p>Change to <strong>${esc(q.plan)}</strong> for <strong>${esc(money(q.price_cents))}/month</strong> starting <strong>${esc(new Date(q.effective_at).toLocaleDateString())}</strong>.</p><p>No charge today. Keep your current plan and remaining monthly credits until renewal. Purchased photo packs carry over. When a downgrade is scheduled, new team invitations must fit the smaller plan.</p><button type="button" class="primary" data-confirm-change>Confirm change at renewal</button><button type="button" data-dismiss-change>Keep current plan</button>`;
  message.textContent='Review the price and date before confirming.';changeArea.scrollIntoView?.({block:'center',behavior:'smooth'});
  changeArea.querySelector('[data-dismiss-change]').onclick=()=>{changeArea.hidden=true;message.textContent='Your plan has not changed.';};
  const confirm=changeArea.querySelector('[data-confirm-change]');confirm.onclick=()=>action(confirm,async()=>{await write('/api/billing/change/confirm',{quote_id:q.quote_id});await billingView(host,{api,esc});});
 }));
 const retryChange=host.querySelector('[data-retry-change]');if(retryChange)retryChange.onclick=()=>action(retryChange,async()=>{await write('/api/billing/change/confirm',{quote_id:pending.quote_id});await billingView(host,{api,esc});});
 const cancelChange=host.querySelector('[data-cancel-change]');if(cancelChange)cancelChange.onclick=()=>action(cancelChange,async()=>{await write('/api/billing/change/cancel',{});await billingView(host,{api,esc});});
 const refresh=async path=>{await write(path,{});await billingView(host,{api,esc});};
 const sync=host.querySelector('[data-sync]');if(sync)sync.onclick=()=>action(sync,async()=>{
  sync.textContent='Checking payment…';
  try{
   await refresh('/api/billing/sync');
   const result=host.querySelector('#billing-message');
   if(result){result.textContent='Payment check complete. Your current subscription and credit balances are shown above. If you just paid and they have not updated, wait a moment and check again. You do not need to pay again.';result.scrollIntoView?.({block:'center',behavior:'smooth'});}
  }finally{sync.textContent=testing?'Check test payment':'Check payment status';}
 });
 const cancel=host.querySelector('[data-cancel]');if(cancel)cancel.onclick=()=>action(cancel,()=>refresh('/api/billing/cancel'));
}
