const limits=require('./public/upload-limits.js');
module.exports=function createLargeUpload({fail,session,member,limited,saveMessage,decodeBinary,json}){
  const users=new Set();let active=0;
  return async(req,res,user,id)=>{
    member(user.id,id);if(req.headers['content-type']!=='application/x-turkuaz-upload')fail(415,'Dosya yükleme biçimi geçersiz.');
    if(Number(req.headers['content-length']||0)>limits.fileBytes+24004)fail(413,'Dosya en fazla 100 MB olabilir.');
    if(active>=2||users.has(user.id))fail(429,'Başka bir dosya yüklemesi sürüyor. Biraz sonra tekrar deneyin.');limited('binary-upload:'+user.id,10,60000);
    active++;users.add(user.id);
    try{
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limits.fileBytes+24004)fail(413,'Dosya en fazla 100 MB olabilir.');chunks.push(chunk);}
      session(req);member(user.id,id);const payload=Buffer.concat(chunks,size);if(size<5)fail(400,'Dosya yüklemesi eksik.');const length=payload.readUInt32BE(0);if(length>24000||length<2||4+length>=size)fail(400,'Dosya bilgisi geçersiz.');
      let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(payload.subarray(4,4+length)));}catch{fail(400,'Dosya bilgisi okunamadı.');}
      if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Dosya bilgisi geçersiz.');const file=decodeBinary(input.attachment,payload.subarray(4+length));const result=saveMessage(user,id,input,file,req);json(res,result.status,{id:result.id});
    }finally{active--;users.delete(user.id);}
  };
};
