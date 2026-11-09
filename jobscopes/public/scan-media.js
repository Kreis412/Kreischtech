// Media stays on the device until the resulting image bundle is uploaded.
export function sampleTimes(duration){
 if(!Number.isFinite(duration)||duration<=0||duration>120)throw Error('Choose a recording up to two minutes long.');
 return Array.from({length:6},(_,i)=>Math.max(0,duration-.1)*i/5);
}
function ready(media,event,action){return new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>finish(Error('This video could not be read. Try an MP4 recording or screenshots.')),20000);
 function finish(error){clearTimeout(timeout);media.removeEventListener(event,done);media.removeEventListener('error',bad);error?reject(error):resolve();}
 const done=()=>finish(),bad=()=>finish(Error('This video format is not supported on this device. Try MP4 or screenshots.'));
 media.addEventListener(event,done,{once:true});media.addEventListener('error',bad,{once:true});try{action();}catch(e){finish(e);}
 });}
function frame(source,width,height,label){
 if(!width||!height)throw Error('The image or video frame could not be read.');
 const canvas=document.createElement('canvas'),ratio=Math.min(1,1920/Math.max(width,height));canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
 canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
 return {data:canvas.toDataURL('image/jpeg',.9).split(',')[1],label};
}
export async function scanBundle(files,onProgress=()=>{}){
 const video=files.find(f=>f.type.startsWith('video/')||/\.(mp4|mov|webm)$/i.test(f.name));
 if(!files.length||files.length>6)throw Error('Choose up to six screenshots, or one video.');
 if(video){
  if(files.length!==1)throw Error('Import one video at a time, separately from screenshots.');
  if(video.size>100*1024*1024)throw Error('Choose a video smaller than 100 MB.');
  const element=document.createElement('video'),url=URL.createObjectURL(video);element.muted=true;element.playsInline=true;element.preload='auto';
  try{
   await ready(element,'loadeddata',()=>{element.src=url;element.load();});const times=sampleTimes(element.duration),frames=[];
   for(const time of times){onProgress('Reading video frame '+(frames.length+1)+' of 6…');if(Math.abs(element.currentTime-time)>.001)await ready(element,'seeked',()=>{element.currentTime=time;});frames.push(frame(element,element.videoWidth,element.videoHeight,'Video '+time.toFixed(1)+' seconds'));}
   return {source:'video',frames};
  }finally{element.removeAttribute('src');element.load();URL.revokeObjectURL(url);}
 }
 const frames=[];
 for(const file of files){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose JPEG, PNG or WebP screenshots. Import text reports separately.');
  if(file.size>15*1024*1024)throw Error('Each screenshot must be smaller than 15 MB.');
  const img=new Image(),url=URL.createObjectURL(file);
  try{await ready(img,'load',()=>{img.src=url;});frames.push(frame(img,img.naturalWidth,img.naturalHeight,'Screenshot '+(frames.length+1)));}finally{URL.revokeObjectURL(url);}
 }
 return {source:'screenshots',frames};
}
