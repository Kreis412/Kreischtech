import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportingPeriod,estimateReturn} from '../reporting.mjs';

test('YTD compares matching calendar dates and handles leap years',()=>{
  assert.deepEqual(reportingPeriod(2024,'ytd','2024-02-29'),{
    start:'2024-01-01',end:'2024-03-01',previous:{start:'2023-01-01',end:'2023-03-01'}});
  assert.deepEqual(reportingPeriod(2026,'ytd','2026-09-25'),{
    start:'2026-01-01',end:'2026-09-26',previous:{start:'2025-01-01',end:'2025-09-26'}});
  assert.equal(reportingPeriod(2026,'4','2026-09-25').end,'2027-01-01');
  assert.equal(reportingPeriod(2026,'all','2026-09-25').previous.end,'2026-01-01');
});
test('job return separates markup from margin and leaves unknown results blank',()=>{
  const r=estimateReturn(100000,129900,2);
  assert.equal(r.profit_cents,29900);assert.equal(r.return_percent,29.9);
  assert.ok(Math.abs(r.margin_percent-23.0177)<0.001);assert.equal(r.provisional,true);
  assert.equal(estimateReturn(0,0).return_percent,null);
  assert.equal(estimateReturn(100,null).profit_cents,null);
  assert.equal(estimateReturn(100,50).return_percent,-50);
});
