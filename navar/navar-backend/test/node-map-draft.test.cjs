const { test }=require('node:test');
const assert=require('node:assert/strict');
test('global draft saves pending properties and regenerates group connections without mutating the old snapshot',async()=>{
 const {prepareDraft}=await import('../../navar-frontend/src/components/nodeEditor/prepareDraft.js');
 const snapshot={nodes:{F1:[{id:'a',type:'STAIRS',floor:'F1',label:'Old',x:5,y:8}],F2:[{id:'b',type:'STAIRS',floor:'F2',transition_group_id:'g',x:9,y:10}]},groups:[{id:'g',type:'STAIRS',name:'Stairs A'}],edges:{},calibration:{}};
 const result=prepareDraft(snapshot,{F1:{floorNum:1},F2:{floorNum:2}},{floor:'F1',selectedId:'a',nodeEditsDirty:true,nodeEdits:{...snapshot.nodes.F1[0],label:'New',transition_group_id:'g',isEmergency:true,x:999,y:999}});
 assert.equal(result.nodes.F1[0].label,'New');assert.equal(result.nodes.F1[0].x,5);assert.equal(result.nodes.F1[0].isEmergency,true);assert.equal(result.edges.__crossFloor.length,1);assert.equal(snapshot.nodes.F1[0].label,'Old');
});
test('global draft applies pending scale fields and rejects invalid values',async()=>{
 const {prepareDraft}=await import('../../navar-frontend/src/components/nodeEditor/prepareDraft.js');
 const snapshot={nodes:{F1:[]},groups:[],edges:{},calibration:{F1:{refStart:{x:0,y:0},refEnd:{x:200,y:0},meters:20,pxPerMeter:10}}};
 const pending={floor:'F1',calibrationEditsDirty:true,calibrationEdits:{meters:'40',pathLossExponent:'2',refLine:' Wall '}};
 const result=prepareDraft(snapshot,{F1:{floorNum:1}},pending);assert.equal(result.calibration.F1.pxPerMeter,5);assert.equal(result.calibration.F1.refLine,'Wall');assert.equal(snapshot.calibration.F1.meters,20);
 pending.calibrationEdits.meters='0';assert.throws(()=>prepareDraft(snapshot,{},pending),/greater than zero/);
});
