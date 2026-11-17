import {track} from './analytics.js';

// Presentation only. Server credit checks and payment-provider verification stay authoritative.
export async function showAnalysisPaywall({api,exhausted=false}={}){
 let billing,play;try{[billing,play]=await Promise.all([api('/api/billing'),api('/api/billing/play')]);}catch{return false;}
 if(document.querySelector('.analysis-paywall'))return false;
 if(!exhausted&&play.has_subscription)return false;
 if(!exhausted&&(billing.subscriptions?.some(s=>!['canceled','incomplete_expired'].includes(s.status))||billing.carryover_balance>0))return false;
 const dialog=document.createElement('dialog');dialog.className='analysis-paywall';dialog.setAttribute('aria-label','Choose your photo analysis allowance');
 dialog.innerHTML='<section><div class="eyebrow">Keep the next bid moving</div><h2>'+(exhausted?'Add credits for your next photo analysis':'Your first photo review is saved')+'</h2><p>'+(exhausted?'Your photo-analysis allowance is used up. Choose an existing plan or a one-time pack to run another analysis.':'Turn the next jobsite photo into findings, a starting estimate and a material list. Compare the existing plans or buy a photo pack without a subscription.')+'</p><ul><li>Review visible conditions and potential issues</li><li>Build estimates using your scope and measurements</li><li>Keep photos and job information organized</li></ul><p>Purchased pack credits carry over. Plan allowances refresh monthly. Review prices and renewal terms before paying.</p><a class="button primary" href="#settings/billing" data-view-plans>View plans & photo packs</a> <button type="button" data-close>Continue with saved work</button><p class="notice">Calculators and Branche business pages stay free. Your saved results remain available. AI drafts need your review.</p></section>';
 document.body.append(dialog);const close=()=>{dialog.close();dialog.remove();};dialog.querySelector('[data-close]').onclick=()=>{track('paywall_dismissed');close();};dialog.querySelector('[data-view-plans]').onclick=()=>{track('paywall_plan_clicked');close();};dialog.addEventListener('cancel',()=>{track('paywall_dismissed');dialog.remove();});dialog.showModal();track('paywall_viewed');return true;
}
