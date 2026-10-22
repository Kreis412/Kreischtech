import {track,eventForRequest} from './analytics.js';
export async function api(path, opts = {}) {
  const writing = !['GET', 'HEAD'].includes((opts.method || 'GET').toUpperCase());
  const next = writing
    ? 'Your entries are still in this form. Before submitting again, check whether the change was saved to avoid duplicates.'
    : 'Please wait a moment and try again.';
  const failed=()=>{if(eventForRequest(path,(opts.method||'GET').toUpperCase()))track('feature_request_failed');};
  let response;
  try { response = await fetch(path, opts); }
  catch { failed(); throw new Error(`Cannot reach ContractorSight. Check your internet connection. ${next}`); }
  let value;
  try {
    if (!/\bapplication\/json\b/i.test(response.headers.get('content-type') || '')) throw new Error();
    value = await response.json();
  } catch {
    failed();
    throw new Error(`ContractorSight received an unexpected response from the server (HTTP ${response.status}). ${next}`);
  }
  if (!response.ok) { failed(); throw new Error(value?.error || `The request could not be completed (HTTP ${response.status}). ${next}`); }
  const event=eventForRequest(path,(opts.method||'GET').toUpperCase(),value);if(event)track(event);
  return value;
}
