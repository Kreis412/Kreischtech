import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measurementUI} from '../public/measurements.js';
test('measurement editor is brought into view and two taps produce a saved labelled line',async()=>{
 const oldDocument=globalThis.document,oldImage=globalThis.Image;
 globalThis.document={body:{dataset:{role:'Owner'}}};globalThis.Image=class {complete=false;};
 let scrolls=0,focus=0,form,written;
 const nodes={'[data-measure-heading]':{focus:()=>focus++},'[data-measure-status]':{},'[data-measure-list]':{},'[data-cancel-line]':{setAttribute:()=>{}},canvas:{style:{},setPointerCapture:()=>{},hasPointerCapture:()=>false,getContext:()=>({}),focus:()=>{},getBoundingClientRect:()=>({left:10,top:20,width:200,height:100})}};
 const host={isConnected:true,scrollIntoView:()=>scrolls++,querySelector:s=>nodes[s]};
 const ui=measurementUI({api:async()=>({lines:[],revision:0}),write:async(path,method,body)=>{written={path,method,body};return {lines:body.lines,revision:1};},esc:String,field:()=>'',selectField:()=>'',openForm:(...args)=>form=args,toast:()=>{}});
 try{
  await ui.mount(host,'project',{id:'photo',name:'Test photo'});
  assert.ok(scrolls>=1);assert.equal(focus,1);
  await host.onclick({target:{closest:()=>({hasAttribute:k=>k==='data-new-line'})}});
  const tap=(x,y)=>{const e={clientX:x,clientY:y,pointerId:1,button:0,preventDefault:()=>{}};nodes.canvas.onpointerdown(e);nodes.canvas.onpointerup(e);};tap(30,40);assert.equal(form,undefined);
  tap(170,100);assert.equal(form[0],'Measurement label');
  await form[3]({from:'Corner',to:'Stake',distance:'20 ft',kind:'Measured'});
  await host.onclick({target:{closest:()=>({hasAttribute:k=>k==='data-new-line'})}});
  const event=(x,y)=>({clientX:x,clientY:y,pointerId:2,button:0,preventDefault:()=>{}});
  nodes.canvas.onpointerdown(event(30,40));nodes.canvas.onpointermove(event(170,100));nodes.canvas.onpointerup(event(170,100));
  await form[3]({from:'',to:'',distance:'10 ft',kind:'Measured'});
  assert.equal(written.body.lines[1].from,'');assert.equal(written.body.lines[1].distance,'10 ft');
  assert.equal(written.path,'/api/projects/project/photos/photo/measurements');assert.equal(written.method,'PUT');
  assert.deepEqual(written.body.lines[0],{from:'Corner',to:'Stake',distance:'20 ft',kind:'Measured',a:{x:.1,y:.2},b:{x:.8,y:.8}});
 }finally{globalThis.document=oldDocument;globalThis.Image=oldImage;}
});
