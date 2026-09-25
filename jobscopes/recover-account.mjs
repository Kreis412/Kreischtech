// Operator-only recovery. Run on the hosting server after verifying the account owner.
// No HTTP endpoint issues these codes; pilot registration codes cannot reset passwords.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

export function issueRecovery(dataDir, email, now=Date.now()) {
  if(!existsSync(join(dataDir,'accounts.sqlite')))throw new Error('Account database not found. Check DATA_DIR.');
  const db=new DatabaseSync(join(dataDir,'accounts.sqlite'),{open:true});
  try {
    db.exec('PRAGMA busy_timeout=5000;');
    const user=db.prepare('SELECT id FROM users WHERE email=?').get(email.trim().toLowerCase());
    if(!user)throw new Error('No account with that email. Check the address before proceeding.');
    db.exec('CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL); BEGIN IMMEDIATE;');
    try {
      const code=randomBytes(32).toString('base64url');
      db.prepare('DELETE FROM password_resets WHERE user_id=? OR expires<=?').run(user.id,now);
      db.prepare('INSERT INTO password_resets VALUES(?,?,?)').run(createHash('sha256').update(code).digest('hex'),user.id,now+30*60*1000);
      db.exec('COMMIT');return code;
    }catch(e){db.exec('ROLLBACK');throw e;}
  }finally{db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const email=process.argv[2];
  if(!process.env.DATA_DIR||!email) {console.error('Run on the hosting server: node recover-account.mjs your-account-email');process.exitCode=1;}
  else {try {console.log('Private one-use recovery code (expires in 30 minutes):\n'+issueRecovery(process.env.DATA_DIR,email));}catch(e){console.error(e.message);process.exitCode=1;}}
}
