const {test}=require('node:test'),assert=require('node:assert/strict')
const root='../../navar-frontend/src/components/nodeEditor/'
test('single floor images download directly while multiple floors use ZIP; PDFs retain their extension',async()=>{
 const {packageFloorImages,floorExportFilename}=await import(root+'mapExport.js');
 const bytes=new Uint8Array([1,2,3]),files=[{name:'Floor1.png',bytes}];
 const png=packageFloorImages(files,'png');assert.equal(png.type,'image/png');assert.deepEqual(new Uint8Array(await png.arrayBuffer()),bytes);
 assert.equal(packageFloorImages(files,'jpg').type,'image/jpeg');
 assert.equal(packageFloorImages([...files,{name:'Floor2.png',bytes}],'png').type,'application/zip');
 assert.equal(floorExportFilename('Mall',['Floor 1'],'jpg'),'Mall-Floor_1.jpg');
 assert.equal(floorExportFilename('Mall',['Floor 1','Floor 2'],'png'),'Mall-floor-plans.zip');
 assert.equal(floorExportFilename('Mall',['Floor 1'],'pdf'),'Mall-Floor_1.pdf');
});
test('contrast is neutral at zero and grid draws both axes within original plan bounds',async()=>{
 const {planContrastFilter,gridSpacing,drawMapGrid}=await import(root+'mapAppearance.js');
 assert.equal(planContrastFilter(0),'contrast(1)');assert.equal(planContrastFilter(-100),'contrast(0.25)');assert.equal(planContrastFilter(100),'contrast(4)');assert.equal(planContrastFilter(500),'contrast(4)');assert.ok(gridSpacing(1200,800)>0);
 const calls=[],ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});drawMapGrid(ctx,1200,800,.5);
 assert.ok(calls.some(c=>c[0]==='rect'&&c[3]===1200&&c[4]===800));assert.ok(calls.some(c=>c[0]==='fillText'&&c[1].startsWith('X ')));assert.ok(calls.some(c=>c[0]==='fillText'&&c[1].startsWith('Y ')));
});
test('empty or stale clipboard is a no-op and never allocates nodes or edges',async()=>{
 const {copySelection,pasteSelection}=await import(root+'mapSelection.js');
 const options={floor:'F2',width:100,height:100,id:()=>{throw new Error('Empty clipboard must not allocate IDs')}};
 for(const clipboard of [null,undefined,[],{}, {nodes:[]},{nodes:[],edges:[{from:'missing',to:'missing'}]}]){
  assert.deepEqual(pasteSelection(clipboard,options),{nodes:[],edges:[],needsStoreLinks:false});
 }
 const copied=copySelection([{id:'a',x:10,y:20}],[],[],[],'F1');
 assert.deepEqual(pasteSelection(copied,options),{nodes:[],edges:[],needsStoreLinks:false});
});
test('rectangle selection works in either drag direction and includes only connecting in-floor edges',async()=>{
 const {rectangleSelection}=await import(root+'mapSelection.js');const nodes=[{id:'a',x:10,y:20},{id:'b',x:30,y:40},{id:'c',x:90,y:90}];
 const result=rectangleSelection(nodes,[{id:'ab',from:'a',to:'b'},{id:'bc',from:'b',to:'c'}],{x:50,y:60},{x:0,y:0});assert.deepEqual(result,{nodeIds:['a','b'],edgeIds:['ab']});
})
test('copy/paste preserves graph connectivity but never reuses identities or foreign-floor store links',async()=>{
 const {copySelection,pasteSelection}=await import(root+'mapSelection.js');let i=0;const nodes=[{id:'a',dbId:1,x:10,y:20,type:'STORE_ENTRANCE',related_store_id:'101',floor:'F1',status:'inactive'},{id:'b',dbId:2,x:30,y:40,type:'ELEVATOR',transition_group_id:'g',floor:'F1'}],edges=[{id:'e',dbId:3,from:'a',to:'b',direction:'forward',path_type:'restricted'}];
 const copied=copySelection(nodes,edges,[],['e'],'F1');assert.equal(copied.nodes.length,2);
 const pasted=pasteSelection(copied,{floor:'F2',width:100,height:100,existingNodes:[{transition_group_id:'g'}],offset:20,id:p=>p+(++i)});
 assert.equal(pasted.edges[0].from,pasted.nodes[0].id);assert.equal(pasted.edges[0].to,pasted.nodes[1].id);assert.equal(pasted.edges[0].direction,'forward');assert.equal(pasted.edges[0].dbId,null);assert.equal(pasted.nodes[0].related_store_id,null);assert.equal(pasted.nodes[0].status,'active');assert.equal(pasted.nodes[1].transition_group_id,null);assert.equal(pasted.needsStoreLinks,true);assert.equal(nodes[0].dbId,1);
 assert.throws(()=>pasteSelection(copied,{floor:'F2',width:5,height:5,id:p=>p+(++i)}),/larger/);
})
test('legend is appended below original image bounds and scales with the floor plan',async()=>{
 const {legendLayout,drawMapLegend}=await import(root+'mapLegend.js');assert.equal(legendLayout(2400).height,legendLayout(1200).height*2);
 const calls=[],ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});drawMapLegend(ctx,1200,900,'Floor 1');assert.ok(calls.some(c=>c[0]==='translate'&&c[2]===900));assert.ok(calls.some(c=>c[0]==='fillText'&&c[1].includes('Node Type Legend')));
})
test('binary ZIP stores exact image bytes; PDF has one image page per floor and valid xref byte offsets',async()=>{
 const {zipFiles}=await import('../../navar-frontend/src/components/analytics/exportBundle.js'),{imagePdf}=await import(root+'mapExport.js');const bytes=new Uint8Array([255,216,0,128,255,217]);
 const zip=new Uint8Array(await zipFiles([{name:'1.png',bytes},{name:'2.jpg',bytes}]).arrayBuffer());assert.equal(new DataView(zip.buffer).getUint16(zip.length-12,true),2);assert.ok(zip.some((_,i)=>bytes.every((v,j)=>zip[i+j]===v)));
 const pdf=Buffer.from(await imagePdf([{width:1800,height:1200,bytes},{width:1200,height:1800,bytes}]).arrayBuffer()),text=pdf.toString('latin1');assert.match(text,/\/Count 2/);assert.equal((text.match(/\/Type \/Page\b/g)||[]).length,2);const xref=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.subarray(xref,xref+4).toString(),'xref');
 const entries=text.slice(xref).split('\n').slice(3,11);entries.forEach((entry,i)=>{const offset=Number(entry.slice(0,10));assert.equal(pdf.subarray(offset,offset+String(i+1).length+6).toString(),`${i+1} 0 obj`)});
})
