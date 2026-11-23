const {test}=require('node:test'),assert=require('node:assert/strict')
const {buildNodeMap}=require('../modules/nodeMap/validation')
test('stall nodes must stay on the floor approved in the stall application',()=>{
 const context={floorIds:new Set([1,2]),floorLabels:new Map(),floorNumbers:new Map([[1,1],[2,2]]),existingNodeIds:new Set(),units:new Map(),stores:new Map([[51,{store_id:51,store_type:'stall',onboarding_floor_id:2}]])}
 const body={nodes:[{clientId:'stall',type:'STALL',label:'Corridor kiosk',floorId:1,storeId:51,pixelX:50,pixelY:50}],calibrations:[{floorId:1,refStart:{x:0,y:0},refEnd:{x:200,y:0},meters:20,pathLossExponent:2}],edges:[]}
 assert.ok(buildNodeMap(body,context).errors.some(e=>e.includes('stall on a different floor')))
 context.stores.get(51).onboarding_floor_id=1
 assert.deepEqual(buildNodeMap(body,context).errors,[])
})
test('stall picker filters approved floors while allowing legacy stalls with no recorded floor',async()=>{
 const c=await import('../../navar-frontend/src/components/nodeEditor/editorConstants.js')
 const old={floors:[...c.FLOORS],storeUnits:[...c.STORE_UNITS],stallStores:[...c.STALL_STORES]}
 try{c.setEditorCatalog({floors:['Ground','Upper'],storeUnits:[],stallStores:['Ground kiosk','Upper kiosk','Legacy kiosk'],stallFloorByName:[['Ground kiosk','Ground'],['Upper kiosk','Upper']]});assert.deepEqual(c.stallStoresForFloor('Ground'),['Ground kiosk','Legacy kiosk']);assert.deepEqual(c.stallStoresForFloor('Upper'),['Upper kiosk','Legacy kiosk'])}finally{c.setEditorCatalog(old)}
})
