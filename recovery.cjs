const crypto=require('node:crypto');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const error=(status,message)=>{throw Object.assign(new Error(message),{status});};
function contacts(input){
  const email=String(input.email||'').trim().toLowerCase(),raw=String(input.phone||'').trim();
  let phone=raw.replace(/[\s()\-]/g,'');if(phone.startsWith('00'))phone='+'+phone.slice(2);if(/^05\d{9}$/.test(phone))phone='+90'+phone.slice(1);
  if(email&&(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)))error(400,'Geçerli bir e-posta adresi girin.');
  if(phone&&!/^\+[1-9]\d{7,14}$/.test(phone))error(400,'Telefonu ülke koduyla girin. Örnek: +905321234567');
  return{email,phone};
}
function createRecovery({db,options,limited,passwordHash,audit,transaction,endSessions}){
  const columns=new Set(db.prepare('PRAGMA table_info(users)').all().map(c=>c.name));
  for(const name of ['email','phone'])if(!columns.has(name))db.exec(`ALTER TABLE users ADD COLUMN ${name} TEXT NOT NULL DEFAULT ''`);
  db.exec('CREATE TABLE IF NOT EXISTS password_recovery(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),code_hash TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0)');
  const serviceUrl=process.env.RESET_DELIVERY_URL,serviceToken=process.env.RESET_DELIVERY_TOKEN;
  const delivery=options.recoveryDelivery||(serviceUrl&&serviceToken?async message=>{
    const url=new URL(serviceUrl);if(url.protocol!=='https:')throw Error('Recovery service must use HTTPS');
    const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+serviceToken,'Content-Type':'application/json'},body:JSON.stringify({...message,purpose:'ulak-password-reset'})});
    if(!response.ok)throw Error('Recovery delivery failed');
  }:null);
  const configured=new Set(options.recoveryChannels||String(process.env.RESET_CHANNELS||'').split(',').map(s=>s.trim()));
  const channels={email:!!delivery&&configured.has('email'),sms:!!delivery&&configured.has('sms')};
  const invalidate=id=>db.prepare('DELETE FROM password_recovery WHERE user_id=?').run(id);
  async function request(input,ip){
    limited('recovery-ip:'+ip,6,15*60000);
    const username=String(input.username||'').trim().toLowerCase();
    if(!/^[a-z0-9._-]{3,40}$/.test(username))error(400,'Kullanıcı adınızı kontrol edin.');
    if(!['email','sms'].includes(input.channel))error(400,'E-posta veya SMS seçin.');
    if(!channels[input.channel])error(503,'Bu gönderim yöntemi henüz etkinleştirilmedi. Bilgi İşlem Müdürlüğü ile iletişime geçin.');
    limited('recovery-user:'+username,3,15*60000);
    db.prepare('DELETE FROM password_recovery WHERE expires<=?').run(Date.now());
    const id=crypto.randomBytes(24).toString('hex'),code=String(crypto.randomInt(100000,1000000)),expires=Date.now()+10*60000;
    const user=db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username),to=user?.[input.channel==='email'?'email':'phone'];
    if(user&&to){
      transaction(()=>{invalidate(user.id);db.prepare('INSERT INTO password_recovery(id,user_id,code_hash,expires) VALUES(?,?,?,?)').run(id,user.id,digest(id+':'+code),expires);});
      // Deliver after responding so account existence cannot be inferred from provider latency.
      setImmediate(()=>Promise.resolve().then(()=>delivery({channel:input.channel,to,code,expiresAt:new Date(expires).toISOString()})).catch(()=>{if(db.isOpen){db.prepare('DELETE FROM password_recovery WHERE id=?').run(id);audit(null,'recovery_delivery_failed',user.id);}}));
    }
    return{requestId:id,message:'Hesabınız ve kayıtlı iletişim bilginiz uygunsa doğrulama kodu gönderilecektir. Kod 10 dakika geçerlidir.'};
  }
  async function confirm(input,ip){
    limited('recovery-confirm:'+ip,20,15*60000);
    const id=String(input.requestId||''),code=String(input.code||''),generic='Kod hatalı, süresi dolmuş veya kullanılmış. Yeni kod isteyin.';
    if(!/^[a-f0-9]{48}$/.test(id)||!/^\d{6}$/.test(code))error(400,generic);
    let row=db.prepare('SELECT r.* FROM password_recovery r JOIN users u ON u.id=r.user_id WHERE r.id=? AND u.active=1').get(id);
    if(!row||row.expires<=Date.now()||row.attempts>=5)error(400,generic);
    db.prepare('UPDATE password_recovery SET attempts=attempts+1 WHERE id=?').run(id);
    if(!crypto.timingSafeEqual(Buffer.from(row.code_hash,'hex'),Buffer.from(digest(id+':'+code),'hex')))error(400,generic);
    const password=await passwordHash(input.password);
    transaction(()=>{
      const fresh=db.prepare('SELECT r.* FROM password_recovery r JOIN users u ON u.id=r.user_id WHERE r.id=? AND u.active=1').get(id);
      if(!fresh||fresh.expires<=Date.now()||fresh.attempts>5||fresh.code_hash!==row.code_hash)error(400,generic);
      db.prepare('UPDATE users SET password=?,must_change=0 WHERE id=?').run(password,row.user_id);
      invalidate(row.user_id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);audit(row.user_id,'password_recovered',row.user_id);
    });
    endSessions(row.user_id);return{ok:true};
  }
  return{channels,request,confirm,invalidate};
}
module.exports={createRecovery,contacts};
