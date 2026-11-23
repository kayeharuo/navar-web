const { test } = require('node:test')
const assert = require('node:assert/strict')
const { subscriptionEmail } = require('../modules/emailDelivery/subscriptionTemplate')

test('subscription email escapes saved content and embeds both brand images', () => {
  const mail = subscriptionEmail({ subject: 'Subscription <Update>', body: 'Mall A & B\nRenew tomorrow.\n\n<script>alert("x")</script>' })
  assert.match(mail.html, /Subscription &lt;Update&gt;/)
  assert.match(mail.html, /Mall A &amp; B<br>Renew tomorrow\./)
  assert.doesNotMatch(mail.html, /<script>/)
  assert.doesNotMatch(mail.html, /\{\{.*?\}\}/)
  assert.match(mail.text, /^Good day,/)
  assert.match(mail.text, /Sincerely,\nThe NavAR Team$/)
  assert.equal(mail.attachments.length, 2)
  for (const image of mail.attachments) {
    assert.ok(image.content.length > 0)
    assert.ok(mail.html.includes(`cid:${image.cid}`))
    assert.equal(image.contentDisposition, 'inline')
  }
})

test('subscription correspondence explains the event and retains exact payment and expiry details', () => {
  for (const type of ['subscription_suspended','subscription_restored','subscription_grace_started','subscription_expiry_30','subscription_grace_ending_1','subscription_payment','subscription_tier_scheduled']) {
    const mail = subscriptionEmail({subject:'Subscription update',body:'Expiry: Nov 30, 2026. Amount: PHP 25,000. TEST payment only.',type})
    assert.match(mail.text,/Good day,/)
    assert.match(mail.text,/Expiry: Nov 30, 2026\. Amount: PHP 25,000\. TEST payment only\./)
    assert.match(mail.html,/Thank you for your attention/)
  }
  assert.match(subscriptionEmail({type:'subscription_restored',body:'Dates unchanged.'}).text,/operational suspension.*has been lifted/)
})
