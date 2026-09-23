import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {encryptBackup,decryptBackup} from './security.mjs';
// Offline full-installation archive: stop the service before calling.
export async function backupInstallation(source,output,password){
 const root=resolve(source),files=[];
 if(!existsSync(join(root,'accounts.sqlite')))throw new Error('Accounts database missing.');
 function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){
  if(entry.isSymbolicLink())throw new Error('Symbolic links are not supported.');
  const path=join(dir,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile())files.push({path:relative(root,path).replaceAll('\\','/'),data:readFileSync(path).toString('base64')});
 }}
 const destination=resolve(output);if(destination===root||destination.startsWith(root+'/')||destination.startsWith(root+'\\'))throw new Error('Save the archive outside the data directory.');
 walk(root);const plain=Buffer.from(JSON.stringify({format:'contractorsight-installation-v1',files}));
 try{writeFileSync(destination,await encryptBackup(plain,password),{flag:'wx',mode:0o600});}finally{plain.fill(0);}
 return files.length;
}
export async function restoreInstallation(archive,destination,password){
 const root=resolve(destination);if(existsSync(root))throw new Error('Restore requires a new directory.');
 const bytes=await decryptBackup(readFileSync(archive),password);let manifest;
 try{manifest=JSON.parse(bytes.toString());}finally{bytes.fill(0);}
 if(manifest.format!=='contractorsight-installation-v1'||!Array.isArray(manifest.files))throw new Error('Invalid installation archive.');
 const seen=new Set();for(const file of manifest.files){
  if(typeof file.path!=='string'||!file.path||file.path.includes('\\')||file.path.includes(':')||isAbsolute(file.path)||file.path.split('/').some(p=>!p||p==='.'||p==='..')||seen.has(file.path.toLowerCase())||typeof file.data!=='string')throw new Error('Unsafe archive entry.');
  seen.add(file.path.toLowerCase());
 }
 if(!seen.has('accounts.sqlite'))throw new Error('Archive has no accounts database.');
 mkdirSync(root);for(const file of manifest.files){const parts=file.path.split('/');parts.pop();if(parts.length)mkdirSync(join(root,...parts),{recursive:true});writeFileSync(join(root,file.path),Buffer.from(file.data,'base64'),{flag:'wx',mode:0o600});}
 return manifest.files.length;
}
