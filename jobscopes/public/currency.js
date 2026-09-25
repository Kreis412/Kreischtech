export function normalizeCurrency(value) {
 const raw=String(value??'').trim();
 if(!raw)return '';
 if(!/^\$?\s*(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?|\.\d{1,2})$/.test(raw))throw new Error('Enter a dollar amount such as 25, 25.50, or $1,250.00 (up to two decimal places).');
 return Number(raw.replace(/[$,\s]/g,'')).toFixed(2);
}
