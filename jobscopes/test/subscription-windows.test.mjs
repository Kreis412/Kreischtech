import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addMonths,allowanceWindows} from '../subscription-windows.mjs';
test('annual windows handle leap years and month-end without drift or overlap',()=>{
 const start=Date.parse('2028-01-31T07:00:00Z'),end=addMonths(start,12),w=allowanceWindows('year',start,end);
 assert.equal(w.length,12);assert.equal(new Date(w[0].expires).toISOString(),'2028-02-29T07:00:00.000Z');assert.equal(new Date(w[1].expires).toISOString(),'2028-03-31T07:00:00.000Z');
 for(let i=1;i<w.length;i++)assert.equal(w[i].starts,w[i-1].expires);
 assert.equal(w.at(-1).expires,end);assert.throws(()=>allowanceWindows('year',NaN,end));assert.throws(()=>allowanceWindows('year',start,addMonths(start,14)));
});
