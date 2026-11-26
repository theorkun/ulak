// All Office parsing stays in a disposable worker. No document HTML is executed.
function checkArchive(buffer){
  const view=new DataView(buffer);let end=-1;
  for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw Error('Belge arşivi okunamadı.');
  const count=view.getUint16(end+10,true),start=view.getUint32(end+16,true);if(count>2000||start>=end||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw Error('Belge önizleme sınırını aşıyor.');
  let offset=start,total=0;
  for(let i=0;i<count;i++){
    if(offset+46>end||view.getUint32(offset,true)!==0x02014b50)throw Error('Belge arşivi bozuk.');
    const size=view.getUint32(offset+24,true);total+=size;
    if((view.getUint16(offset+8,true)&1)||size>8*1024*1024||total>20*1024*1024)throw Error('Şifreli veya çok büyük belge önizlenemiyor.');
    offset+=46+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
  }
  if(offset>end)throw Error('Belge arşivi bozuk.');
}
self.onmessage=async event=>{
  try{
    const {kind,buffer}=event.data;if(!(buffer instanceof ArrayBuffer)||buffer.byteLength>2*1024*1024)throw Error('Dosya önizleme sınırını aşıyor.');checkArchive(buffer);
    if(kind==='docx'){
      importScripts('vendor/preview/mammoth.browser.min.js');
      const result=await self.mammoth.extractRawText({arrayBuffer:buffer},{externalFileAccess:false});
      self.postMessage({kind,text:result.value.slice(0,200000),truncated:result.value.length>200000});
    }else if(kind==='xlsx'){
      importScripts('vendor/preview/xlsx.mini.min.js');
      const names=self.XLSX.read(buffer,{type:'array',bookSheets:true}).SheetNames;
      const book=self.XLSX.read(buffer,{type:'array',sheets:names.slice(0,10),sheetRows:201,cellHTML:false,cellFormula:false,cellStyles:false,bookVBA:false,bookDeps:false});
      const sheets=book.SheetNames.slice(0,10).map(name=>{
        const sheet=book.Sheets[name];if(!sheet?.['!ref'])return{name,rows:[],truncated:false};const range=self.XLSX.utils.decode_range(sheet['!ref']);const full=self.XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']);range.s={r:0,c:0};range.e.r=Math.min(range.e.r,199);range.e.c=Math.min(range.e.c,29);
        const rows=self.XLSX.utils.sheet_to_json(sheet,{header:1,range,raw:false,defval:'',blankrows:false}).map(row=>row.map(cell=>String(cell).slice(0,2000)));
        return{name,rows,truncated:full.e.r>199||full.e.c>29};
      });self.postMessage({kind,sheets,truncated:names.length>10});
    }else throw Error('Desteklenmeyen belge.');
  }catch(error){self.postMessage({error:'Belge açılamadı. Dosya bozuk, şifreli veya önizleme sınırlarının dışında olabilir.'});}
};
