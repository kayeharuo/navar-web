export function rectangleSelection(nodes,edges,start,end) {
 const left=Math.min(start.x,end.x),right=Math.max(start.x,end.x),top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y);
 const inside=n=>n.x>=left&&n.x<=right&&n.y>=top&&n.y<=bottom;
 const selected=nodes.filter(inside),ids=new Set(selected.map(n=>n.id));
 return {nodeIds:[...ids],edgeIds:edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>e.id)};
}
export function copySelection(nodes,edges,nodeIds,edgeIds=[],sourceFloor) {
 const ids=new Set(nodeIds),chosen=new Set(edgeIds);
 edges.filter(e=>chosen.has(e.id)).forEach(e=>{ids.add(e.from);ids.add(e.to);});
 return {sourceFloor,nodes:nodes.filter(n=>ids.has(n.id)).map(n=>({...n})),edges:edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>({...e}))};
}
export function pasteSelection(clipboard,{floor,width,height,existingNodes=[],offset=0,point,id}) {
 const list=clipboard?.nodes;
 if(!Array.isArray(list)||!list.length)return {nodes:[],edges:[],needsStoreLinks:false};
 const minX=Math.min(...list.map(n=>n.x)),maxX=Math.max(...list.map(n=>n.x)),minY=Math.min(...list.map(n=>n.y)),maxY=Math.max(...list.map(n=>n.y));
 if(maxX-minX>width||maxY-minY>height)throw new Error('The copied selection is larger than this floor plan. Copy a smaller area.');
 const dx=Math.max(-minX,Math.min(point?point.x-minX:offset,width-maxX)),dy=Math.max(-minY,Math.min(point?point.y-minY:offset,height-maxY));
 const ids=new Map(list.map(n=>[n.id,id('n')])),crossFloor=clipboard.sourceFloor!==floor;
 const nodes=list.map(n=>({...n,id:ids.get(n.id),dbId:null,floor,x:n.x+dx,y:n.y+dy,cross_floor_link:null,status:'active',
  related_store_id:crossFloor?null:n.related_store_id,stall_name:crossFloor?undefined:n.stall_name,
  transition_group_id:existingNodes.some(other=>other.transition_group_id&&other.transition_group_id===n.transition_group_id)?null:n.transition_group_id}));
 const edges=(clipboard.edges||[]).filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>({...e,id:id('e'),dbId:null,from:ids.get(e.from),to:ids.get(e.to),floor,distance_value:null}));
 return {nodes,edges,needsStoreLinks:crossFloor&&nodes.some(n=>['STORE_ENTRANCE','STALL'].includes(n.type))};
}
