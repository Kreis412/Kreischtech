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
 host.innerHTML=navigation+(live?`<section class="page-heading"><div><div class="eyebrow">Workspace settings</div><h1>Plan &amp; usage</h1><p>${active?'Manage your subscription and AI allowance.':'Choose Solo for more photo analyses and Joe answers.'}</p></div></section>
 <section class="panel"><h2>Your AI allowance</h2><p><strong>${esc(data.balance)} photo analyses remaining</strong></p><p><strong>${esc(data.joe_balance)} Joe answers remaining</strong></p><p>${esc(data.carryover_balance??0)} of these photo credits are purchased packs that carry over until used. Photo and chat balances are separate. Site, blueprint and equipment analyses share the photo allowance.</p></section>
 <section class="panel"><h2>${active?'Your Solo subscription':'Solo — $19/month'}</h2><p><strong>1 user · 25 photo analyses + 25 Joe answers per billing month</strong></p><p>$19 USD billed monthly. Each paid billing month includes 25 photo analyses and 25 Joe answers. Unused allowances expire at the end of that billing period and do not roll over.</p><p>Credits are used when a new result is saved. Viewing saved results is free. Failed results return the customer credit. AI requires internet access, can make mistakes, and needs human review. Service spending limits may temporarily pause AI; project records remain accessible.</p><p>Cancel renewal here before your next billing date to stop the next charge. Remaining paid credits expire at the end of the billing period. Request a full refund within 7 days of your first subscription payment. Later requests are reviewed individually. Refunded or disputed payments can reduce unused allowances.</p>
 ${active?`<p>Status: <strong>${esc(active.status)}</strong> · Current period ends ${esc(new Date(active.period_end).toLocaleDateString())}${active.cancel_at_end?' · Renewal canceled':''}</p>${data.checkout_enabled&&!active.cancel_at_end?'<button type="button" data-cancel>Cancel renewal at period end</button>':''}`:data.checkout_enabled?'<label><input type="checkbox" id="billing-consent"> I agree to the <a href="/terms.html" target="_blank" rel="noopener">terms</a>, <a href="/privacy.html" target="_blank" rel="noopener">privacy notice</a> and <a href="/refunds.html" target="_blank" rel="noopener">refund policy</a>, and authorize $19 USD monthly until I cancel.</label><button type="button" class="primary" data-test-plan="solo">Subscribe to Solo — $19/month</button>':'<p>Only the company owner can subscribe.</p>'}
 ${data.checkout_enabled?'<button type="button" data-sync>Check payment status</button>':''}</section>`:`<section class="page-heading"><div><div class="eyebrow">Workspace settings</div><h1>Plan &amp; usage</h1><p>${esc(data.message)}</p></div></section>
 <section class="panel"><h2>Current access: Pilot</h2><p>No real subscription payment is collected here.</p><p>${esc(data.joe_message)}</p><p>Launch trial proposal: ${esc(data.trial_analyses)} analyses. This does not reset your current pilot allowance.</p></section>
 <section class="panel"><h2>Proposed launch pricing</h2><p>USD. Allowances and terms will be confirmed before purchases open.</p><div class="plan-grid">${data.plans.map(p=>`<article class="plan-card"><h3>${esc(p.name)}</h3><p class="plan-price">${esc(money(p.price_cents))}<small> / ${p.interval==='month'?'month':'10-analysis pack'}</small></p><p>${esc(p.seats===1?'1 user':`Up to ${p.seats} users`)}</p><p>${esc(p.analyses)} analyses ${p.interval==='month'?'per billing month':'per pack'}</p><p>${p.id==='crew'?'Shared company projects and core project tools.':p.id==='solo'?'Core project tools, estimates and photo analysis.':'Basic workspace with no monthly subscription.'}</p>${data.checkout_enabled?`<button type="button" data-test-plan="${esc(p.id)}">Test ${esc(p.name)} checkout</button>`:'<span class="badge">Not available to purchase yet</span>'}</article>`).join('')}</div></section>
 ${testing?`<section class="panel"><h2>Stripe test results</h2><p><strong>${esc(data.test_balance)} simulated analysis credits</strong> — separate from real AI usage.</p><p>Test subscriptions do not change team access. Only use Stripe test card details.</p>${data.subscriptions.map(s=>`<p>${esc(s.plan)}: ${esc(s.status)}${s.cancel_at_end?' · cancellation scheduled':''} · period ends ${esc(new Date(s.period_end).toLocaleDateString())}</p>`).join('')}${data.checkout_enabled?'<button type="button" data-sync>Check test payment</button><details><summary>Cancel a test subscription</summary><p>This stops renewal at the end of the test billing period. Your projects and pilot access remain available.</p><button type="button" data-cancel>Schedule test cancellation</button></details>':''}</section>`:''}
 `)+`${live?`<section class="panel"><h2>One-time photo analysis packs</h2><p>No monthly subscription required. Purchased credits carry over until used, including after a subscription ends. Monthly credits are used first. Packs do not include Joe answers or additional team seats.</p><div class="plan-grid">${(data.packs||[]).map(p=>`<article class="plan-card"><h3>${esc(p.name)}</h3><p class="plan-price">${esc(money(p.price_cents))}<small> once</small></p>${p.purchase_enabled?`<button type="button" data-test-plan="${esc(p.id)}">Buy ${esc(p.analyses)} ${p.analyses===1?'analysis':'analyses'}</button>`:'<span class="badge">Coming soon</span>'}</article>`).join('')}</div><label><input type="checkbox" id="pack-consent"> I agree to the <a href="/terms.html">terms</a> and <a href="/refunds.html">refund policy</a> for this one-time purchase.</label></section>`:''}<section class="panel"><h2>Need a larger plan?</h2><p>Pro and Team tiers are planned, but are not available to purchase yet. We will show pricing and allowances here when they are ready.</p></section><section class="panel"><h2>Billing help</h2><p>For support, billing questions or refund requests, email <a href="mailto:kreischtech@gmail.com">kreischtech@gmail.com</a>. Include your account email and a short description. Never send passwords, API keys or full card details.</p><a href="#help">Open Help</a> · <a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a> · <a href="/refunds.html">Refund policy</a></section>
 <p role="status" aria-live="polite" id="billing-message"></p>`;
 const write=(path,body)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const message=host.querySelector('#billing-message');
 async function action(button,fn){const buttons=[...host.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message.textContent='Working…';try{await fn();}catch(e){message.textContent=e.message;message.scrollIntoView({block:'center',behavior:'smooth'});}finally{buttons.forEach(b=>b.disabled=false);}}
 host.querySelectorAll('[data-test-plan]').forEach(button=>button.onclick=()=>action(button,async()=>{
  const pack=button.dataset.testPlan.startsWith('analysis_');
  if(live&&!host.querySelector(pack?'#pack-consent':'#billing-consent')?.checked)throw new Error('Please check the agreement for this purchase before continuing.');
  const result=await write('/api/billing/checkout',{plan:button.dataset.testPlan,...(live?{terms_version:'2026-10-01'}:{})});
  const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Unexpected checkout address.');
  location.assign(url.href);
 }));
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
