export function securityUI({api,esc}) {
  return { async mount(host) {
    const status=await api('/api/security');
    if(location.hash!=='#security') return;
    host.innerHTML=`<section class="page-heading"><div><div class="eyebrow">Protect the work behind the work.</div><h1>Security & backups</h1><p>A local security foundation. Hosted customer accounts are still in development.</p></div></section>
      <div class="company-metrics"><article class="company-metric"><span>Network access</span><strong>${esc(status.access)}</strong><small>Unexpected hostnames and forwarded requests are rejected.</small></article><article class="company-metric"><span>Workspace sign-in</span><strong>${status.authentication?'Sign-in enabled':'Not yet enabled'}</strong><small>Company membership is checked on each request. Local disk access still requires operating-system protection.</small></article><article class="company-metric"><span>Live database encryption</span><strong>Not enabled</strong><small>Protect this computer with your operating system’s login and disk encryption.</small></article></div>
      <section class="panel"><h2>Download an encrypted backup</h2><p>Includes all saved projects, original photos, discoveries, estimates and money records. Choose a unique passphrase and keep it in your password manager. A lost passphrase cannot be recovered.</p>
      <form id="backup-form"><div class="form-grid"><label>Backup passphrase<input type="password" name="password" autocomplete="new-password" minlength="16" maxlength="256" required></label><label>Repeat passphrase<input type="password" name="confirm" autocomplete="new-password" minlength="16" maxlength="256" required></label></div><p class="notice">Use at least 16 characters, such as several unrelated words. The passphrase is used for this download and is not saved by JobScopes. Existing backup copies are not changed or encrypted.</p><button class="primary" type="submit">Download encrypted backup</button><p id="backup-status" role="status" aria-live="polite"></p></form></section>
      <section class="panel"><h2>Restore without overwriting your work</h2><p>The restore utility checks the passphrase, file integrity and database before making a recovered workspace available. It restores only into a new folder. Follow SECURITY_GUIDE.md in the app folder for the steps.</p><p class="notice">Backups are manual. Keep a copy somewhere separate from this laptop. This preview isolates company workspaces, but does not provide cloud backup, customer accounts, or public hosting. Phone/LAN access is disabled until secure sign-in and HTTPS are ready.</p></section>`;
    if(!status.encryptedBackups){host.querySelector('#backup-form').innerHTML='<p>Only your company owner can export backups.</p>';return;}
    const form=host.querySelector('#backup-form'), message=host.querySelector('#backup-status');
    form.onsubmit=async e=>{
      e.preventDefault(); const values=new FormData(form), button=form.querySelector('button');
      if(values.get('password')!==values.get('confirm')) {message.textContent='The passphrases do not match.';return;}
      button.disabled=true;message.textContent='Preparing your protected backup…';
      try {
        const response=await fetch('/api/security/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:values.get('password')})});
        if(!response.ok) throw new Error((await response.json()).error || 'Backup failed.');
        const url=URL.createObjectURL(await response.blob()), link=document.createElement('a');
        link.href=url;link.download=`JobScopes-${new Date().toISOString().replaceAll(':','-')}.jobscopes`;link.textContent='Save backup file';
        form.reset();message.textContent='Encrypted backup prepared. Check your downloads, or use this link: ';message.append(link);link.click();
        setTimeout(()=>{URL.revokeObjectURL(url);link.removeAttribute('href');link.textContent='Download link expired. Prepare another backup if needed.';},300000);
      } catch(e) {message.textContent=e.message;}
      finally {button.disabled=false;}
    };
  }};
}
