import {NODE_TYPES,PATH_TYPE} from './editorConstants.js';
import {drawMapLegend,legendLayout} from './mapLegend.js';
import {zipFiles} from '../analytics/exportBundle.js';
import {planContrastFilter,drawMapGrid,drawInactiveNode} from './mapAppearance.js';

export function packageFloorImages(files,format) {
 return files.length===1 ? new Blob([files[0].bytes],{type:format==='png'?'image/png':'image/jpeg'}) : zipFiles(files);
}
export function floorExportFilename(mallName,floors,format) {
 const clean=value=>value.replace(/[^a-z0-9_-]+/gi,'_');
 const extension=format==='pdf'?'pdf':floors.length===1?format:'zip';
 return `${clean(mallName)}-${floors.length===1?clean(floors[0]):'floor-plans'}.${extension}`;
}

export function imagePdf(pages) {
 const encoder=new TextEncoder(),chunks=[];let length=0;const offsets=[0],count=2+pages.length*3;
 const write=value=>{const bytes=typeof value==='string'?encoder.encode(value):value;chunks.push(bytes);length+=bytes.length;};
 const object=(number,body)=>{offsets[number]=length;write(`${number} 0 obj\n`);body();write('\nendobj\n');};
 write('%PDF-1.4\n%NavAR\n');
 object(1,()=>write('<< /Type /Catalog /Pages 2 0 R >>'));
 object(2,()=>write(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`));
 pages.forEach((page,i)=>{
  const base=3+i*3,landscape=page.width>page.height,w=landscape?842:595,h=landscape?595:842,scale=Math.min((w-32)/page.width,(h-32)/page.height),dw=page.width*scale,dh=page.height*scale;
  object(base,()=>write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Plan ${base+1} 0 R >> >> /Contents ${base+2} 0 R >>`));
  object(base+1,()=>{write(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`);write(page.bytes);write('\nendstream');});
  const stream=`q ${dw} 0 0 ${dh} ${(w-dw)/2} ${(h-dh)/2} cm /Plan Do Q\n`;
  object(base+2,()=>write(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`));
 });
 const xref=length;write(`xref\n0 ${count+1}\n0000000000 65535 f \n`);
 for(let i=1;i<=count;i++)write(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
 write(`trailer\n<< /Size ${count+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
 return new Blob(chunks,{type:'application/pdf'});
}
async function loadImage(url) {
 const image=new Image();image.crossOrigin='anonymous';image.src=url;
 try{await image.decode();}catch{throw new Error('A selected floor plan could not be loaded. Reload the editor and try again.');}
 return image;
}
function canvasBlob(canvas,type) {return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The floor plan could not be rendered.')),type,0.95));}
export async function renderMappedFloor({image,nodes,edges,opacity=1,contrast=0,showGrid=false,title}) {
 const sourceWidth=image.naturalWidth,sourceHeight=image.naturalHeight;
 // Bound browser memory while keeping enough detail for printing.
 const desired=Math.max(1,1800/sourceWidth),totalHeight=sourceHeight+legendLayout(sourceWidth).height;
 const scale=Math.min(desired,8192/sourceWidth,8192/totalHeight,Math.sqrt(24000000/(sourceWidth*totalHeight)));
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(sourceWidth*scale);canvas.height=Math.ceil(totalHeight*scale);
 const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,sourceWidth,totalHeight);
 ctx.save();ctx.globalAlpha=opacity;ctx.filter=planContrastFilter(contrast);ctx.drawImage(image,0,0);ctx.restore();
 if(showGrid)drawMapGrid(ctx,sourceWidth,sourceHeight,1200/sourceWidth);
 const byId=new Map(nodes.map(n=>[n.id,n])),unit=sourceWidth/1200;
 for(const edge of edges){const a=byId.get(edge.from),b=byId.get(edge.to);if(!a||!b)continue;const cfg=PATH_TYPE[edge.path_type]||PATH_TYPE.normal;ctx.strokeStyle=cfg.color;ctx.lineWidth=2.5*unit;ctx.setLineDash(cfg.dash.map(d=>d*unit));ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}
 for(const n of nodes){const cfg=NODE_TYPES[n.type]||NODE_TYPES.WALKWAY,r=8*unit;ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fillStyle=n.status==='inactive'?'#94a3b8':cfg.color;ctx.fill();ctx.lineWidth=1.5*unit;ctx.strokeStyle='#fff';ctx.stroke();if(n.status==='inactive')drawInactiveNode(ctx,n.x,n.y,r);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${18*unit}px sans-serif`;if(!['·','✛','○'].includes(cfg.icon))ctx.fillText(cfg.icon,n.x,n.y-r-12*unit);if(n.label){ctx.font=`${12*unit}px sans-serif`;const w=ctx.measureText(n.label).width;ctx.fillStyle='#fffffff2';ctx.fillRect(n.x-w/2-3*unit,n.y+r+3*unit,w+6*unit,17*unit);ctx.fillStyle='#0f172a';ctx.fillText(n.label,n.x,n.y+r+11*unit);}}
 drawMapLegend(ctx,sourceWidth,sourceHeight,title);
 return canvas;
}
export async function exportMappedFloors({floors,format,floorMeta,snapshot,opacity,contrast=0,showGrid=false,mallName,onProgress}) {
 if(!floors.length)throw new Error('Choose at least one floor.');
 const files=[],pages=[];
 await document.fonts.ready;
 for(let i=0;i<floors.length;i++){
  const floor=floors[i];onProgress?.(`Rendering ${floor} (${i+1}/${floors.length})`);
  const image=await loadImage(floorMeta[floor].imageUrl);
  const canvas=await renderMappedFloor({image,nodes:snapshot.nodes[floor]||[],edges:snapshot.edges[floor]||[],opacity,contrast,showGrid,title:`${mallName} · ${floor}`});
  let blob;try{blob=await canvasBlob(canvas,format==='png'?'image/png':'image/jpeg');}catch{throw new Error(`Unable to export ${floor}. The floor-plan image may not allow exporting. Reload the editor and try again.`);}
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(format==='pdf')pages.push({width:canvas.width,height:canvas.height,bytes});
  else files.push({name:`${String(i+1).padStart(2,'0')}-${floor.replace(/[^a-z0-9_-]+/gi,'_')}.${format}`,bytes});
  canvas.width=canvas.height=1;
 }
 return format==='pdf'?imagePdf(pages):packageFloorImages(files,format);
}
