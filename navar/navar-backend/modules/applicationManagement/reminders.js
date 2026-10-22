'use strict'
const nodemailer = require('nodemailer')

async function runReadyReminders(supabase) {
	const claimed = await supabase.rpc('claim_ready_reminders')
	if (claimed.error) throw claimed.error
	const queued = await supabase.from('email_log').select('email_log_id,email_log_to_email,email_log_subject,email_log_body')
		.eq('email_log_type', 'ar_ready_reminder').eq('email_log_status', 'queued').limit(100)
	if (queued.error) throw queued.error
	if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { reminders: claimed.data, emailWaitingForSMTP: queued.data.length }
	const transport = nodemailer.createTransport({
		host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465),
		secure: (process.env.SMTP_SECURE || 'true') === 'true',
		auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
		connectionTimeout: 10000, socketTimeout: 20000,
	})
	for (const email of queued.data) {
		const lock = await supabase.from('email_log').update({ email_log_status: 'sending' })
			.eq('email_log_id', email.email_log_id).eq('email_log_status', 'queued').select('email_log_id')
		if (lock.error) throw lock.error
		if (!lock.data.length) continue
		let status = 'sent'
		try {
			await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email.email_log_to_email, subject: email.email_log_subject, text: email.email_log_body })
		} catch { status = 'failed' }
		const saved = await supabase.from('email_log').update({ email_log_status: status, email_log_sent_at: new Date().toISOString(), email_log_fail_reason: status === 'failed' ? 'SMTP delivery failed; review before retrying.' : null }).eq('email_log_id', email.email_log_id)
		if (saved.error) throw saved.error
	}
	return { reminders: claimed.data }
}

module.exports = { runReadyReminders }
