import {track} from './analytics.js';

export function thankYou(host) {
 const section=document.createElement('section');
 section.className='panel';
 section.tabIndex=-1;
 section.innerHTML='<h1>Thank you for your purchase</h1><p>Your payment is confirmed. Open Plans &amp; usage to see your updated allowance.</p><a class="button primary" href="#settings/billing">View plans &amp; usage</a> <a class="button" href="#projects">Go to Projects</a>';
 host.replaceChildren(section);
 section.focus();
}

export async function confirmPurchase(host,{write,sessionId,verify}){
 host.innerHTML='<section class="panel"><h1>Checking your payment</h1><p role="status"></p><button type="button">Check payment</button> <a class="button" href="#settings/billing">View plans &amp; usage</a></section>';
 const status=host.querySelector('[role=status]'),button=host.querySelector('button');
 button.onclick=async()=>{
  button.disabled=true;
  status.textContent='Verifying your purchase…';
  try{
   const result=await write('/api/billing/confirm','POST',{session_id:sessionId});
   if(!verify())return;
   if(!result.confirmed){status.textContent='Payment is still pending. Check again in a minute.';return;}
   const url=new URL(location.href);
   url.searchParams.delete('stripe_session');
   window.history.replaceState({purchaseConfirmed:true},'',url);
   if(result.analytics_eligible)track('purchase_verified');
   thankYou(host);
  }catch(error){status.textContent=error.message;}
  finally{button.disabled=false;}
 };
 await button.onclick();
}
