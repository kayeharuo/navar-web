const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Fastify = require('fastify')
const { PGlite } = require('@electric-sql/pglite')
const registerRoutes = require('../modules/systemSettings/routes')
const card = require('../modules/systemSettings/rate-card-v4-1.json')
const {estimateQuote} = require('../modules/subscriptions/quote')

test('v4 migration and settings round trip preserve snapshots and save tiers atomically', async () => {
  const db = new PGlite()
  const app = Fastify()
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE subscription_tier (
        s_tier_key text PRIMARY KEY, s_tier_annual_fee numeric,
        s_tier_grace_period_days integer, s_tier_reinstatement_rate numeric,
        s_tier_max_admin_account integer, s_tier_included_onsite_visits integer,
        s_tier_free_extra_stalls_per_year integer, s_tier_map_updates_per_year integer,
        s_tier_extra_onsite_visit_fee numeric, s_tier_beacon_replacement_fee numeric,
        s_tier_additional_stall_fee numeric, s_tier_map_update_pricing text,
        s_tier_analytics_level text, s_tier_analytics_tools text, s_tier_ar_priority text,
        s_tier_remote_response_sla text, s_tier_onsite_dispatch_sla text, s_tier_updated_at timestamptz
      );
      INSERT INTO subscription_tier(s_tier_key) VALUES ('basic'),('standard'),('premium');
      CREATE TABLE contract (snapshot jsonb); INSERT INTO contract VALUES ('{"annual":9999}');
      CREATE TABLE onboarding_quote (snapshot jsonb); INSERT INTO onboarding_quote VALUES ('{"fee":12345,"version":"v3"}');
      CREATE TABLE navar_rate_card(version text PRIMARY KEY, rates jsonb NOT NULL, tiers jsonb NOT NULL, created_at timestamptz DEFAULT now());
      INSERT INTO navar_rate_card VALUES ('v3', '{"installCost":200}', '{}', now());
    `)
    const migration = fs.readFileSync(path.join(__dirname, '../database_schema/40_pricing_v4.sql'), 'utf8')
    await db.exec(migration)
    const previousCard = (await db.query("SELECT rates FROM navar_rate_card WHERE version='v4-draft-2026-11-20'")).rows[0].rates
    const revision = fs.readFileSync(path.join(__dirname, '../database_schema/41_pricing_v4_1.sql'), 'utf8')
    await db.exec(revision)
    assert.deepEqual((await db.query("SELECT rates FROM navar_rate_card WHERE version='v4-draft-2026-11-20'")).rows[0].rates, previousCard)
    assert.equal(card.rates.installCost, 75)
    assert.equal(card.rates.contingency, 0.1)
    assert.equal(card.rates.margin, 0.2)
    const seeded = (await db.query('SELECT * FROM navar_rate_card WHERE version=$1', [card.version])).rows[0]
    assert.deepEqual(seeded.rates, card.rates)
    assert.deepEqual(seeded.tiers, card.tiers)
    assert.equal((await db.query('SELECT count(*)::int n FROM navar_rate_card')).rows[0].n, 3)
    assert.deepEqual((await db.query('SELECT snapshot FROM contract')).rows[0].snapshot, { annual: 9999 })
    assert.deepEqual((await db.query('SELECT snapshot FROM onboarding_quote')).rows[0].snapshot, { fee: 12345, version: 'v3' })
    assert.equal((await db.query("SELECT has_function_privilege('anon','save_system_subscription_tiers(jsonb)','EXECUTE') allowed")).rows[0].allowed, false)

    await db.exec('CREATE TABLE application(application_status text)')
    await db.exec(fs.readFileSync(path.join(__dirname, '../database_schema/47_editable_rates_and_ar_queue.sql'), 'utf8'))
    await db.exec("ALTER TABLE subscription_tier ADD COLUMN s_tier_map_update_rate numeric;UPDATE subscription_tier SET s_tier_map_update_rate=CASE s_tier_key WHEN 'basic' THEN 0.5 WHEN 'standard' THEN 0.4 ELSE 0.3 END")
    const percentageMigration=fs.readFileSync(path.join(__dirname,'../database_schema/72_onboarding_based_map_updates.sql'),'utf8')
    const patchStart=percentageMigration.indexOf("SELECT pg_get_functiondef('public.save_system_subscription_tiers(jsonb)'")
    const patchEnd=percentageMigration.indexOf('END $migration$;',patchStart)
    await db.exec('DO $migration$ DECLARE definition text;needle text;BEGIN '+percentageMigration.slice(patchStart,patchEnd)+'END $migration$;')
    app.decorate('supabase', {
      from(table) {
        if (table === 'navar_rate_card') return {select:()=>({eq:()=>({single:async()=>({data:(await db.query('SELECT * FROM navar_rate_card WHERE is_current')).rows[0]})})})}
        if (table === 'audit_log') return { insert: async () => ({ error: null }) }
        return { select: () => ({ in: async () => ({ data: (await db.query('SELECT * FROM subscription_tier')).rows }) }) }
      },
      async rpc(name, args) {
        assert(['save_system_subscription_tiers','save_system_pricing'].includes(name))
        try { if(name==='save_system_pricing') await db.query('SELECT save_system_pricing($1,$2,$3,$4)',[JSON.stringify(args.p_updates),JSON.stringify(args.p_rates),args.p_expected_version,args.p_version]); else await db.query('SELECT save_system_subscription_tiers($1)', [JSON.stringify(args.p_updates)]); return {} }
        catch (error) { return { error } }
      },
    })
    app.addHook('preHandler', async request => { request.admin = { id: 1, role: 'super_admin' } })
    registerRoutes(app)
    const response = await app.inject('/api/system-settings/subscription-tiers')
    assert.equal(response.statusCode, 200)
    const { values } = response.json()
    assert.equal(values.extraStall.basic, '₱1,100')
    assert.equal(values.extraStall.premium, '₱1,000')
    assert.equal(values.extraStall.standard, '₱1,000')
    assert.equal(values.beaconReplacement.basic, '₱815 each')
    assert.equal(values.freeStalls.premium, '10')
    assert.equal(values.freeMapUpdates.premium, '1')
    assert.equal(values.paidMapUpdate.basic, '50%')
    assert.equal(values.paidMapUpdate.standard,'40%');assert.equal(values.paidMapUpdate.premium,'30%')
    const save = body => app.inject({ method: 'PUT', url: '/api/system-settings/subscription-tiers', payload: { values: body } })
    const valid = await save(values)
    assert.equal(valid.statusCode, 200, valid.body)
    assert.deepEqual(valid.json().values, values)
    const before = (await db.query('SELECT * FROM subscription_tier ORDER BY s_tier_key')).rows
    for (const invalid of ['-5', '', '1.5', 'NaN']) {
      const changed = structuredClone(values)
      changed.annualFee.basic = '99999'
      changed.freeStalls.premium = invalid
      assert.equal((await save(changed)).statusCode, 400)
      assert.deepEqual((await db.query('SELECT * FROM subscription_tier ORDER BY s_tier_key')).rows, before)
    }
    for(const invalid of ['0%','101%','-1%','28000']) {
      const changed=structuredClone(values);changed.paidMapUpdate.basic=invalid
      assert.equal((await save(changed)).statusCode,400)
      assert.deepEqual((await db.query('SELECT * FROM subscription_tier ORDER BY s_tier_key')).rows,before)
    }
    const updates = structuredClone(before)
    updates[0].s_tier_annual_fee = 99999
    updates[1].s_tier_map_update_rate = 1.1
    await assert.rejects(db.query('SELECT save_system_subscription_tiers($1)', [JSON.stringify(updates)]), /Invalid tier/)
    assert.deepEqual((await db.query('SELECT * FROM subscription_tier ORDER BY s_tier_key')).rows, before)
    const changedRates = {...card.rates,installCost:125}
    const rateSave = await app.inject({method:'PUT',url:'/api/system-settings/subscription-tiers',payload:{values,onboardingRates:changedRates,rateVersion:card.version}})
    assert.equal(rateSave.statusCode,200,rateSave.body)
    assert.equal(rateSave.json().rateCard.rates.installCost,125)
    const quoteInputs={stores:3,tenants:3,averageRent:50000,floors:[{floorNum:1,areaSqm:100}]}
    const originalQuote=estimateQuote(quoteInputs,card),newQuote=estimateQuote(quoteInputs,rateSave.json().rateCard)
    assert(newQuote.costCent>originalQuote.costCent)
    assert.equal(newQuote.rateSnapshot.installCost,125)
    assert.notEqual(newQuote.rateVersion,originalQuote.rateVersion)
    await db.exec("INSERT INTO application(application_status) VALUES('submitted'); UPDATE application SET application_status='approved'")
    assert((await db.query('SELECT application_approved_at FROM application')).rows[0].application_approved_at)
    const approvedAt=(await db.query('SELECT application_approved_at FROM application')).rows[0].application_approved_at
    await db.exec("UPDATE application SET application_status='approved'")
    assert.deepEqual((await db.query('SELECT application_approved_at FROM application')).rows[0].application_approved_at,approvedAt)
    assert.equal((await db.query('SELECT rates FROM navar_rate_card WHERE version=$1',[card.version])).rows[0].rates.installCost,75)
    const stale=await app.inject({method:'PUT',url:'/api/system-settings/subscription-tiers',payload:{values,onboardingRates:changedRates,rateVersion:card.version}})
    assert.equal(stale.statusCode,409)
    for(const margin of [1,-1,'']) {
      const invalid=await app.inject({method:'PUT',url:'/api/system-settings/subscription-tiers',payload:{values,onboardingRates:{...changedRates,margin},rateVersion:rateSave.json().rateCard.version}})
      assert.equal(invalid.statusCode,400)
    }
    assert.deepEqual((await db.query('SELECT snapshot FROM contract')).rows[0].snapshot,{annual:9999})
    assert.deepEqual((await db.query('SELECT snapshot FROM onboarding_quote')).rows[0].snapshot,{fee:12345,version:'v3'})
    await db.exec(migration)
  } finally { await app.close(); await db.close() }
})
