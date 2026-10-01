const fail=message=>{throw Object.assign(new Error(message),{status:409});};
const id=value=>typeof value==='string'?value:value?.id;

// Re-read provider objects, not webhook snapshots. Supports only the simple
// single-card payment sold by our checkout; other payment shapes need review.
export async function invoiceCharge(stripe,invoice,amount,live=false){
 const payments=await stripe.invoicePayments.list({invoice:invoice.id,status:'paid',limit:100});
 const rows=payments.data||[],payment=rows[0];
 if(payments.has_more||rows.length!==1||id(payment.invoice)!==invoice.id||payment.livemode!==live||payment.status!=='paid'||payment.currency!=='usd'||payment.amount_paid!==amount||payment.payment?.type!=='payment_intent')fail('Invoice payment needs review before credits can be granted.');
 const intentId=id(payment.payment.payment_intent);
 return intentCharge(stripe,intentId,amount,live);
}
export async function intentCharge(stripe,intentId,amount,live=false){
 if(!intentId?.startsWith('pi_'))fail('Invoice payment reference is missing.');
 const intent=await stripe.paymentIntents.retrieve(intentId);
 if(intent.id!==intentId||intent.livemode!==live||intent.status!=='succeeded'||intent.currency!=='usd'||intent.amount_received!==amount||!id(intent.latest_charge)?.startsWith('ch_'))fail('Invoice payment does not match the purchased allowance.');
 const charge=await stripe.charges.retrieve(id(intent.latest_charge));
 if(id(charge.payment_intent)!==intentId)fail('Invoice charge does not match its payment.');
 return charge;
}

export async function chargeAllowance(stripe,charge,amount,credits,live=false){
 if(!charge?.id?.startsWith('ch_')||charge.livemode!==live||!charge.paid||charge.status!=='succeeded'||charge.currency!=='usd'||charge.amount!==amount||!Number.isSafeInteger(charge.amount_refunded)||charge.amount_refunded<0||charge.amount_refunded>amount)fail('Payment state needs review before credits can be granted.');
 // A charge can retain its disputed flag after resolution. Only a verified
 // win releases the hold; an old event cannot overrule the current dispute.
 if(charge.disputed){
  const disputes=await stripe.disputes.list({charge:charge.id,limit:100});
  if(disputes.has_more||!disputes.data?.length||disputes.data.some(d=>id(d.charge)!==charge.id||d.livemode!==live||d.status!=='won'))return {available:0,reason:'Payment disputed'};
 }
 return {available:Math.floor(credits*(amount-charge.amount_refunded)/amount),reason:charge.amount_refunded?'Payment partially or fully refunded':'Payment verified'};
}
