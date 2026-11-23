export function purchaseDisclosure({recurring,play=false}){
 const renewal=recurring?'The subscription renews at the selected interval until canceled.':'This is a one-time purchase.';
 const refunds=recurring&&!play?' Request a full refund within 7 days of your first subscription payment.':'';
 const provider=play?' Review the final price and terms in Google Play.':'';
 return `<p>${renewal}${refunds}${provider} By continuing to checkout, you agree to the <a href="/terms.html">terms</a>, <a href="/privacy.html">privacy notice</a> and <a href="/refunds.html">refund policy</a>.</p><p>AI features need an internet connection. Review draft results before using them on a job.</p>`;
}
