const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')

test('notification wording respects recipients, backfills history and preserves mall messages and mail', async () => {
  const db = new PGlite()
  const migration = file => fs.readFileSync(path.join(__dirname, '../database_schema', file), 'utf8')
  try {
    await db.exec(fs.readFileSync(path.join(__dirname, 'fixtures/subscription-baseline.sql'), 'utf8'))
    await db.exec(migration('42_subscription_lifecycle.sql'))
    await db.exec(`INSERT INTO mall(mall_id,mall_name) VALUES(1,'Test Mall'),(2,'Other Mall');
      INSERT INTO admin(admin_id,admin_role,admin_account_status,admin_is_deactivated,admin_email,mall_id) VALUES
      (1,'super_admin','official',false,'super@example.test',NULL),
      (2,'mall_admin','official',false,'mall@example.test',1),
      (3,'mall_admin','official',false,'other@example.test',2),
      (4,'super_admin','official',true,'inactive@example.test',NULL),
      (5,'super_admin','official',false,'second@example.test',NULL);`)
    const original = 'AR is unpublished for an operational pause. Contact NavAR to restore it; the subscription clock continues.'
    await db.query('SELECT emit_subscription_event($1,1,$2,$3,$4)', ['old-operational','suspended','Subscription suspended: Operational',original])
    await db.exec(`UPDATE admin_notification SET admin_notif_is_read=true,admin_notif_is_archived=true;
      INSERT INTO admin_notification(admin_id,mall_id,admin_notif_source_type,admin_notif_message) VALUES
      (1,1,'application_approved','Your application was approved and AR development is now pending in the queue.'),
      (2,1,'application_approved','Your application was approved and AR development is now pending in the queue.'),
      (1,1,'ar_development_status_changed','Node mapping has started for your mall.'),
      (1,1,'application_revision_requested','Please update your floor plan.');`)
    const mallBefore = (await db.query('SELECT * FROM admin_notification WHERE admin_id=2 ORDER BY admin_notif_id')).rows
    const emailBefore = (await db.query('SELECT * FROM email_log')).rows
    await db.exec(migration('46_notification_audience_wording.sql'))
    const historical = (await db.query("SELECT * FROM admin_notification WHERE admin_id=1 AND admin_notif_source_type='subscription'")).rows[0]
    assert.match(historical.admin_notif_message, /^Test Mall:.*Lift the operational suspension/)
    assert.equal(historical.admin_notif_is_read, true)
    assert.equal(historical.admin_notif_is_archived, true)
    assert.deepEqual((await db.query('SELECT * FROM admin_notification WHERE admin_id=2 ORDER BY admin_notif_id')).rows, mallBefore)
    assert.deepEqual((await db.query('SELECT * FROM email_log')).rows, emailBefore)
    assert.equal((await db.query("SELECT admin_notif_message message FROM admin_notification WHERE admin_id=1 AND admin_notif_source_type='application_revision_requested'")).rows[0].message,'Please update your floor plan.')
    assert.match((await db.query("SELECT admin_notif_message message FROM admin_notification WHERE admin_id=1 AND admin_notif_source_type='application_approved'")).rows[0].message,/^Test Mall: The mall application/)
    const cases = [
      ['suspended','Subscription suspended: Operational',original],
      ['suspended','Subscription suspended: Breach of Contract','AR is unpublished. Renew the annual subscription and settle the reinstatement fee and PHP 500 penalty.'],
      ['restored','Subscription suspension lifted','The operational suspension has been lifted. Your subscription dates are unchanged.'],
      ...[30,15,10,5,1].map(days => [`expiry_${days}`,'Subscription expiry reminder','Your subscription expires on Nov 30, 2026. Renew through your mall subscription page. After grace, annual subscription and 20% reinstatement fees are due.']),
      ['grace_started','Subscription grace period started','Your subscription expired on Nov 30, 2026. Renew now to avoid suspension and reinstatement fees.'],
      ...[5,1].map(days => [`grace_ending_${days}`,'Subscription grace period is ending','Your subscription expires on Nov 30, 2026. Renew through your mall subscription page.']),
      ['payment','TEST payment confirmed','Test payment was recorded.'],
      ['tier_scheduled','Subscription tier change scheduled','The Basic tier is scheduled for renewal.'],
      ['stall_changed','Stall deactivated','Test stall was deactivated. Review its application, allowance and any fee before approval.'],
    ]
    for (const [index,[kind,title,message]] of cases.entries()) {
      const key = `future-${index}`
      await db.query('SELECT emit_subscription_event($1,1,$2,$3,$4)', [key,kind,title,message])
      const notifications = (await db.query('SELECT n.* FROM admin_notification n JOIN subscription_event e ON e.event_id=n.admin_notif_source_id WHERE n.admin_notif_source_type=\'subscription\' AND e.event_key=$1 ORDER BY admin_id', [key])).rows
      assert.deepEqual(notifications.map(n => n.admin_id), [1,2,5])
      for (const note of notifications.filter(n => n.admin_id !== 2)) {
        assert.match(note.admin_notif_message,/^Test Mall:/)
        assert.doesNotMatch(note.admin_notif_message,/Your subscription|your mall|Contact NavAR|Renew through/)
        assert.equal(note.admin_notif_action_url,'/subscription-management')
      }
      assert.equal(notifications.find(n => n.admin_id === 2).admin_notif_message,message)
      assert.equal((await db.query('SELECT email_log_body body FROM email_log WHERE email_log_source_id=(SELECT event_id::text FROM subscription_event WHERE event_key=$1)',[key])).rows[0].body,message)
    }
    const count = (await db.query('SELECT count(*)::int n FROM admin_notification')).rows[0].n
    await db.query('SELECT emit_subscription_event($1,1,$2,$3,$4)', ['future-0',...cases[0]])
    assert.equal((await db.query('SELECT count(*)::int n FROM admin_notification')).rows[0].n,count)
    await db.exec(migration('46_notification_audience_wording.sql'))
    assert.equal((await db.query('SELECT count(*)::int n FROM admin_notification')).rows[0].n,count)
    const grants = (await db.query("SELECT has_function_privilege('anon','subscription_super_admin_message(text,text,text)','EXECUTE') anon, has_function_privilege('authenticated','emit_subscription_event(text,bigint,text,text,text,boolean)','EXECUTE') authenticated, has_function_privilege('service_role','emit_subscription_event(text,bigint,text,text,text,boolean)','EXECUTE') service")).rows[0]
    assert.deepEqual(grants,{anon:false,authenticated:false,service:true})
  } finally {
    await db.close()
  }
})
