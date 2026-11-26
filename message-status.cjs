function install(db){if(!db.prepare('PRAGMA table_info(messages)').all().some(c=>c.name==='receipt_tracked'))db.exec('ALTER TABLE messages ADD COLUMN receipt_tracked INTEGER NOT NULL DEFAULT 0');db.exec(`CREATE TABLE IF NOT EXISTS message_recipients(message_id INTEGER NOT NULL REFERENCES messages(id),user_id INTEGER NOT NULL REFERENCES users(id),delivered_at TEXT,read_at TEXT,PRIMARY KEY(message_id,user_id));CREATE INDEX IF NOT EXISTS recipient_user ON message_recipients(user_id,message_id);`);}
function createMessageStatus({db,body,session,member,json,fail,event}){
  const emit=(id,count,senders)=>{if(count)event({kind:'receipt',conversationId:id},id,senders);};
  function snapshot(id,room,sender){db.prepare('UPDATE messages SET receipt_tracked=1 WHERE id=?').run(id);db.prepare('INSERT INTO message_recipients(message_id,user_id) SELECT ?,u.id FROM members m JOIN users u ON u.id=m.user_id WHERE m.conversation_id=? AND u.active=1 AND u.id!=?').run(id,room,sender);}
  function read(user,room,lastId){const senders=new Set(db.prepare('SELECT DISTINCT m.sender_id FROM messages m JOIN message_recipients r ON r.message_id=m.id WHERE r.user_id=? AND r.read_at IS NULL AND m.conversation_id=? AND m.id<=? AND m.deleted_at IS NULL').all(user,room,lastId).map(r=>r.sender_id));const result=db.prepare("UPDATE message_recipients SET delivered_at=coalesce(delivered_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=? AND read_at IS NULL AND message_id IN (SELECT id FROM messages WHERE conversation_id=? AND id<=? AND deleted_at IS NULL)").run(user,room,lastId);emit(room,result.changes,senders);}
  async function handle(req,res,url,user){let match;
    if((match=url.pathname.match(/^\/api\/conversations\/(\d+)\/delivered$/))&&req.method==='POST'){
      const room=Number(match[1]);member(user.id,room);const input=await body(req);session(req);member(user.id,room);
      if(!Array.isArray(input.messageIds)||input.messageIds.length>100||input.messageIds.some(id=>!Number.isSafeInteger(id)||id<1))fail(400,'Geçersiz teslim bilgisi.');
      const ids=[...new Set(input.messageIds)];for(const id of ids)if(!db.prepare('SELECT 1 FROM messages WHERE id=? AND conversation_id=?').get(id,room))fail(400,'Geçersiz teslim bilgisi.');
      let count=0;const senders=new Set(),update=db.prepare("UPDATE message_recipients SET delivered_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE message_id=? AND user_id=? AND delivered_at IS NULL AND EXISTS(SELECT 1 FROM messages WHERE id=? AND deleted_at IS NULL)");for(const id of ids){const changed=update.run(id,user.id,id).changes;count+=changed;if(changed)senders.add(db.prepare('SELECT sender_id FROM messages WHERE id=?').get(id).sender_id);}emit(room,count,senders);json(res,200,{ok:true});return true;
    }
    if((match=url.pathname.match(/^\/api\/messages\/(\d+)\/status$/))&&req.method==='GET'){
      const message=db.prepare('SELECT * FROM messages WHERE id=? AND deleted_at IS NULL').get(Number(match[1]));if(!message||message.sender_id!==user.id)fail(404,'Mesaj bilgisi bulunamadı.');member(user.id,message.conversation_id);
      const recipients=db.prepare('SELECT u.id,u.name,u.avatar_version,r.delivered_at deliveredAt,r.read_at readAt FROM message_recipients r JOIN users u ON u.id=r.user_id WHERE message_id=? ORDER BY u.name').all(message.id).map(({avatar_version,...r})=>({...r,avatarUrl:avatar_version?`/api/avatars/${r.id}?v=${avatar_version}`:''}));
      json(res,200,{messageId:message.id,tracked:!!message.receipt_tracked,recipients});return true;
    }
    return false;
  }
  return{snapshot,read,handle};
}
module.exports={install,createMessageStatus};
