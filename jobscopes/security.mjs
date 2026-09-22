import { randomBytes, scrypt, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const derive = promisify(scrypt);
const MAGIC = Buffer.from('JOBSCOPE1');
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 256) throw Object.assign(new Error('Use a backup passphrase of 16–256 characters.'), {status:400});
}
export async function encryptBackup(bytes, password) {
  checkPassword(password);
  const salt=randomBytes(16), iv=randomBytes(12), header=Buffer.concat([MAGIC,salt,iv]);
  const key=await derive(password,salt,32,options);
  try {
    const cipher=createCipheriv('aes-256-gcm',key,iv,{authTagLength:16});
    cipher.setAAD(header);
    const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
    return Buffer.concat([header,cipher.getAuthTag(),encrypted]);
  } finally { key.fill(0); }
}
export async function decryptBackup(bytes,password) {
  checkPassword(password);
  if(bytes.length<69 || !bytes.subarray(0,9).equals(MAGIC)) throw new Error('Unsupported or damaged ContractorSight backup.');
  const key=await derive(password,bytes.subarray(9,25),32,options);
  try {
    const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(25,37),{authTagLength:16});
    decipher.setAAD(bytes.subarray(0,37)); decipher.setAuthTag(bytes.subarray(37,53));
    return Buffer.concat([decipher.update(bytes.subarray(53)),decipher.final()]);
  } catch { throw new Error('Backup could not be unlocked. The passphrase is incorrect or the file is damaged.'); }
  finally { key.fill(0); }
}
export async function exportBackup(db,dataDir,password) {
  checkPassword(password);
  const temp=mkdtempSync(join(dataDir,'.backup-'));
  const file=join(temp,'snapshot.sqlite');
  try {
    db.exec(`VACUUM INTO '${file.replaceAll("'","''")}'`);
    const bytes=readFileSync(file);
    try { return await encryptBackup(bytes,password); } finally { bytes.fill(0); }
  } finally { rmSync(temp,{recursive:true,force:true}); }
}
export async function restoreBackup(file,destination,password) {
  // Never replace an existing directory or a running workspace.
  const bytes=await decryptBackup(readFileSync(file),password);
  if(bytes.subarray(0,16).toString() !== 'SQLite format 3\0') { bytes.fill(0); throw new Error('Backup does not contain a SQLite database.'); }
  const target=resolve(destination);
  mkdirSync(target,{recursive:false});
  const output=join(target,'contractoros.sqlite');
  try {
    writeFileSync(output,bytes,{flag:'wx',mode:0o600});
    const db=new DatabaseSync(output,{readOnly:true});
    try {
      if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok') throw new Error('Restored database failed integrity verification.');
      for(const table of ['projects','photos','discoveries','material_items','cash_entries']) db.prepare(`SELECT count(*) FROM ${table}`).get();
    } finally { db.close(); }
    return target;
  } catch(e) { rmSync(target,{recursive:true,force:true}); throw e; }
  finally { bytes.fill(0); }
}

export function guardLocalRequest(req) {
  const deny=()=>{throw Object.assign(new Error('Only direct access from this computer is enabled. Use http://localhost with the running app port.'),{status:403});};
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) deny();
  const allowed=new Set([`localhost:${req.socket.localPort}`,`127.0.0.1:${req.socket.localPort}`,`[::1]:${req.socket.localPort}`]);
  if(!allowed.has(req.headers.host?.toLowerCase())) deny();
  if(req.headers.forwarded || req.headers['x-forwarded-host'] || req.headers['x-forwarded-for'] || req.headers['x-forwarded-proto']) deny();
}
