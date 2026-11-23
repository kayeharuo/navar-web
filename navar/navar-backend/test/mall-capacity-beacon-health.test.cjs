const {test}=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path')
const migration=name=>fs.readFileSync(path.join(__dirname,'../database_schema',name),'utf8')
test('store capacity includes stalls, preserves paid approved expansions and rejects reactivation/mall moves past the limit',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`CREATE SCHEMA app_private;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
  CREATE TABLE mall(mall_id bigint PRIMARY KEY,quoted_store_count int,quoted_tenant_count int);INSERT INTO mall VALUES(1,3,3),(2,1,1),(3,NULL,NULL);
  CREATE TABLE mall_onboarding(mall_id bigint,quote_id bigint);INSERT INTO mall_onboarding VALUES(1,1);
  CREATE TABLE onboarding_quote(quote_id bigint,capacity jsonb,raw_inputs jsonb);INSERT INTO onboarding_quote VALUES(1,'{"stores":3,"tenants":3}','{"floors":[{"floorNum":1,"areaSqm":100}]}');
  CREATE TABLE mall_service_request(service_id bigint,mall_id bigint,kind text,status text,inputs jsonb,quote jsonb,payment_request_id bigint);
  CREATE TABLE stall_expansion(service_id bigint,status text);
  CREATE TABLE contract_payment_request(request_id bigint,status text,fulfilled_at timestamptz,reconciliation_reason text,amount_cent bigint);
  CREATE TABLE store(store_id bigint PRIMARY KEY,mall_id bigint,store_status text,store_type text,store_name text,store_updated_at timestamptz DEFAULT now());
  CREATE FUNCTION public.emit_subscription_event(text,bigint,text,text,text,boolean) RETURNS void LANGUAGE plpgsql AS $$BEGIN RETURN;END$$;`)
  await db.exec(migration('74_mall_establishment_capacity.sql'))
  await db.exec("INSERT INTO store(store_id,mall_id,store_status,store_type,store_name) VALUES(1,1,'mapped','store','A'),(2,1,'unmapped','store','B'),(3,1,'unmapped','stall','C'),(10,2,'mapped','store','D')")
  await assert.rejects(()=>db.exec("INSERT INTO store VALUES(4,1,'unmapped','stall','Extra',now())"),/capacity reached/)
  await db.exec("UPDATE store SET store_status='inactive' WHERE store_id=1;INSERT INTO store VALUES(4,1,'unmapped','store','Replacement',now())")
  await assert.rejects(()=>db.exec("UPDATE store SET store_status='mapped' WHERE store_id=1"),/capacity reached/)
  await assert.rejects(()=>db.exec('UPDATE store SET mall_id=2 WHERE store_id=4'),/capacity reached/)
  await assert.rejects(()=>db.exec("INSERT INTO store VALUES(20,3,'unmapped','store','Unknown capacity',now())"),/Set the mall onboarding/)
  await db.exec("INSERT INTO mall_service_request VALUES(1,1,'stall_addon','in_progress','{\"quantity\":2}','{\"amount_cent\":20000}',1);INSERT INTO stall_expansion VALUES(1,'approved');INSERT INTO contract_payment_request VALUES(1,'paid',now(),NULL,20000)")
  const state=(await db.query('SELECT public.mall_capacity_state(1) AS state')).rows[0].state
  assert.equal(state.totalCapacity,5);assert.equal(state.approvedExtraStalls,2);assert.equal(state.quoteFloors[0].areaSqm,100)
  await db.exec("INSERT INTO store VALUES(5,1,'unmapped','stall','Approved 1',now()),(6,1,'unmapped','stall','Approved 2',now())")
  await assert.rejects(()=>db.exec("INSERT INTO store VALUES(7,1,'unmapped','store','Over',now())"),/capacity reached/)
  await db.exec('UPDATE mall SET quoted_store_count=999 WHERE mall_id=1')
  assert.equal((await db.query('SELECT public.mall_capacity_state(1) AS s')).rows[0].s.totalCapacity,5)
 }finally{await db.close()}
})

test('faulty beacons block linked nodes and edges, recovery restores them, and retired assignments transfer safely',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`CREATE SCHEMA app_private;CREATE ROLE anon;CREATE ROLE authenticated;
   CREATE TABLE node(node_id bigint PRIMARY KEY,ar_development_id bigint);INSERT INTO node VALUES(1,10),(2,10),(3,11);
   CREATE TABLE edge(start_node_id bigint,end_node_id bigint);INSERT INTO edge VALUES(1,2);
   CREATE TABLE beacon(beacon_id bigint PRIMARY KEY,beacon_status text,beacon_node_count int DEFAULT 0);INSERT INTO beacon(beacon_id,beacon_status) VALUES(1,'placed'),(2,'placed');
   CREATE TABLE beacon_node_assignment(assignment_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,beacon_id bigint,node_id bigint,ar_development_id bigint,UNIQUE(node_id,ar_development_id));INSERT INTO beacon_node_assignment(beacon_id,node_id,ar_development_id) VALUES(1,1,10),(1,3,11);
   ALTER TABLE node ENABLE ROW LEVEL SECURITY;ALTER TABLE edge ENABLE ROW LEVEL SECURITY;GRANT SELECT ON node,edge TO authenticated,anon;CREATE POLICY published_nodes ON node FOR SELECT USING(true);CREATE POLICY published_edges ON edge FOR SELECT USING(true);`)
  await db.exec(migration('75_beacon_node_availability.sql'))
  await db.exec(migration('76_beacon_assignment_counts.sql'))
  await db.exec("UPDATE beacon SET beacon_status='faulty' WHERE beacon_id=1")
  assert.equal((await db.query('SELECT node_is_active FROM node WHERE node_id=1')).rows[0].node_is_active,false)
  await db.exec('UPDATE node SET node_is_active=true WHERE node_id=1')
  assert.equal((await db.query('SELECT node_is_active FROM node WHERE node_id=1')).rows[0].node_is_active,false)
  await db.exec('SET ROLE authenticated')
  assert.equal((await db.query('SELECT count(*)::int n FROM node')).rows[0].n,1)
  assert.equal((await db.query('SELECT count(*)::int n FROM edge')).rows[0].n,0)
  await db.exec("RESET ROLE;UPDATE beacon SET beacon_status='placed' WHERE beacon_id=1")
  assert.equal((await db.query('SELECT node_is_active FROM node WHERE node_id=1')).rows[0].node_is_active,true)
  await assert.rejects(()=>db.exec('INSERT INTO beacon_node_assignment(beacon_id,node_id,ar_development_id) VALUES(2,1,10)'),/assigned to another beacon/)
  await db.exec("UPDATE beacon SET beacon_status='deactivated' WHERE beacon_id=1;INSERT INTO beacon_node_assignment(beacon_id,node_id,ar_development_id) VALUES(2,1,10)")
  assert.equal((await db.query('SELECT beacon_id FROM beacon_node_assignment WHERE node_id=1')).rows[0].beacon_id,2)
  assert.deepEqual((await db.query('SELECT beacon_node_count FROM beacon ORDER BY beacon_id')).rows.map(r=>r.beacon_node_count),[1,1])
  assert.equal((await db.query('SELECT beacon_id FROM beacon_node_assignment WHERE node_id=3')).rows[0].beacon_id,1)
  assert.equal((await db.query('SELECT node_is_active FROM node WHERE node_id=1')).rows[0].node_is_active,true)
  await db.exec("UPDATE beacon SET beacon_status='faulty' WHERE beacon_id=2;UPDATE beacon SET beacon_status='placed' WHERE beacon_id=1")
  assert.equal((await db.query('SELECT node_is_active FROM node WHERE node_id=1')).rows[0].node_is_active,false)
  await db.exec("UPDATE beacon SET beacon_status='placed' WHERE beacon_id=2;SET ROLE authenticated")
  assert.equal((await db.query('SELECT count(*)::int n FROM edge')).rows[0].n,1)
 }finally{await db.close()}
})
