const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildNodeMap } = require('../modules/nodeMap/validation');
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const context = { floorIds: new Set([1,2,3]), floorLabels: new Map(), floorNumbers: new Map([[1,1],[2,2],[3,3]]), existingNodeIds: new Set(), units: new Map(), stores: new Map() };
function fixture() {
 return { transitionGroups:[{id:'00000000-0000-4000-8000-000000000001',type:'STAIRS',name:'Stairs A'}], finalize:true, nodes:[1,2,3].map(i=>({clientId:`n${i}`,floorId:i,type:'STAIRS',label:'Stairs A',transitionGroupId:'00000000-0000-4000-8000-000000000001',pixelX:50,pixelY:50})), calibrations:[1,2,3].map(floorId=>({floorId,refStart:{x:0,y:0},refEnd:{x:200,y:0},meters:20,pathLossExponent:2})), edges:[{fromClientId:'n2',toClientId:'n1',pathType:'normal',direction:'both'},{fromClientId:'n3',toClientId:'n2',pathType:'restricted',direction:'forward'}] };
}
test('middle landing supports two connections and retains direction/access',()=>{const result=buildNodeMap(fixture(),context);assert.deepEqual(result.errors,[]);assert.equal(result.payload.edges.length,2);assert.equal(result.payload.edges[1].direction,'forward');assert.equal(result.payload.edges[1].path_type,'restricted');});
test('reject reverse duplicates',()=>{const f=fixture();f.edges.push({fromClientId:'n1',toClientId:'n2',pathType:'normal'});assert.match(buildNodeMap(f,context).errors.join(),/more than once/);});
test('missing group connections are generated and singleton groups identify the node',()=>{
 const f=fixture();f.edges=[];const built=buildNodeMap(f,context);assert.deepEqual(built.errors,[]);assert.equal(built.payload.edges.length,2);
 f.nodes=f.nodes.slice(0,1);assert.match(buildNodeMap(f,context).errors.join(),/n1.*floor 1.*matching landing/);
 f.finalize=false;assert.deepEqual(buildNodeMap(f,context).errors,[]);
});
test('reject mismatched groups and nonadjacent stairs; allow skipping elevators',()=>{const f=fixture();f.nodes[0].transitionGroupId='other';assert.match(buildNodeMap(f,context).errors.join(),/transition group/);f.nodes.forEach(n=>n.transitionGroupId='00000000-0000-4000-8000-000000000001');f.edges=[{fromClientId:'n3',toClientId:'n1',pathType:'normal'}];f.finalize=false;assert.match(buildNodeMap(f,context).errors.join(),/adjacent/);f.nodes.forEach(n=>n.type='ELEVATOR');f.transitionGroups[0].type='ELEVATOR';assert.deepEqual(buildNodeMap(f,context).errors,[]);});
test('migration preserves legacy pairs, groups landings, enforces uniqueness and drops partner field',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE node(node_id bigint PRIMARY KEY, node_type text, floor_id bigint, ar_development_id bigint, node_cross_floor_link_id integer);
 CREATE TABLE edge(edge_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, start_node_id bigint, end_node_id bigint, ar_development_id bigint, edge_distance double precision, edge_path_type text, edge_created_at timestamptz, edge_updated_at timestamptz, edge_is_accessible boolean, edge_is_cross_floor boolean);
 INSERT INTO node VALUES (1,'STAIRS',1,10,2),(2,'STAIRS',2,10,1),(3,'STAIRS',3,10,NULL);`);
 await db.exec(fs.readFileSync(require('node:path').join(__dirname,'../database_schema/36_floor_connections.sql'),'utf8'));
 assert.equal((await db.query('SELECT * FROM edge')).rows.length,1);
 const nodes=(await db.query('SELECT * FROM node ORDER BY node_id')).rows;
 assert.equal(nodes[0].node_transition_group,nodes[1].node_transition_group);
 assert.equal(nodes[0].is_emergency,false);
 assert.equal('node_cross_floor_link_id' in nodes[0],false);
 await assert.rejects(db.exec("INSERT INTO edge(start_node_id,end_node_id,ar_development_id) VALUES(2,1,10)"),/duplicate key/);
 await assert.rejects(db.exec("INSERT INTO edge(start_node_id,end_node_id,ar_development_id,edge_direction) VALUES(2,3,10,'invalid')"),/check constraint/);
 await db.exec('CREATE TABLE ar_development(ar_development_id bigint PRIMARY KEY); INSERT INTO ar_development VALUES(10);');
 await db.exec(fs.readFileSync(require('node:path').join(__dirname,'../database_schema/37_shared_transition_groups.sql'),'utf8'));
 const assigned=(await db.query('SELECT transition_group_id FROM node ORDER BY node_id')).rows;
 assert.equal(assigned[0].transition_group_id,assigned[1].transition_group_id);
 await db.query('UPDATE transition_group SET transition_group_name=$1 WHERE transition_group_id=$2',['Main Stairs',assigned[0].transition_group_id]);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM node n JOIN transition_group g USING(transition_group_id) WHERE g.transition_group_name=$1',['Main Stairs'])).rows[0].n,2);
 await assert.rejects(db.exec("UPDATE node SET floor_id=1 WHERE node_id=2"),/duplicate key/);
 await assert.rejects(db.exec("UPDATE node SET node_type='ELEVATOR' WHERE node_id=1"),/foreign key/);
 await db.exec('ALTER TABLE node ADD COLUMN node_is_accessible boolean DEFAULT false; UPDATE node SET is_emergency=true WHERE node_id=1;');
 await db.exec(fs.readFileSync(require('node:path').join(__dirname,'../database_schema/38_remove_accessibility_flags.sql'),'utf8'));
 const renamed=(await db.query('SELECT * FROM node WHERE node_id=1')).rows[0];
 assert.equal(renamed.node_is_emergency,true);assert.equal('is_emergency' in renamed,false);assert.equal('node_is_accessible' in renamed,false);
 const edge=(await db.query('SELECT * FROM edge LIMIT 1')).rows[0];assert.equal('edge_is_accessible' in edge,false);
 } finally {await db.close();}
});

test('shared groups reject duplicate names, wrong types and duplicate floor landings',()=>{
 const f=fixture(); f.transitionGroups.push({...f.transitionGroups[0], id:'00000000-0000-4000-8000-000000000002',name:'stairs a'});
 assert.match(buildNodeMap(f,context).errors.join(),/already exists/);
 f.transitionGroups.pop(); f.transitionGroups[0].type='ELEVATOR'; assert.match(buildNodeMap(f,context).errors.join(),/matching transition group/);
 f.transitionGroups[0].type='STAIRS';f.nodes[1].floorId=1;assert.match(buildNodeMap(f,context).errors.join(),/already has a landing/);
});

test('missing-group errors identify label, client ID and floor',()=>{const f=fixture();delete f.nodes[1].transitionGroupId;assert.match(buildNodeMap(f,context).errors.join(),/Stairs A.*n2.*floor 2.*matching transition group/);});
test('editor auto-connect preserves edge settings and respects floor gaps', async()=>{
 const {autoConnect}=await import('../../navar-frontend/src/components/nodeEditor/autoConnections.js');
 const groups=[{id:'g',type:'STAIRS'}], meta={F1:{floorNum:1},F2:{floorNum:2},F3:{floorNum:3}};
 const nodes=Object.fromEntries([1,2,3].map(i=>[`F${i}`,[{id:`n${i}`,floor:`F${i}`,type:'STAIRS',transition_group_id:'g'}]]));
 const settings={id:'saved',from:'n1',to:'n2',direction:'forward',path_type:'restricted',dbId:99};
 const result=autoConnect({nodes,groups,edges:{__crossFloor:[settings]}},meta);
 assert.equal(result.edges.__crossFloor.length,2);assert.deepEqual(result.edges.__crossFloor[0],settings);
 delete nodes.F2;assert.equal(autoConnect({...result,nodes},meta).edges.__crossFloor.length,0);
 groups[0].type='ELEVATOR';Object.values(nodes).flat().forEach(n=>n.type='ELEVATOR');assert.equal(autoConnect({...result,nodes,groups},meta).edges.__crossFloor.length,1);
});
