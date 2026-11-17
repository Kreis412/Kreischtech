export function offerPlayReview(host){
 const key='cs-play-review-offered-v1';
 try{if(localStorage.getItem(key)||host.querySelector('[data-play-review]'))return;localStorage.setItem(key,'1');}catch{return;}
 const card=document.createElement('aside');card.className='panel';card.dataset.playReview='';card.setAttribute('aria-label','Optional Google Play review');card.innerHTML='<h3>Share your experience with ContractorSight</h3><p>Your estimate is saved. You can leave an honest rating or review on Google Play. This is optional and does not affect your access.</p><a class="button" href="https://play.google.com/store/apps/details?id=com.kreischtech.contractorsight" target="_blank" rel="noopener noreferrer">Review on Google Play</a> <button type="button">Not now</button>';card.querySelector('button').onclick=()=>card.remove();host.prepend(card);
}
