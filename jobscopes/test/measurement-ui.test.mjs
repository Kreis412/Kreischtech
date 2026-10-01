import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measurementUI} from '../public/measurements.js';
test('measurement editor is brought into view and two taps produce a saved labelled line',async()=>{
 const oldDocument=globalThis.document,oldImage=globalThis.Image;
 globalThis.document={body:{dataset:{role:'Owner'}}};globalThis.Image=class {complete=false;};
 let scrolls=0,focus=0,form,written;
 const nodes={'[data-measure-heading]':{focus:()=>focus++},'[data-measure-status]':{},'[data-measure-list]':{},'[data-cancel-line]':{setAttribute:()=>{}},canvas:{getContext:()=>({}),focus:()=>{},getBoundingClientRect:()=>({left:10,top:20,width:200,height:100})}};
 const host={isConnected:true,scrollIntoView:()=>scrolls++,querySelector:s=>nodes[s]};
 const ui=measurementUI({api:async()=>({lines:[],revision:0}),write:async(path,method,body)=>{written={path,method,body};return {lines:body.lines,revision:1};},esc:String,field:()=>'',selectField:()=>'',openForm:(...args)=>form=args,toast:()=>{}});
 try{
  await ui.mount(host,'project',{id:'photo',name:'Test photo'});
  assert.ok(scrolls>=1);assert.equal(focus,1);
  await host.onclick({target:{closest:()=>({hasAttribute:k=>k==='data-new-line'})}});
  nodes.canvas.onclick({clientX:30,clientY:40});assert.equal(form,undefined);
  nodes.canvas.onclick({clientX:170,clientY:100});assert.equal(form[0],'Measurement label');
  await form[3]({from:'Corner',to:'Stake',distance:'20 ft',kind:'Measured'});
  assert.equal(written.path,'/api/projects/project/photos/photo/measurements');assert.equal(written.method,'PUT');
  assert.deepEqual(written.body.lines[0],{from:'Corner',to:'Stake',distance:'20 ft',kind:'Measured',a:{x:.1,y:.2},b:{x:.8,y:.8}});
 }finally{globalThis.document=oldDocument;globalThis.Image=oldImage;}
});
