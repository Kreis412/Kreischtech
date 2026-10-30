import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const ANALYSES_PER_REDEMPTION=5;

export function analysisPromos(dataDir,{credits,code='',maxRedemptions=5,now=()=>Date.now()}={}) {
  if(!credits||typeof credits.grant!=='function'||typeof credits.balance!=='function')throw new TypeError('A credit ledger is required.');
  const db=new DatabaseSync(join(dataDir,'analysis-promos.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS redemptions(
      code_hash TEXT NOT NULL,
      company_id TEXT NOT NULL,
      grant_id TEXT NOT NULL,
      redeemed_at INTEGER NOT NULL,
      PRIMARY KEY(code_hash,company_id)
    );
    CREATE INDEX IF NOT EXISTS promo_redemptions_code ON redemptions(code_hash);`);
  const configured=typeof code==='string'?code.trim().toUpperCase():'';
  const enabled=/^[A-Z0-9-]{8,80}$/.test(configured);
  const cap=Number.isSafeInteger(maxRedemptions)&&maxRedemptions>0&&maxRedemptions<=100?maxRedemptions:5;
  const digest=value=>createHash('sha256').update(value).digest('hex');
  function status(){return {enabled,analyses_each:ANALYSES_PER_REDEMPTION};}
  function redeem(company,rawCode) {
    if(!enabled)fail(503,'Photo-analysis promo codes are not available right now.');
    if(typeof company!=='string'||!company.trim()||company.length>250)fail(400,'A signed-in business profile is required.');
    if(typeof rawCode!=='string'||rawCode.trim().length<8||rawCode.trim().length>80)fail(400,'Enter a valid promo code.');
    const supplied=rawCode.trim().toUpperCase();
    if(!/^[A-Z0-9-]+$/.test(supplied))fail(400,'That promo code could not be verified.');
    const expectedHash=digest(configured),suppliedHash=digest(supplied);
    if(!timingSafeEqual(Buffer.from(expectedHash,'hex'),Buffer.from(suppliedHash,'hex')))fail(400,'That promo code could not be verified.');
    const prior=db.prepare('SELECT grant_id FROM redemptions WHERE code_hash=? AND company_id=?').get(expectedHash,company);
    if(prior)return {redeemed:false,already_redeemed:true,analyses_added:0,balance:credits.balance(company),message:'This business has already used this promo code.'};
    const redeemed=db.prepare('SELECT count(*) n FROM redemptions WHERE code_hash=?').get(expectedHash).n;
    if(redeemed>=cap)fail(409,'This promo offer has been fully redeemed.');
    const grantId='promo-'+expectedHash.slice(0,32)+'-'+digest(company).slice(0,32);
    credits.grant({id:grantId,company,kind:'analysis',amount:ANALYSES_PER_REDEMPTION,expires:Number.MAX_SAFE_INTEGER,reason:'Five photo analyses from a promo code'});
    db.prepare('INSERT INTO redemptions(code_hash,company_id,grant_id,redeemed_at) VALUES(?,?,?,?)').run(expectedHash,company,grantId,now());
    return {redeemed:true,already_redeemed:false,analyses_added:ANALYSES_PER_REDEMPTION,balance:credits.balance(company),message:'Five photo analyses were added to your business.'};
  }
  return {status,redeem,close:()=>db.close()};
}
