export async function api(path, opts = {}) {
  const writing = !['GET', 'HEAD'].includes((opts.method || 'GET').toUpperCase());
  const next = writing
    ? 'Your entries are still in this form. Before submitting again, check whether the change was saved to avoid duplicates.'
    : 'Please wait a moment and try again.';
  let response;
  try { response = await fetch(path, opts); }
  catch { throw new Error(`Cannot reach ContractorSight. Check your internet connection. ${next}`); }
  let value;
  try {
    if (!/\bapplication\/json\b/i.test(response.headers.get('content-type') || '')) throw new Error();
    value = await response.json();
  } catch {
    throw new Error(`ContractorSight received an unexpected response from the server (HTTP ${response.status}). ${next}`);
  }
  if (!response.ok) throw new Error(value?.error || `The request could not be completed (HTTP ${response.status}). ${next}`);
  return value;
}
