import {api as request} from './api.js';
export function invoicePage(host,{api=request}={}){
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const write=(path,body={})=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const money=(cents,currency='usd')=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(cents/100);
let requestId=crypto.randomUUID(),draft=null;
function notify(message){host.querySelector('#invoice-message').textContent=message;}
async function render(){
 const state=await api('/api/connect/status');
 host.innerHTML=`<section class="panel"><a href="/">Back to workspace</a><h1>Customer invoices</h1><p id="invoice-message" role="status" aria-live="polite"></p><div id="stripe-account"></div><div id="invoice-form"></div></section><section class="panel"><h2>Invoice history</h2><div id="invoice-history"></div></section>`;
 if(!state.enabled){notify(state.message);return;}
 const area=host.querySelector('#stripe-account');
 area.innerHTML=`<p class="notice">${state.mode==='sandbox'?'Sandbox: test invoices only. No real money is collected.':'Live invoices: real customers can pay.'}</p><p>Payments go directly to your Stripe account. ContractorSight adds no transaction fee. Stripe processing and invoicing fees still apply.</p><p>${state.disconnected?'Stripe connection disconnected. Contact support.':state.active?'Stripe payments are ready.':'Stripe onboarding or verification is required.'}</p>${state.owner&&!state.disconnected?'<button id="stripe-onboard">'+(state.connected?'Continue / update Stripe onboarding':'Set up Stripe payments')+'</button>':''} <a href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer">Open full Stripe Dashboard</a>`;
 host.querySelector('#stripe-onboard')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{const result=await write('/api/connect/onboarding');location.assign(result.url);}catch(error){notify(error.message);e.target.disabled=false;}});
 if(new URLSearchParams(location.search).has('refresh'))notify('Your onboarding link expired. Use Continue / update Stripe onboarding to get a fresh link.');
 else if(new URLSearchParams(location.search).has('returned'))notify(state.active?'Stripe reports payments are ready.':'You returned from Stripe. Finish any outstanding verification before creating invoices.');
 const projects=state.owner&&state.active?await api('/api/projects'):[];
 if(state.owner&&state.active){
  host.querySelector('#invoice-form').innerHTML=`<h2>Create a draft invoice</h2><form id="draft-invoice"><label>Project<select name="project_id" required>${projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><label>Customer name<input name="customer_name" maxlength="160" required></label><label>Customer email<input name="customer_email" type="email" maxlength="254" required></label><div id="invoice-items"></div><button type="button" id="add-invoice-item">Add line item</button><label>Due in days<input name="days" type="number" min="1" max="365" value="30" required></label><p>USD only. Review the draft before finalizing. Finalizing creates a Stripe payment link; sending emails that invoice to this customer.</p><button type="submit" class="primary">Create draft</button><p id="draft-retry" role="status"></p></form>`;
  const form=host.querySelector('#draft-invoice'),items=form.querySelector('#invoice-items');
  function addItem(){const row=document.createElement('fieldset');row.innerHTML='<legend>Line item</legend><label>Description<input name="description" maxlength="500" required></label><label>Quantity<input name="quantity" type="number" min="1" max="10000" value="1" required></label><label>Unit price (USD)<input name="price" inputmode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required></label><button type="button">Remove item</button>';row.querySelector('button').onclick=()=>row.remove();items.append(row);}
  addItem();form.querySelector('#add-invoice-item').onclick=()=>{if(items.children.length<50)addItem();};
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{
   if(!draft){const values=new FormData(form);const lines=[...items.querySelectorAll('fieldset')].map(row=>{const value=row.querySelector('[name=price]').value;if(!/^\d+(\.\d{1,2})?$/.test(value))throw new Error('Enter a price with no more than two decimal places.');return {description:row.querySelector('[name=description]').value,quantity:Number(row.querySelector('[name=quantity]').value),unit_amount:Math.round(Number(value)*100)};});draft={request_id:requestId,project_id:values.get('project_id'),customer:{name:values.get('customer_name'),email:values.get('customer_email')},items:lines,days_until_due:Number(values.get('days'))};}
   // Keep the exact same payload and request ID after an uncertain network response.
   [...form.elements].forEach(el=>{if(el!==button)el.disabled=true;});
   const result=await write('/api/connect/invoices',draft);draft=null;requestId=crypto.randomUUID();await render();notify(`Draft created: ${result.id}. Review its items before finalizing.`);
  }catch(error){notify(error.message);const hint=form.querySelector('#draft-retry');if(draft){hint.textContent='The draft details are locked for a safe retry. Use Retry same draft; contact support before starting another if this cannot finish.';button.textContent='Retry same draft';}button.disabled=false;}};
 }
 await history(state);
}
async function history(state){
 const {invoices}=await api('/api/connect/invoices');
 const area=host.querySelector('#invoice-history');
 area.innerHTML=invoices.length?invoices.map(i=>`<article class="panel"><h3>${esc(i.customer_name)}</h3><p>${esc(i.status)} · ${money(i.amount_due,i.currency)} due · ${money(i.amount_paid,i.currency)} paid</p>${i.url?`<label>Stripe payment URL<input readonly value="${esc(i.url)}"></label><a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">Review / share payment page</a>`:''}${state.owner?`<div><button data-id="${esc(i.id)}" data-action="sync">Refresh status</button>${i.complete&&i.status==='draft'?`<button data-id="${esc(i.id)}" data-action="finalize">Finalize & create payment URL</button>`:''}${i.complete&&i.status==='open'&&!i.sent?`<button data-id="${esc(i.id)}" data-action="send">Email invoice to customer</button>`:''}</div>`:''}<details><summary>Review invoice details</summary><div data-details="${esc(i.id)}"></div></details></article>`).join(''):'<p>No invoices yet.</p>';
 // Use textContent for saved invoice line details to keep customer text inert.
 for(const invoice of invoices){
  const target=area.querySelector(`[data-details="${invoice.id}"]`);target.textContent=invoice.items.map(i=>`${i.description}: ${i.quantity} × ${money(i.unit_amount)}`).join('\n');
  if(state.owner&&!invoice.complete){const button=document.createElement('button');button.dataset.id=invoice.id;button.dataset.action='resume';button.textContent='Resume unfinished draft';target.parentElement.before(button);}
 }
 area.onclick=async e=>{const button=e.target.closest('[data-action]');if(!button)return;button.disabled=true;try{await write(`/api/connect/invoices/${encodeURIComponent(button.dataset.id)}/${button.dataset.action}`);await history(state);notify('Invoice updated.');}catch(error){notify(error.message);button.disabled=false;}};
}
return render().catch(error=>{host.textContent=error.message+' Sign in from the workspace, then open customer invoices again.';});
}
if(typeof document!=='undefined'&&document.querySelector('#invoicing'))invoicePage(document.querySelector('#invoicing'));
