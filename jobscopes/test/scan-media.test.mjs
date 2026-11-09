import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleTimes,scanBundle} from '../public/scan-media.js';
test('video samples span recording and reject unsupported duration and input counts',async()=>{
 const times=sampleTimes(60);assert.equal(times.length,6);assert.equal(times[0],0);assert.equal(times[5],59.9);
 for(const duration of [0,Infinity,NaN,121])assert.throws(()=>sampleTimes(duration));
 await assert.rejects(scanBundle([]));await assert.rejects(scanBundle(Array(7).fill({type:'image/png',name:'x'})));
 await assert.rejects(scanBundle([{type:'video/mp4',name:'x.mp4',size:101*1024*1024}]));
});
