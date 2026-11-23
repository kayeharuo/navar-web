const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const { canonicalContent, validateBeacons } = require('../modules/nodeMap/beacons')

test('snapshot comparison includes beacons, ignores database identities, and matches frontend', async () => {
 const { snapshotContent } = await import('../../navar-frontend/src/components/nodeEditor/snapshotContent.js')
 const body = { nodes: [{ clientId:'n1', dbId:1, pixelX:2 }], edges:[], calibrations:[], transitionGroups:[], beacons:[{ clientId:'b', nodeId:'n1', label:'One', dbId:3 }] }
 const saved = structuredClone(body); saved.nodes[0].dbId=90; saved.beacons[0].dbId=200
 assert.equal(canonicalContent(body), canonicalContent(saved))
 assert.equal(canonicalContent(body), snapshotContent(body))
 saved.beacons[0].label='Changed'
 assert.notEqual(canonicalContent(body), canonicalContent(saved))
 saved.beacons[0].label='One'; saved.nodes[0].pixelX=8
 assert.notEqual(canonicalContent(body), canonicalContent(saved))
 assert.match(validateBeacons([{ clientId:'b',nodeId:'gone' }],body.nodes).join(),/deleted|existing/)
})

test('snapshot application commits map and beacons together, preserves other versions, rejects stale writes and rolls back on failure', async () => {
 const db = new PGlite()
 const sql = file => fs.readFileSync(path.join(__dirname,'../database_schema',file),'utf8')
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE TABLE admin(admin_id bigint PRIMARY KEY); INSERT INTO admin VALUES(1);
   CREATE TABLE mall(mall_id bigint PRIMARY KEY); INSERT INTO mall VALUES(1),(2);
   CREATE TABLE floor(floor_id int PRIMARY KEY,mall_id bigint); INSERT INTO floor VALUES(1,1),(2,2);
   CREATE TABLE application(application_id bigint PRIMARY KEY,mall_id bigint); INSERT INTO application VALUES(1,1),(2,1),(3,2);
   CREATE TABLE ar_development(ar_development_id bigint PRIMARY KEY,application_id bigint,ar_development_map_revision int DEFAULT 0); INSERT INTO ar_development VALUES(1,1,0),(2,2,0),(3,3,0);
   CREATE TABLE node(node_id bigint PRIMARY KEY,ar_development_id bigint,floor_id int); INSERT INTO node VALUES(10,1,1),(11,1,1),(20,2,1),(30,3,2);
   CREATE TABLE edge(edge_id bigint PRIMARY KEY,start_node_id bigint,end_node_id bigint,ar_development_id bigint);
   CREATE TABLE beacon(beacon_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,beacon_code text UNIQUE,beacon_label text,beacon_minor int,beacon_tx_power int,beacon_status text,beacon_location text,beacon_node_count int,beacon_installed_at timestamptz,beacon_maintained_at timestamptz,mall_id bigint,floor_id int);
   CREATE TABLE battery(battery_code text NOT NULL,battery_brand text,battery_status text,battery_installed_at timestamptz,beacon_id bigint);
   CREATE TABLE beacon_node_assignment(assignment_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,beacon_id bigint REFERENCES beacon,node_id bigint REFERENCES node,ar_development_id bigint REFERENCES ar_development,assignment_created_at timestamptz,assignment_updated_at timestamptz,UNIQUE(ar_development_id,beacon_id),UNIQUE(ar_development_id,node_id));
   CREATE TABLE audit_log(audit_log_module text,audit_log_action text,audit_log_details text,audit_log_performed_at timestamptz,audit_log_performed_by bigint,mall_id bigint);
   CREATE FUNCTION save_node_map(integer,integer,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
    IF (SELECT ar_development_map_revision FROM ar_development WHERE ar_development_id=$1)<>$2 THEN RAISE EXCEPTION 'stale map' USING ERRCODE='NM409'; END IF;
    UPDATE ar_development SET ar_development_map_revision=ar_development_map_revision+1 WHERE ar_development_id=$1;
    RETURN jsonb_build_object('node_ids',jsonb_build_object('n1',10,'n2',11),'revision',$2+1);
   END $$;
  `)
  await db.exec(sql('39_version_specific_beacon_floors.sql'))
  await db.exec(sql('48_node_map_snapshots.sql'))
  await db.exec(sql('49_node_map_snapshot_beacons.sql'))
  const details={beacon_code:'BCN',beacon_label:'Old',beacon_status:'placed'}
  const battery={battery_code:'BAT',battery_brand:'Brand',battery_installed_at:'2026-11-23'}
  const id=(await db.query('SELECT save_beacon_with_assignments(1,NULL,$1,$2,$3) id',[details,[{versionId:1,nodeId:10},{versionId:2,nodeId:20}],battery])).rows[0].id
  const sid=(await db.query("INSERT INTO node_map_snapshot(ar_development_id,name,payload,created_by) VALUES(1,'Map', $1,1) RETURNING snapshot_id",[{saveBody:{}}])).rows[0].snapshot_id
  const revision=async()=>(await db.query('SELECT mall_beacon_revision r FROM mall WHERE mall_id=1')).rows[0].r
  const beacon={clientId:'b',dbId:id,beaconCode:'BCN',label:'Edited',minor:1,txPower:-30,location:'Door',dateInstalled:'2026-11-23',lastMaintenanceDate:'2026-11-23',batteryBrand:'New brand',batteryInstallDate:'2026-11-23',nodeId:'n2'}
  const payload={nodes:[{client_id:'n1',node_id:10},{client_id:'n2',node_id:11}]}
  const apply=(beacons,rev,snapshot=sid,confirm=true,mapRevision=0)=>db.query('SELECT apply_node_map_snapshot(1,$1,$2,$3,$4,$5,$6,1) result',[mapRevision,payload,beacons,rev,snapshot,confirm])
  const rev=await revision()
  await assert.rejects(apply([beacon],rev,sid,false),/Confirm/)
  await assert.rejects(apply([beacon],rev,999),/snapshot first/)
  await assert.rejects(apply([{...beacon,nodeId:'deleted'}],rev),/deleted node/)
  assert.equal((await db.query('SELECT ar_development_map_revision r FROM ar_development WHERE ar_development_id=1')).rows[0].r,0)
  assert.equal((await db.query('SELECT beacon_label FROM beacon')).rows[0].beacon_label,'Old')
  await apply([beacon],rev)
  assert.deepEqual((await db.query('SELECT node_id::int,ar_development_id::int FROM beacon_node_assignment ORDER BY ar_development_id')).rows,[{node_id:11,ar_development_id:1},{node_id:20,ar_development_id:2}])
  assert.equal((await db.query('SELECT beacon_label FROM beacon')).rows[0].beacon_label,'Edited')
  assert.equal((await db.query('SELECT battery_brand FROM battery')).rows[0].battery_brand,'New brand')
  await assert.rejects(apply([beacon],rev,sid,true,1),/Beacon data changed/)
  await db.exec("UPDATE beacon SET beacon_location='Changed in management'")
  const fresh=await revision()
  await assert.rejects(apply([beacon],fresh-1,sid,true,1),/Beacon data changed/)
  await assert.rejects(apply([],fresh,sid,true,1),/every current beacon/)
  const next={...beacon,clientId:'new',dbId:null,beaconCode:'NEW',nodeId:'n1',minor:2}
  await apply([beacon,next],fresh,sid,true,1)
  assert.equal((await db.query('SELECT count(*)::int n FROM beacon')).rows[0].n,2)
  assert.equal((await db.query('SELECT count(*)::int n FROM audit_log')).rows[0].n,2)
  const identities=(await db.query('SELECT node_ids,beacon_ids FROM node_map_editor_identity WHERE ar_development_id=1')).rows[0]
  assert.equal(identities.node_ids.n1,10)
  assert.equal(identities.beacon_ids.b,Number(id))
  assert.equal((await db.query('SELECT payload FROM node_map_snapshot WHERE snapshot_id=$1',[sid])).rows[0].payload.saveBody.beacons,undefined)
 } finally { await db.close() }
})
