function dngPreview(buffer){
  const view=new DataView(buffer),little=view.getUint16(0,false)===0x4949,seen=new Set();let best=null;
  const u16=offset=>view.getUint16(offset,little),u32=offset=>view.getUint32(offset,little);
  if(buffer.byteLength<8||u16(2)!==42)throw Error('DNG okunamadı.');
  function jpeg(offset,size){if(offset<0||size<5||offset+size>buffer.byteLength||size>32*1024*1024)return;const b=new Uint8Array(buffer,offset,size);if(b[0]===255&&b[1]===216&&b[2]===255&&b[size-2]===255&&b[size-1]===217&&(!best||size>best.size))best={offset,size};}
  function visit(offset){if(!offset||seen.has(offset)||seen.size>=32||offset+2>buffer.byteLength)return;seen.add(offset);const count=u16(offset);if(count>4096||offset+2+count*12+4>buffer.byteLength)return;const tags=new Map();
    for(let i=0;i<count;i++){const entry=offset+2+i*12,tag=u16(entry),type=u16(entry+2),length=u32(entry+4);if(![3,4,13].includes(type)||!length||length>64)continue;const size=type===3?2:4,position=length*size<=4?entry+8:u32(entry+8);if(position+length*size>buffer.byteLength)continue;tags.set(tag,Array.from({length},(_,i)=>type===3?u16(position+i*size):u32(position+i*size)));}
    const first=tag=>tags.get(tag)?.[0];if(first(513)&&first(514))jpeg(first(513),first(514));
    if(first(259)===7&&[2,6].includes(first(262))&&first(258)===8&&tags.get(273)?.length===1&&tags.get(279)?.length===1)jpeg(first(273),first(279));
    for(const next of tags.get(330)||[])visit(next);visit(u32(offset+2+count*12));
  }
  visit(u32(4));if(!best)throw Error('Bu DNG dosyasında görüntülenebilir JPEG önizlemesi bulunamadı.');return new Blob([new Uint8Array(buffer,best.offset,best.size)],{type:'image/jpeg'});
}
self.onmessage=async event=>{try{
  const {buffer,kind}=event.data;if(!(buffer instanceof ArrayBuffer)||buffer.byteLength>100*1024*1024)throw Error('Fotoğraf en fazla 100 MB olabilir.');
  if(kind==='dng'){self.postMessage({blob:dngPreview(buffer)});return;}
  importScripts('vendor/preview/libheif.js');const lib=await self.libheif(),decoder=new lib.HeifDecoder(),images=decoder.decode(new Uint8Array(buffer));
  const image=images.find(image=>image.is_primary?.())||images[0];if(!image)throw Error('HEIC fotoğraf açılamadı.');const width=image.get_width(),height=image.get_height();
  if(!width||!height||width*height>64*1024*1024)throw Error('Fotoğraf çözünürlüğü önizleme sınırını aşıyor.');
  const pixels=await new Promise((resolve,reject)=>image.display({data:new Uint8ClampedArray(width*height*4),width,height},result=>result?resolve(result):reject(Error('HEIC fotoğraf çözümlenemedi.'))));
  if(typeof OffscreenCanvas==='undefined')throw Error('HEIC önizlemesi için güncel bir tarayıcı kullanın.');
  const source=new OffscreenCanvas(width,height);source.getContext('2d').putImageData(new ImageData(pixels.data,width,height),0,0);
  const scale=Math.min(1,2048/Math.max(width,height)),canvas=new OffscreenCanvas(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)));canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);const blob=await canvas.convertToBlob({type:'image/jpeg',quality:.88});
  for(const item of images)item.free?.();self.postMessage({blob});
}catch(error){self.postMessage({error:error.message||'Fotoğraf önizlemesi oluşturulamadı.'});}};
