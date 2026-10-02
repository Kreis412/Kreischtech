// Local upload signing. Never prints or commits the password.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../android');
const java=process.env.JAVA_HOME;
if(!java)throw new Error('Set JAVA_HOME to Java 17 before signing.');
const key=path.join(root,'upload.keystore');
const properties=path.join(root,'signing.properties');
function run(command,args,env=process.env){const r=spawnSync(path.join(java,'bin',command+'.exe'),args,{env,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout);return r.stdout;}
if(!fs.existsSync(key)){
 if(fs.existsSync(properties))throw new Error('Signing settings exist without a key. Restore the key before continuing.');
 const password=crypto.randomBytes(32).toString('hex');
 fs.writeFileSync(properties,'password='+password+'\n',{flag:'wx',mode:0o600});
 run('keytool',['-genkeypair','-keystore',key,'-storetype','JKS','-alias','contractorsight','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=ContractorSight, O=KreischTech, C=US','-storepass:env','CS_SIGN_PASS','-keypass:env','CS_SIGN_PASS'],{...process.env,CS_SIGN_PASS:password});
}
const password=fs.readFileSync(properties,'utf8').trim().replace(/^password=/,'');
const source=path.join(root,'app/build/outputs/bundle/release/app-release.aab');
const target=path.join(root,'app/build/outputs/bundle/release/contractorsight-0.1.0.aab');
run('jarsigner',['-keystore',key,'-storepass:env','CS_SIGN_PASS','-keypass:env','CS_SIGN_PASS','-signedjar',target,source,'contractorsight'],{...process.env,CS_SIGN_PASS:password});
console.log(run('jarsigner',['-verify',target]));
console.log('Signed bundle: '+target);
