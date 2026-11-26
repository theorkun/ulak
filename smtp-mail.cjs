// Server-only mail transport. Credentials never enter the static Pages build.
function createSmtpMailer(env=process.env,createTransport){
  if(env.SMTP_ENABLED!=='1')return null;
  const required=['SMTP_HOST','SMTP_USER','SMTP_PASSWORD','SMTP_FROM'];
  if(required.some(key=>!env[key]))throw Error('SMTP_ENABLED=1 için SMTP_HOST, SMTP_USER, SMTP_PASSWORD ve SMTP_FROM gerekli.');
  const port=Number(env.SMTP_PORT||587),host=env.SMTP_HOST.trim(),user=env.SMTP_USER.trim(),from=env.SMTP_FROM.trim();
  const address=value=>typeof value==='string'&&value.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
  if(!/^[a-zA-Z0-9.-]+$/.test(host)||!host.length||!Number.isInteger(port)||port<1||port>65535||/[\r\n]/.test(user)||!address(from))throw Error('SMTP sunucu, port veya gönderen ayarı geçersiz.');
  const transport=(createTransport||require('nodemailer').createTransport)({
    host,port,secure:port===465,requireTLS:port!==465,
    auth:{user,pass:env.SMTP_PASSWORD},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},
    connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,dnsTimeout:8000,
    disableFileAccess:true,disableUrlAccess:true,maxRecipients:1,logger:false,debug:false
  });
  return{
    verify:()=>transport.verify(),
    async send(message){
      if(message.channel!=='email'||!address(message.to)||!/^\d{6}$/.test(message.code))throw Error('Geçersiz parola yenileme iletisi.');
      const result=await transport.sendMail({
        from:{name:'Sarıçam Belediyesi · Turkuaz Kurumsal İletişim',address:from},to:{address:message.to},
        subject:'Turkuaz Kurumsal İletişim parola yenileme kodunuz',
        text:`Turkuaz Kurumsal İletişim parola yenileme kodunuz: ${message.code}\n\nBu kod 10 dakika geçerlidir ve yalnızca bir kez kullanılabilir.\nKodu kimseyle paylaşmayın. Parola yenileme talebini siz oluşturmadıysanız bu iletiyi dikkate almayın; hesabınızın parolası değiştirilmemiştir.\n\nSarıçam Belediyesi · Turkuaz Kurumsal İletişim`,
        disableFileAccess:true,disableUrlAccess:true
      });
      if(!result.accepted?.length||result.rejected?.length)throw Error('E-posta sunucusu iletiyi kabul etmedi.');
    }
  };
}
module.exports={createSmtpMailer};
