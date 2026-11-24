const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'..','smtp.env');if(fs.existsSync(file))process.loadEnvFile(file);
const {createSmtpMailer}=require('../smtp-mail.cjs');
(async()=>{
  const mail=createSmtpMailer();if(!mail)throw Error('SMTP kapalı. Sunucudaki smtp.env dosyasını doldurup SMTP_ENABLED=1 yapın.');
  await mail.verify();console.log('SMTP bağlantısı ve hesap doğrulaması başarılı. Test e-postası gönderilmedi.');
})().catch(()=>{console.error('SMTP doğrulanamadı. Sunucu, port, hesap, parola ve TLS ayarlarını kurum BT biriminizle kontrol edin.');process.exitCode=1;});
