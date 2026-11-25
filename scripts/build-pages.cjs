// Only these static, synthetic files are published. Never copy server data.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs');
fs.mkdirSync(out,{recursive:true});
for(const name of ['style.css','app.js','auth.js','icon.svg','saricam-belediyesi-logo.png','selcuklu-motif.svg'])fs.copyFileSync(path.join(root,'public',name),path.join(out,name));
let html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
html=html.replace(/(<script src="app\.js\?v=\d+" defer><\/script>)/,'<script src="browser-demo.js?v=17" defer></script>\n  $1');
html=html.replaceAll('href="/"','href="./"').replace('<title>ULAK · Kurum İletişim Alanı</title>','<title>ULAK · Tarayıcı Demosu</title>');
fs.writeFileSync(path.join(out,'index.html'),html);
const names=require('../department-catalog.cjs').names;
fs.writeFileSync(path.join(out,'browser-demo.js'),'window.ULAK_DEMO_DEPARTMENTS='+JSON.stringify(names)+';\n'+fs.readFileSync(path.join(root,'demo/browser-demo.js'),'utf8'));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('GitHub Pages demo prepared: docs/');
