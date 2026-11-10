// Calendar-based monthly allowances within a paid annual term. UTC avoids DST drift.
export function addMonths(timestamp,months){
 const d=new Date(timestamp),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.getTime();
}
export function allowanceWindows(interval,start,end){
 if(interval!=='year')return [{suffix:'',starts:0,expires:end}];
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>addMonths(start,12)+86400000)throw Object.assign(new Error('Annual subscription period needs review.'),{status:409});
 const windows=[];
 for(let m=0;m<12;m++){const begins=addMonths(start,m);if(begins>=end)break;windows.push({suffix:m?':month:'+m:'',starts:begins,expires:Math.min(addMonths(start,m+1),end)});}
 return windows;
}
export function periodGrantIds(root){return Array.from({length:12},(_,m)=>root+(m?':month:'+m:''));}
