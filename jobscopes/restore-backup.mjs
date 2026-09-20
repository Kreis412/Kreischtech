import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { restoreBackup } from './security.mjs';

const [file,destination]=process.argv.slice(2);
if(!file || !destination || !process.stdin.isTTY) {
  console.error('Run in an interactive terminal: node restore-backup.mjs "backup.jobscopes" "new-folder"');
  process.exitCode=1;
} else {
  const silent=new Writable({write(chunk,encoding,callback){callback();}});
  const reader=createInterface({input:process.stdin,output:silent,terminal:true});
  process.stdout.write('Backup passphrase (hidden): ');
  reader.question('',async password=>{
    reader.close();process.stdout.write('\n');
    try {console.log(`Verified restored workspace: ${await restoreBackup(file,destination,password)}`);}
    catch(e){console.error(e.message);process.exitCode=1;}
  });
  reader.on('SIGINT',()=>{reader.close();process.exitCode=1;});
}
