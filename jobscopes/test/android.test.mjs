import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPlayDistribution} from '../public/billing.js';
test('Play entry retains purchase UI restriction through same-session navigation',()=>{
 const values=new Map();const storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)};
 assert.equal(isPlayDistribution('','',storage),false);
 assert.equal(isPlayDistribution('?distribution=google-play','',storage),true);
 assert.equal(isPlayDistribution('','',storage),true);
 assert.equal(isPlayDistribution('','android-app://com.kreischtech.contractorsight/',{setItem(){throw Error();}}),true);
});
