import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appHelpAnswer} from '../public/joe.js';
test('common app questions use free built-in help',()=>{for(const q of ['How do I make an estimate?','Where are my credits?','How do I create a business page on Branche?','How do I upload a photo?','Where are calculators?'])assert.ok(appHelpAnswer(q),q);});
test('job-specific advice is never mistaken for free app help',()=>{for(const q of ['What does a deck cost?','How do I build a deck?','Estimate labor for 500 square feet of drywall'])assert.equal(appHelpAnswer(q),null);});
