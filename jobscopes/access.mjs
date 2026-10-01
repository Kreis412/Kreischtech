// Hosted mode assumes a private application port behind a TLS-terminating proxy.
import { guardLocalRequest } from './security.mjs';
// The entry document contains no account data. Allow external checkout returns
// even when an embedded browser omits Fetch Metadata headers. Authenticated APIs
// still enforce origin checks, and CSP prevents embedding the entry in frames.
export function isPublicEntryNavigation(req) {
 const path=(req.url || '').split('?')[0];
 return req.method==='GET' && (path==='/' || path==='/index.html');
}
export function accessPolicy(publicOrigin = '') {
 if (!publicOrigin) return {hosted:false,guard:guardLocalRequest};
 const url=new URL(publicOrigin);
 if(url.protocol!=='https:' || url.origin!==publicOrigin || url.username || url.password) throw new Error('PUBLIC_ORIGIN must be an exact HTTPS origin without a trailing slash.');
 return {hosted:true,guard(req){
  const deny=()=>{throw Object.assign(new Error('Request does not match the configured secure workspace.'),{status:403});};
  if(req.headers.host!==url.host || req.headers['x-forwarded-proto']!=='https') deny();
  const entry=isPublicEntryNavigation(req);
  if(req.headers.origin && req.headers.origin!==publicOrigin && !entry) deny();
  if(req.headers['sec-fetch-site']==='cross-site' && !entry) deny();
  if(!['GET','HEAD'].includes(req.method) && req.headers.origin!==publicOrigin) deny();
 }};
}
