export function weatherService({request=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map(),users=new Map();let lastCall=0;
 return async function weather(user,lat,lon){
  if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Object.assign(new Error('Allow location access to get your local forecast.'),{status:400});
  const key=lat.toFixed(2)+','+lon.toFixed(2),old=cache.get(key);
  if(old&&old.until>now())return old.value;
  if(pending.has(key))return pending.get(key);
  if((users.get(user)||0)>now()-30000||lastCall>now()-100)throw Object.assign(new Error('Please wait a moment before refreshing weather.'),{status:429});
  if(users.size>1000)users.clear();users.set(user,now());lastCall=now();
  const task=(async()=>{try{
   const [a,b]=key.split(',');const response=await request('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat='+a+'&lon='+b,{headers:{'User-Agent':'ContractorSight/1.0 kreischtech@gmail.com',...(old?.modified?{'If-Modified-Since':old.modified}:{})},signal:AbortSignal.timeout(8000)});
   const until=Math.max(now()+600000,Date.parse(response.headers.get('expires'))||0);
   if(response.status===304&&old){old.until=until;return old.value;}
   if(!response.ok)throw new Error('Weather unavailable');
   const data=await response.json(),rows=data.properties.timeseries.filter(r=>Date.parse(r.time)>=now()-3600000).slice(0,12),first=rows[0];
   if(!first||!Number.isFinite(first.data.instant.details.air_temperature))throw new Error('Weather unavailable');
   const value={updated:data.properties.meta.updated_at,forecast_time:first.time,temperature_c:first.data.instant.details.air_temperature,wind_ms:first.data.instant.details.wind_speed,condition:(first.data.next_1_hours||first.data.next_6_hours)?.summary?.symbol_code||'Forecast',rain_mm:rows.reduce((sum,r)=>sum+(r.data.next_1_hours?.details?.precipitation_amount||0),0),hours:rows.length,approximate_location:key};
   if(cache.size>=500)cache.delete(cache.keys().next().value);cache.set(key,{until,value,modified:response.headers.get('last-modified')});return value;
  }catch{throw Object.assign(new Error('Weather is unavailable right now. Try again later.'),{status:503});}finally{pending.delete(key);}})();pending.set(key,task);return task;
 };
}
