// Login assistance and disclosure documents. Shared by the server and Pages UI.
let recoveryRequestId='';
function recoveryMethod(){return document.querySelector('[name="recovery-channel"]:checked').value;}
function recoveryAvailability(){
  const available=state.recoveryChannels?.[recoveryMethod()];
  $('#recovery-availability').textContent=available?'Kod, kurum yöneticisinin doğruladığı kayıtlı iletişim bilginize gönderilir.':'Bu gönderim yöntemi henüz etkinleştirilmedi. Bağlantı tamamlanana kadar Bilgi İşlem Müdürlüğünden destek alabilirsiniz.';
  $('#request-recovery-code').disabled=!available;
}
function resetRecovery(){
  recoveryRequestId='';$('#recovery-request-form').hidden=false;$('#recovery-confirm-form').hidden=true;$('#recovery-success').hidden=true;
  $('#recovery-error').textContent='';$('#recovery-confirm-form').reset();recoveryAvailability();
}
$('#forgot-password').addEventListener('click',()=>{
  $('#recovery-request-form').reset();$('#recovery-username').value=$('#login-username').value;resetRecovery();dialog('#recovery-dialog');$('#recovery-username').focus();
});
$$('[name="recovery-channel"]').forEach(el=>el.addEventListener('change',recoveryAvailability));
$('#recovery-back').addEventListener('click',resetRecovery);
$('#recovery-request-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!state.recoveryChannels?.[recoveryMethod()])return;
  const button=$('#request-recovery-code');button.disabled=true;$('#recovery-error').textContent='';
  try{const result=await api('/api/recovery/request',{username:$('#recovery-username').value.trim(),channel:recoveryMethod()});recoveryRequestId=result.requestId;$('#recovery-sent').textContent=result.message;$('#recovery-request-form').hidden=true;$('#recovery-confirm-form').hidden=false;$('#recovery-code').focus();}
  catch(error){$('#recovery-error').textContent=error.message;}finally{recoveryAvailability();}
});
$('#recovery-confirm-form').addEventListener('submit',async e=>{
  e.preventDefault();$('#recovery-error').textContent='';
  if($('#recovery-password').value!==$('#recovery-repeat').value){$('#recovery-error').textContent='Yeni parolalar eşleşmiyor.';return;}
  const button=e.target.querySelector('[type="submit"]');button.disabled=true;
  try{await api('/api/recovery/confirm',{requestId:recoveryRequestId,code:$('#recovery-code').value.trim(),password:$('#recovery-password').value});$('#login-username').value=$('#recovery-username').value.trim();$('#login-password').value='';$('#recovery-confirm-form').reset();$('#recovery-confirm-form').hidden=true;recoveryRequestId='';$('#recovery-success').hidden=false;$('#recovery-success').textContent='Parolanız yenilendi. Bu ekranı kapatıp yeni parolanızla giriş yapabilirsiniz.';}
  catch(error){$('#recovery-error').textContent=error.message;}finally{button.disabled=false;}
});
document.addEventListener('click',e=>{
  const link=e.target.closest('[data-legal]');if(link){const names={privacy:'KVKK Aydınlatma Metni',terms:'Kullanım Koşulları',cookies:'Çerez Bilgilendirmesi'};$('#legal-title').textContent=names[link.dataset.legal];$$('[data-legal-content]').forEach(el=>el.hidden=el.dataset.legalContent!==link.dataset.legal);dialog('#legal-dialog');}
  const contact=e.target.closest('[data-contact-user]');if(contact){const user=state.adminUsers.find(u=>u.id===Number(contact.dataset.contactUser));if(!user)return;$('#detail-title').textContent='İletişim bilgileri';$('#detail-content').innerHTML=`<p class="muted small">${esc(user.name)} · ${esc(user.username)}</p><p class="notice small">Yalnızca kurum kayıtlarından doğruladığınız bilgileri kaydedin. Parola yenileme kodları bu adreslere gönderilir.</p><form id="contact-form" data-user-id="${user.id}"><label>E-posta<input name="email" type="email" maxlength="254" autocomplete="off" value="${esc(user.email||'')}"></label><label>Cep telefonu<input name="phone" type="tel" maxlength="25" autocomplete="off" placeholder="+905321234567" value="${esc(user.phone||'')}"></label><p id="contact-error" class="form-error" role="alert"></p><button type="submit" class="button primary full">Kaydet</button></form>`;dialog('#detail-dialog');}
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='contact-form')return;e.preventDefault();const form=e.target,button=form.querySelector('[type="submit"]');button.disabled=true;
  try{await api('/api/admin/users/'+form.dataset.userId,Object.fromEntries(new FormData(form)),'PATCH');closeDialogs();await adminPanel();toast('İletişim bilgileri güncellendi.');}catch(error){$('#contact-error').textContent=error.message;}finally{button.disabled=false;}
});
$('#recovery-dialog').addEventListener('close',()=>{$('#recovery-confirm-form').reset();recoveryRequestId='';});
