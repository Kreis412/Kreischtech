import {backupInstallation,restoreInstallation} from './installation-backup.mjs';
const [mode,source,destination,confirmation]=process.argv.slice(2);
if(!['backup','restore'].includes(mode)||!source||!destination||confirmation!=='--service-stopped'){
 console.error('Stop the service first. Usage: node backup-installation.mjs backup|restore source destination --service-stopped. Supply BACKUP_PASSPHRASE privately in the environment.');process.exit(1);
}
const password=process.env.BACKUP_PASSPHRASE;delete process.env.BACKUP_PASSPHRASE;
try{const count=await(mode==='backup'?backupInstallation:restoreInstallation)(source,destination,password);console.log(`${mode} complete: ${count} files. Keep the archive off-device and its passphrase separately.`);}catch(e){console.error(e.message);process.exitCode=1;}
