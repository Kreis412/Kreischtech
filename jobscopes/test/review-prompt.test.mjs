import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {offerPlayReview} from '../public/review-prompt.js';
test('review invitation is optional, dismissible and only offered once',t=>{const d=new JSDOM('<main></main>',{url:'https://example.test'});globalThis.document=d.window.document;globalThis.localStorage=d.window.localStorage;t.after(()=>{delete globalThis.document;delete globalThis.localStorage;d.window.close();});const h=document.querySelector('main');offerPlayReview(h);assert.ok(h.querySelector('a').href.includes('com.kreischtech.contractorsight'));h.querySelector('button').click();offerPlayReview(h);assert.equal(h.children.length,0);});
