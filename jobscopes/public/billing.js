export async function billingView(host,{api,esc}){
 const data=await api('/api/billing');
 const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:data.currency,maximumFractionDigits:0}).format(cents/100);
 const testing=data.mode==='stripe-test';
 const navigation=host.querySelector('.settings-nav')?.outerHTML||'';
 host.innerHTML=navigation+`<section class="page-heading"><div><div class="eyebrow">Workspace settings</div><h1>Plan &amp; usage</h1><p>${esc(data.message)}</p></div></section>
 <section class="panel"><h2>Current access: Pilot</h2><p>No real subscription payment is collected here.</p><p>${esc(data.joe_message)}</p><p>Launch trial proposal: ${esc(data.trial_analyses)} analyses. This does not reset your current pilot allowance.</p></section>
 <section class="panel"><h2>Proposed launch pricing</h2><p>USD. Allowances and terms will be confirmed before purchases open.</p><div class="plan-grid">${data.plans.map(p=>`<article class="plan-card"><h3>${esc(p.name)}</h3><p class="plan-price">${esc(money(p.price_cents))}<small> / ${p.interval==='month'?'month':'10-analysis pack'}</small></p><p>${esc(p.seats===1?'1 user':`Up to ${p.seats} users`)}</p><p>${esc(p.analyses)} analyses ${p.interval==='month'?'per billing month':'per pack'}</p><p>${p.id==='crew'?'Shared company projects and core project tools.':p.id==='solo'?'Core project tools, estimates and photo analysis.':'Basic workspace with no monthly subscription.'}</p>${data.checkout_enabled?`<button type="button" data-test-plan="${esc(p.id)}">Test ${esc(p.name)} checkout</button>`:'<span class="badge">Not available to purchase yet</span>'}</article>`).join('')}</div></section>
 ${testing?`<section class="panel"><h2>Stripe test results</h2><p><strong>${esc(data.test_balance)} simulated analysis credits</strong> — separate from real AI usage.</p><p>Test subscriptions do not change team access. Only use Stripe test card details.</p>${data.subscriptions.map(s=>`<p>${esc(s.plan)}: ${esc(s.status)}${s.cancel_at_end?' · cancellation scheduled':''} · period ends ${esc(new Date(s.period_end).toLocaleDateString())}</p>`).join('')}${data.checkout_enabled?'<button type="button" data-sync>Check test payment</button><details><summary>Cancel a test subscription</summary><p>This stops renewal at the end of the test billing period. Your projects and pilot access remain available.</p><button type="button" data-cancel>Schedule test cancellation</button></details>':''}</section>`:''}
 <section class="panel"><h2>Billing help</h2><p>For support, billing questions or refund requests, email <a href="mailto:kreischtech@gmail.com">kreischtech@gmail.com</a>. Include your account email and a short description. Never send passwords, API keys or full card details.</p><a href="#help">Open Help</a></section>
 <p role="status" aria-live="polite" id="billing-message"></p>`;
 const write=(path,body)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const message=host.querySelector('#billing-message');
 async function action(button,fn){const buttons=[...host.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message.textContent='Working…';try{await fn();}catch(e){message.textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}}
 host.querySelectorAll('[data-test-plan]').forEach(button=>button.onclick=()=>action(button,async()=>{
  const result=await write('/api/billing/checkout',{plan:button.dataset.testPlan});
  const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Unexpected checkout address.');
  location.assign(url.href);
 }));
 const refresh=async path=>{await write(path,{});await billingView(host,{api,esc});};
 const sync=host.querySelector('[data-sync]');if(sync)sync.onclick=()=>action(sync,()=>refresh('/api/billing/sync'));
 const cancel=host.querySelector('[data-cancel]');if(cancel)cancel.onclick=()=>action(cancel,()=>refresh('/api/billing/cancel'));
}
