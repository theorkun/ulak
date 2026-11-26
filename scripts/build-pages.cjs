// Only these static, synthetic files are published. Never copy server data.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs');
fs.mkdirSync(out,{recursive:true});
for(const name of ['style.css','brand-guide.css','collaboration.css','file-preview.css','file-preview.js','office-preview-worker.js','photo-preview-worker.js','upload-limits.js','fonts.css','app.js','collaboration.js','auth.js','icon.svg','saricam-belediyesi-logo.png','selcuklu-motif.svg','saricam-kurumsal-desen.png'])fs.copyFileSync(path.join(root,'public',name),path.join(out,name));
fs.mkdirSync(path.join(out,'fonts'),{recursive:true});
for(const name of require('../font-assets.cjs'))fs.copyFileSync(path.join(root,'public','fonts',name),path.join(out,'fonts',name));
for(const file of require('../preview-assets.json').files){const target=path.join(out,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,'public',file.path),target);}
let html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
html=html.replace(/(<script src="app\.js\?v=\d+" defer><\/script>)/,'<script src="browser-demo.js?v=26" defer></script>\n  $1');
html=html.replaceAll('href="/"','href="./"').replace('<title>Turkuaz Kurumsal İletişim · Kurum İletişim Alanı</title>','<title>Turkuaz Kurumsal İletişim · Tarayıcı Demosu</title>');
fs.writeFileSync(path.join(out,'index.html'),html);
const names=require('../department-catalog.cjs').names;
fs.writeFileSync(path.join(out,'browser-demo.js'),'window.ULAK_DEMO_DEPARTMENTS='+JSON.stringify(names)+';\n'+fs.readFileSync(path.join(root,'demo/browser-demo.js'),'utf8'));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('GitHub Pages demo prepared: docs/');
