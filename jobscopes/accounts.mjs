import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { join } from 'node:path';

const derive=promisify(scrypt), hash=s=>createHash('sha256').update(s).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const label=(s,max=120)=>typeof s==='string' && s.trim().length>0 && s.trim().length<=max ? s.trim() : fail(400,'Enter a valid name.');
const email=s=>typeof s==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length<=254 ? s.trim().toLowerCase() : fail(400,'Enter a valid email address.');
const password=s=>typeof s==='string' && s.length>=16 && s.length<=256 ? s : fail(400,'Use a password of 16–256 characters.');
const kdf={N:32768,r:8,p:1,maxmem:64*1024*1024};
const SESSION_MS=8*60*60*1000;
export function accounts(dataDir,{secureCookies=false,registrationCode=null}={}) {
  const db=new DatabaseSync(join(dataDir,'accounts.sqlite'));
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS memberships(user_id TEXT REFERENCES users(id),company_id TEXT REFERENCES companies(id),role TEXT NOT NULL,PRIMARY KEY(user_id,company_id));
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),company_id TEXT REFERENCES companies(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invites(token_hash TEXT PRIMARY KEY,company_id TEXT REFERENCES companies(id),email TEXT NOT NULL,role TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,company_id TEXT,actor_id TEXT,action TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS memberships_company ON memberships(company_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
    CREATE INDEX IF NOT EXISTS sessions_membership ON sessions(company_id,user_id);
    CREATE INDEX IF NOT EXISTS audit_company ON audit(company_id,id);`);
  function transaction(fn) {db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
  const audit=(company,user,action)=>db.prepare('INSERT INTO audit(company_id,actor_id,action,created_at) VALUES(?,?,?,?)').run(company,user,action,new Date().toISOString());
  function limit(key) {
    const now=Date.now();db.prepare('DELETE FROM attempts WHERE expires<?').run(now);
    const r=db.prepare('SELECT * FROM attempts WHERE key=?').get(key);
    if(r && r.count>=10) fail(429,'Too many attempts. Try again in 15 minutes.');
    db.prepare('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+15*60*1000);
  }
  function cookie(req) {return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('jobscopes_session='))?.slice(18)||'';}
  function session(req) {
    db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    return db.prepare(`SELECT s.token_hash,s.user_id,s.company_id,m.role,u.name,u.email,c.name company_name
      FROM sessions s JOIN users u ON u.id=s.user_id JOIN companies c ON c.id=s.company_id
      JOIN memberships m ON m.user_id=s.user_id AND m.company_id=s.company_id WHERE s.token_hash=?`).get(hash(cookie(req)));
  }
  function issue(req,res,user,company) {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(cookie(req)));
    const token=randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token),user,company,Date.now()+SESSION_MS);
    res.setHeader('Set-Cookie',`jobscopes_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS/1000}${secureCookies?'; Secure':''}`);
  }
  const requireOwner=s=>{if(s.role!=='Owner') fail(403,'Only the company owner can manage access.');};
  async function handle(req,url,json,send,res) {
    const path=url.pathname;
    if(!path.startsWith('/api/account/')) return false;
    if(req.method==='GET' && path==='/api/account/session') {const s=session(req);send(200,s?{user:{name:s.name,email:s.email},company:{id:s.company_id,name:s.company_name,role:s.role},companies:db.prepare('SELECT c.id,c.name,m.role FROM companies c JOIN memberships m ON m.company_id=c.id WHERE m.user_id=? ORDER BY c.name').all(s.user_id)}:{user:null});return true;}
    if(req.method==='POST' && ['/api/account/register','/api/account/login'].includes(path)) {
      limit('auth:'+req.socket.remoteAddress);
      const b=await json(req), mail=email(b.email), pass=password(b.password);
      if(path.endsWith('/register')) {
        if(registrationCode!==null && (!registrationCode || typeof b.registration_code!=='string' || !timingSafeEqual(Buffer.from(hash(b.registration_code)),Buffer.from(hash(registrationCode))))) fail(403,'Registration requires a valid private pilot code.');
        const name=label(b.name), company=label(b.company);const salt=randomBytes(16).toString('hex');
        const key=await derive(pass,salt,32,kdf);
        const id=randomUUID(),companyId=randomUUID();
        try {transaction(()=>{
          if(db.prepare('SELECT id FROM users WHERE email=?').get(mail)) fail(409,'This account cannot be created. Try signing in.');
          db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,mail,name,salt,key.toString('hex'));
          db.prepare('INSERT INTO companies VALUES(?,?)').run(companyId,company);
          db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(id,companyId,'Owner');audit(companyId,id,'company.created');
        });}finally{key.fill(0);}
        issue(req,res,id,companyId);send(201,{saved:true});return true;
      }
      const user=db.prepare('SELECT * FROM users WHERE email=?').get(mail);
      const key=await derive(pass,user?.salt||'00000000000000000000000000000000',32,kdf);
      const valid=timingSafeEqual(key,Buffer.from(user?.password_hash||'00'.repeat(32),'hex'));key.fill(0);
      if(!user || !valid) fail(401,'Email or password is incorrect.');
      const membership=db.prepare('SELECT company_id FROM memberships WHERE user_id=? ORDER BY company_id LIMIT 1').get(user.id);
      if(!membership) fail(403,'This account has no active company membership.');
      issue(req,res,user.id,membership.company_id);audit(membership.company_id,user.id,'session.login');send(200,{saved:true});return true;
    }
    const s=session(req);if(!s) fail(401,'Sign in to continue.');
    if(req.method==='POST' && path==='/api/account/logout') {
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(s.token_hash);res.setHeader('Set-Cookie',`jobscopes_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies?'; Secure':''}`);send(200,{saved:true});return true;
    }
    if(req.method==='POST' && path==='/api/account/switch') {
      const b=await json(req);if(!db.prepare('SELECT 1 FROM memberships WHERE user_id=? AND company_id=?').get(s.user_id,String(b.company_id))) fail(403,'No access to this company.');
      issue(req,res,s.user_id,b.company_id);send(200,{saved:true});return true;
    }
    if(req.method==='POST' && path==='/api/account/companies') {
      const b=await json(req),name=label(b.name),id=randomUUID();
      transaction(()=>{db.prepare('INSERT INTO companies VALUES(?,?)').run(id,name);db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(s.user_id,id,'Owner');audit(id,s.user_id,'company.created');});
      issue(req,res,s.user_id,id);send(201,{saved:true});return true;
    }
    if(req.method==='POST' && path==='/api/account/join') {
      const b=await json(req);transaction(()=>{
        const inv=db.prepare('SELECT * FROM invites WHERE token_hash=? AND expires>?').get(hash(String(b.code)),Date.now());
        if(!inv || inv.email!==s.email) fail(400,'Invitation is invalid, expired, or for another email.');
        if(db.prepare('SELECT 1 FROM memberships WHERE user_id=? AND company_id=?').get(s.user_id,inv.company_id)) fail(409,'Already a member of this company.');
        db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(s.user_id,inv.company_id,inv.role);
        db.prepare('DELETE FROM invites WHERE token_hash=?').run(hash(b.code));audit(inv.company_id,s.user_id,'invitation.accepted');
      });send(200,{saved:true});return true;
    }
    if(req.method==='GET' && path==='/api/account/team') {
      requireOwner(s);send(200,{members:db.prepare('SELECT u.id,u.name,u.email,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.company_id=? ORDER BY u.name').all(s.company_id),audit:db.prepare('SELECT action,created_at FROM audit WHERE company_id=? ORDER BY id DESC LIMIT 30').all(s.company_id)});return true;
    }
    if(req.method==='POST' && path==='/api/account/invites') {
      requireOwner(s);const b=await json(req),mail=email(b.email);if(!['Manager','Viewer'].includes(b.role)) fail(400,'Choose Manager or Viewer.');
      const code=randomBytes(32).toString('base64url');db.prepare('INSERT INTO invites VALUES(?,?,?,?,?)').run(hash(code),s.company_id,mail,b.role,Date.now()+48*60*60*1000);audit(s.company_id,s.user_id,'invitation.created');
      send(201,{code,expires_in_hours:48});return true;
    }
    if(req.method==='PUT' && path==='/api/account/member') {
      requireOwner(s);const b=await json(req);if(!['Manager','Viewer','Removed'].includes(b.role)) fail(400,'Choose a valid role.');
      const member=db.prepare('SELECT role FROM memberships WHERE company_id=? AND user_id=?').get(s.company_id,String(b.user_id));
      if(!member || member.role==='Owner') fail(403,'The owner cannot be changed here.');
      transaction(()=>{
        if(b.role==='Removed') {
          db.prepare('DELETE FROM memberships WHERE company_id=? AND user_id=?').run(s.company_id,b.user_id);
          db.prepare('DELETE FROM invites WHERE company_id=? AND email=(SELECT email FROM users WHERE id=?)').run(s.company_id,b.user_id);
        }
        else db.prepare('UPDATE memberships SET role=? WHERE company_id=? AND user_id=?').run(b.role,s.company_id,b.user_id);
        db.prepare('DELETE FROM sessions WHERE company_id=? AND user_id=?').run(s.company_id,b.user_id);audit(s.company_id,s.user_id,'membership.changed');
      });send(200,{saved:true});return true;
    }
    fail(404,'Account action not found.');
  }
  return {session,handle,close:()=>db.close()};
}
