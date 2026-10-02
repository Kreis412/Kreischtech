// Initial project generation only. Commit generated sources; do not regenerate over edits.
const {TwaManifest,TwaGenerator,ConsoleLog}=require('../../.android-tools/node_modules/@bubblewrap/core');
const fs=require('node:fs/promises');
const path=require('node:path');
async function main(){
 const target=path.resolve(__dirname,'../android');
 try{await fs.access(path.join(target,'app/build.gradle'));throw new Error('Android project already exists; refusing to overwrite it.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const manifest=new TwaManifest({
  packageId:'com.kreischtech.contractorsight',host:'contractorsight-pilot.onrender.com',
  name:'ContractorSight',launcherName:'ContractorSight',startUrl:'/?distribution=google-play',
  display:'standalone',themeColor:'#091416',navigationColor:'#091416',backgroundColor:'#091416',
  iconUrl:'https://contractorsight-pilot.onrender.com/app-icon-512.png',
  maskableIconUrl:'https://contractorsight-pilot.onrender.com/app-icon-512.png',
  enableNotifications:false,splashScreenFadeOutDuration:200,
  signingKey:{path:'upload.keystore',alias:'contractorsight'},appVersion:'0.1.0',appVersionCode:1,
  minSdkVersion:23,shortcuts:[],features:{},fallbackType:'customtabs',
  webManifestUrl:'https://contractorsight-pilot.onrender.com/manifest.webmanifest',
  fullScopeUrl:'https://contractorsight-pilot.onrender.com/',generatorApp:'bubblewrap-cli'
 });
 await fs.mkdir(target,{recursive:true});
 await new TwaGenerator().createTwaProject(target,manifest,new ConsoleLog('ContractorSight'));
 await manifest.saveToFile(path.join(target,'twa-manifest.json'));
 console.log('Android project generated. Signing and Play configuration still required.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
