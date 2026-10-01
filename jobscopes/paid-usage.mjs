// Company is bound by the authenticated server, never supplied by the client.
// Provider cost accounting remains separate from customer credit settlement.
export function paidUsage(credits,company){
 return async function runSaved(kind,requestKey,operation){
  credits.reserve(company,requestKey,kind);
  let result;
  try{result=await operation();}
  catch(error){credits.settle(company,requestKey,false);throw error;}
  // operation returns only after validated output has been persisted. A crash
  // leaves a counted reservation for review; it must never trigger an AI retry.
  credits.settle(company,requestKey,true);
  return result;
 };
}

export const runUnmetered=(_kind,_key,operation)=>operation();
