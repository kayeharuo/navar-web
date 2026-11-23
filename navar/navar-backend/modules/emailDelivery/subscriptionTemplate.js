'use strict'
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const images = ['navar-icon-png.png', 'navar-wordmark-png.png'].map(filename => ({
  filename,
  content: readFileSync(join(__dirname, '../../email_template/inquiry/images', filename)),
  contentType: 'image/png',
  contentDisposition: 'inline',
  cid: `subscription-${filename}@navar`,
}))

function subscriptionEmail({ subject, body, type = '' }) {
  const introductions = {
    subscription_suspended: 'We are writing to inform you that your mall subscription has been suspended. Please review the details and any required action below.',
    subscription_restored: 'We are pleased to inform you that the operational suspension of your mall subscription has been lifted.',
    subscription_grace_started: 'Our records indicate that your mall subscription has reached its expiry date and has entered the grace period. Please review the renewal information below.',
    subscription_payment: 'This email confirms that a payment update has been recorded for your mall subscription. Please review the confirmation details below.',
    subscription_tier_scheduled: 'We are writing to confirm that a change to your mall subscription tier has been scheduled. Please review the details below.',
  }
  const introduction = introductions[type] || (type.startsWith('subscription_expiry_')
    ? 'This is a reminder regarding the upcoming expiry of your mall subscription. We kindly request that you review the renewal details below.'
    : type.startsWith('subscription_grace_ending_')
      ? 'We would like to remind you that the grace period for your mall subscription is approaching its end. Please review the outstanding renewal requirements below.'
      : 'We are writing to provide an update regarding your mall subscription. Please review the details below.')
  const text = [
    'Good day,', introduction, String(body ?? ''),
    'Please sign in to your mall administrator account to review your subscription details and complete any required action.',
    'If you need clarification or assistance, please contact the NavAR team through your usual support channel.',
    'Thank you for your attention and continued cooperation.', 'Sincerely,\nThe NavAR Team',
  ].join('\n\n')
  const paragraphs = text.split(/\r?\n\s*\r?\n/).map(paragraph => `<p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#374151;">${escapeHtml(paragraph).replace(/\r\n|\r|\n/g, '<br>')}</p>`).join('')
  return {
    text,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
<tr><td align="center" style="background:#cfe8ff;padding:32px 24px;"><img src="cid:subscription-navar-icon-png.png@navar" width="44" height="44" alt="" style="display:block;margin:0 auto 12px;"><img src="cid:subscription-navar-wordmark-png.png@navar" width="140" alt="NavAR" style="display:block;margin:0 auto;height:auto;"></td></tr>
<tr><td style="padding:32px 32px 12px;"><p style="margin:0 0 20px;font-size:20px;line-height:28px;color:#0f172a;font-weight:bold;">${escapeHtml(subject)}</p>${paragraphs}</td></tr>
<tr><td style="padding:0 32px;"><hr style="border:0;border-top:1px solid #e5e7eb;margin:0;"></td></tr>
<tr><td style="padding:24px 32px 32px;"><p style="margin:0;font-size:12px;line-height:18px;color:#6b7280;">This is an automated subscription update from NavAR. Sign in to your mall administrator account to review your subscription and any required action.</p></td></tr>
</table><p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">NavAR &middot; Indoor navigation, augmented</p>
</td></tr></table></body></html>`,
    attachments: images.map(image => ({ ...image })),
  }
}
module.exports = { subscriptionEmail }
