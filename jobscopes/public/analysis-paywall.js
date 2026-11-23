import {track} from './analytics.js';

// Presentation only. Server credit checks and payment-provider verification stay authoritative.
export async function showAnalysisPaywall({api,exhausted=false,kind='photo'}={}){
 let billing,play;try{[billing,play]=await Promise.all([api('/api/billing'),api('/api/billing/play')]);}catch{return false;}
 if(document.querySelector('.analysis-paywall'))return false;
 if(!exhausted&&play.has_subscription)return false;
 if(!exhausted&&(billing.subscriptions?.some(s=>!['canceled','incomplete_expired'].includes(s.status))||billing.carryover_balance>0))return false;
 const joe=kind==='joe';
 const context=joe?'joe_limit':exhausted?'photo_limit':'first_result';
 const dialog=document.createElement('dialog');
 dialog.className='analysis-paywall';
 dialog.setAttribute('aria-labelledby','analysis-offer-title');
 const title=joe?'Keep planning with Joe':exhausted?'Ready to check another photo?':'Your first photo review is saved';
 const description=joe?'Your Joe answers are used up. A plan includes monthly answers for questions about the work, materials and sequence. Built-in app help is free.':exhausted?'Your photo credits are used up. Buy a one-time photo pack for this project, or choose monthly allowances for ongoing work.':'Working on one room or deck? A one-time photo pack lets you check another area when you’re ready. For regular jobs, plans include photo analyses and answers from Joe.';
 dialog.innerHTML=`<section><h2 id="analysis-offer-title">${title}</h2><p>${description}</p>
 ${joe?'':'<a class="button primary" href="#settings/billing/packs" data-offer="packs">See one-time photo packs</a>'}
 <a class="button ${joe?'primary':''}" href="#settings/billing/plans" data-view-plans data-offer="plans">${joe?'See plans with Joe answers':'Compare monthly and annual plans'}</a>
 <button type="button" data-close>Continue with saved work</button></section>`;
 document.body.append(dialog);
 const close=()=>{dialog.close();dialog.remove();};
 dialog.querySelector('[data-close]').onclick=()=>{track('paywall_dismissed',{context});close();};
 dialog.querySelectorAll('[data-offer]').forEach(link=>link.onclick=()=>{
  track('paywall_plan_clicked',{context,offer:link.dataset.offer});close();
 });
 dialog.addEventListener('cancel',()=>{track('paywall_dismissed',{context});dialog.remove();});
 if(exhausted)dialog.showModal();else dialog.show();
 track('paywall_viewed',{context});
 return true;
}
