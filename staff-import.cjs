const crypto=require('node:crypto');
module.exports=function createStaffImport({db,body,session,admin,fail,text,contacts,passwordHash,transaction,rooms,publicUser,audit,event,json}){
  return async(req,res,user)=>{
    admin(user);const input=await body(req);if(!Array.isArray(input.rows)||!input.rows.length||input.rows.length>50)fail(400,'Bir seferde 1–50 personel aktarın.');
    const names=new Set();
    const rows=input.rows.map((row,index)=>{
      const username=text(row.username,3,40,'Satır '+(index+1)+' kullanıcı adı').toLowerCase(),name=text(row.name,2,80,'Ad soyad');
      if(!/^[a-z0-9._-]+$/.test(username)||names.has(username)||db.prepare('SELECT 1 FROM users WHERE username=?').get(username))fail(400,'Kullanıcı adı geçersiz veya zaten var: '+username);names.add(username);
      const department=db.prepare('SELECT * FROM departments WHERE id=?').get(Number(row.departmentId));if(!department)fail(400,'Müdürlük bulunamadı.');const contact=contacts({email:row.email||''});
      return{username,name,department,contact,temporaryPassword:crypto.randomBytes(12).toString('base64url')};
    });
    // Bound password hashing concurrency to keep the server responsive during imports.
    for(let i=0;i<rows.length;i+=4)await Promise.all(rows.slice(i,i+4).map(async row=>{row.password=await passwordHash(row.temporaryPassword);}));
    session(req);
    const created=transaction(()=>rows.map(row=>{
      if(db.prepare('SELECT 1 FROM users WHERE username=?').get(row.username))fail(409,'Kullanıcı adı bu sırada oluşturuldu: '+row.username);
      const id=Number(db.prepare("INSERT INTO users(username,name,department,password,role,must_change,email) VALUES(?,?,?,?,'member',1,?)").run(row.username,row.name,row.department.name,row.password,row.contact.email).lastInsertRowid);
      rooms.sync(id);audit(user.id,'user_created',id);return{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)),temporaryPassword:row.temporaryPassword};
    }));event({kind:'directory'});json(res,201,{created});
  };
};
