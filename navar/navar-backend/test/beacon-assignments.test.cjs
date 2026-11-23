const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const { validateNodeConfig } = require('../modules/mallManagement/beaconAssignments')

test('assignment validation rejects duplicate versions and foreign nodes', () => {
	const context = { versions: [{ id: 1 }, { id: 2 }], nodes: [{ nodeId: 10, versionId: 1 }, { nodeId: 20, versionId: 2 }] }
	assert.equal(validateNodeConfig([{ versionId: 1, nodeId: 10 }, { versionId: 2, nodeId: 20 }], context).length, 2)
	assert.throws(() => validateNodeConfig([{ versionId: 1, nodeId: 10 }, { versionId: 1, nodeId: 10 }], context), /Only one node/)
	assert.throws(() => validateNodeConfig([{ versionId: 1, nodeId: 20 }], context), /belong/)
	assert.throws(() => validateNodeConfig({}, context), /list/)
})

test('beacon transaction saves, replaces and removes per-version links and rolls back invalid saves', async () => {
	const db = new PGlite()
	try {
		await db.exec(`
			CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
			CREATE TABLE mall (mall_id bigint PRIMARY KEY);
			CREATE TABLE floor (floor_id integer PRIMARY KEY, mall_id bigint);
			CREATE TABLE application (application_id bigint PRIMARY KEY, mall_id bigint);
			CREATE TABLE ar_development (ar_development_id bigint PRIMARY KEY, application_id bigint);
			CREATE TABLE node (node_id bigint PRIMARY KEY, ar_development_id bigint, floor_id integer);
			CREATE TABLE beacon (beacon_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
				beacon_code text UNIQUE, beacon_label text, beacon_minor integer, beacon_tx_power integer,
				beacon_status text, beacon_location text, beacon_node_count integer,
				beacon_installed_at timestamptz, beacon_maintained_at timestamptz, mall_id bigint, floor_id integer);
			CREATE TABLE battery (battery_code text NOT NULL, battery_brand text, battery_status text, battery_installed_at timestamptz, beacon_id bigint);
			CREATE TABLE beacon_node_assignment (assignment_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
				beacon_id bigint REFERENCES beacon, node_id bigint REFERENCES node, ar_development_id bigint REFERENCES ar_development,
				assignment_created_at timestamptz, assignment_updated_at timestamptz, UNIQUE(ar_development_id, beacon_id));
			INSERT INTO mall VALUES (1),(2); INSERT INTO floor VALUES (1,1),(2,2),(3,1);
			INSERT INTO application VALUES (1,1),(2,1),(3,2);
			INSERT INTO ar_development VALUES (1,1),(2,2),(3,3);
			INSERT INTO node VALUES (10,1,1),(11,1,1),(20,2,3),(30,3,2);
		`)
		await db.exec(fs.readFileSync(path.join(__dirname, '../database_schema/save_beacon_with_assignments.sql'), 'utf8'))
		const beacon = { beacon_code: 'TEST', beacon_label: 'Initial', beacon_status: 'placed', floor_id: null }
		const battery = { battery_code: 'BAT', battery_brand: 'Test', battery_installed_at: '2026-10-25' }
		const save = (id, links, details = beacon, batteryData = battery) => db.query('SELECT save_beacon_with_assignments(1,$1,$2,$3,$4) AS id', [id, JSON.stringify(details), JSON.stringify(links), JSON.stringify(batteryData)])
		const links = [{ versionId: 1, nodeId: 10 }, { versionId: 2, nodeId: 20 }]
		const id = (await save(null, links)).rows[0].id
		assert.equal((await db.query('SELECT count(*)::int AS count FROM beacon_node_assignment')).rows[0].count, 2)
		assert.equal((await db.query('SELECT floor_id FROM beacon')).rows[0].floor_id, null)
		await assert.rejects(save(id, [{ versionId: 1, nodeId: 10 }, { versionId: 1, nodeId: 11 }]), /Only one node/)
		await assert.rejects(save(id, [{ versionId: 1, nodeId: 20 }]), /belong/)
		await assert.rejects(save(id, [{ versionId: 3, nodeId: 30 }]), /belong/)
		await assert.rejects(save(id, links, { ...beacon, floor_id: 2 }), /Floor/)
		await assert.rejects(save(null, [], { ...beacon, beacon_code: 'ROLLBACK' }, { ...battery, battery_code: null }), /null/)
		assert.equal((await db.query('SELECT count(*)::int AS count FROM beacon')).rows[0].count, 1)
		await save(id, [{ versionId: 1, nodeId: 11 }], { ...beacon, beacon_label: 'Edited' })
		assert.deepEqual((await db.query('SELECT node_id::int, ar_development_id::int FROM beacon_node_assignment')).rows, [{ node_id: 11, ar_development_id: 1 }])
		assert.equal((await db.query('SELECT beacon_node_count FROM beacon')).rows[0].beacon_node_count, 1)
		await save(id, [])
		assert.equal((await db.query('SELECT count(*)::int AS count FROM beacon_node_assignment')).rows[0].count, 0)
		assert.equal((await db.query('SELECT beacon_node_count FROM beacon')).rows[0].beacon_node_count, 0)
	} finally { await db.close() }
})
