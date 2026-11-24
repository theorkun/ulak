const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSmtpMailer}=require('../smtp-mail.cjs');
const config={SMTP_ENABLED:'1',SMTP_HOST:'smtp.example.invalid',SMTP_PORT:'587',SMTP_USER:'ulak@example.invalid',SMTP_PASSWORD:'test-only-secret',SMTP_FROM:'ulak@example.invalid'};
test('SMTP stays disabled until explicitly configured and requires encrypted transport',async()=>{
  assert.equal(createSmtpMailer({}),null);assert.throws(()=>createSmtpMailer({SMTP_ENABLED:'1'}));
  let settings,mail,verified=false;
  const sender=createSmtpMailer(config,options=>{settings=options;return{verify:async()=>{verified=true;},sendMail:async input=>{mail=input;return{accepted:['person@example.invalid'],rejected:[]};}};});
  assert.equal(settings.secure,false);assert.equal(settings.requireTLS,true);assert.equal(settings.tls.rejectUnauthorized,true);assert.equal(settings.debug,false);
  await sender.verify();assert.equal(verified,true);
  await sender.send({channel:'email',to:'person@example.invalid',code:'123456'});
  assert.equal(mail.to.address,'person@example.invalid');assert.ok(mail.text.includes('123456'));assert.equal(mail.text.includes(config.SMTP_PASSWORD),false);
  let direct;createSmtpMailer({...config,SMTP_PORT:'465'},options=>{direct=options;return{};});assert.equal(direct.secure,true);
});
test('SMTP rejects SMS, unsafe recipients, invalid codes and provider rejection',async()=>{
  let calls=0;const sender=createSmtpMailer(config,()=>({sendMail:async()=>{calls++;return{accepted:[],rejected:['person@example.invalid']};}}));
  await assert.rejects(sender.send({channel:'sms',to:'+905320000000',code:'123456'}));
  await assert.rejects(sender.send({channel:'email',to:'one@example.invalid,two@example.invalid',code:'123456'}));
  await assert.rejects(sender.send({channel:'email',to:'person@example.invalid',code:'123456\r\nInjected'}));assert.equal(calls,0);
  await assert.rejects(sender.send({channel:'email',to:'person@example.invalid',code:'123456'}));assert.equal(calls,1);
});
