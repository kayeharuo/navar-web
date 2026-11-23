const { test } = require('node:test');
const assert = require('node:assert/strict');
test('automatic landing chains accept string floor numbers returned by an API', async () => {
 const { autoConnect } = await import('../../navar-frontend/src/components/nodeEditor/autoConnections.js');
 const snapshot = { groups:[{id:'g',type:'STAIRS'}], nodes:{A:[{id:'a',floor:'A',type:'STAIRS',transition_group_id:'g'}],B:[{id:'b',floor:'B',type:'STAIRS',transition_group_id:'g'}]},edges:{} };
 assert.equal(autoConnect(snapshot,{A:{floorNum:'1'},B:{floorNum:'2'}}).edges.__crossFloor.length,1);
});
