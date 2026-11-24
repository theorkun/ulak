const { DatabaseSync, backup } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
async function run() {
  const file = path.join(__dirname, 'data', 'kurumnet.db');
  if (!fs.existsSync(file)) throw Error('Henüz veritabanı oluşturulmamış.');
  const output = path.join(__dirname, 'data', 'backups', `kurumnet-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const db = new DatabaseSync(file, { readOnly: true });
  try { await backup(db, output); console.log('Tutarlı veritabanı yedeği:', output); } finally { db.close(); }
}
run().catch(e => { console.error(e.message); process.exitCode = 1; });
