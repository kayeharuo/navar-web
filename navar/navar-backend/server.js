require('dotenv').config()

const Fastify = require('fastify')
const cors = require('@fastify/cors')
const helmet = require('@fastify/helmet')
const rateLimit = require('@fastify/rate-limit')
const { createClient } = require('@supabase/supabase-js')
const registerInquiryRoutes = require('./modules/inquiries/routes')
const registerInquiryCorrections = require('./modules/inquiries/correctionsPublic')
const registerMallManagementRoutes = require('./modules/mallManagement/routes')
const createAuthGuards = require('./modules/auth/authGuard')
const registerAccountManagementRoutes = require('./modules/accountManagement/routes')
const registerApplicationTestingRoutes = require('./modules/applicationTesting/routes')
const registerApplicationManagementRoutes = require('./modules/applicationManagement/routes')
const registerNodeMapRoutes = require('./modules/nodeMap/routes')
const { registerAuditLogRoutes } = require('./modules/auditLog/routes')
const registerSystemSettingsRoutes = require('./modules/systemSettings/routes')

const app = Fastify({ logger: true, bodyLimit: 25 * 1024 * 1024 })

const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '127.0.0.1'
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!process.env.SUPABASE_URL || !secretKey) {
	throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set in .env')
}

const supabase = createClient(
	process.env.SUPABASE_URL,
	secretKey,
	{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
)

app.decorate('supabase', supabase)

app.register(cors, {
	origin: frontendOrigin,
	credentials: true,
	methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
})
app.register(helmet, {
	crossOriginResourcePolicy: { policy: 'cross-origin' },
})
app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

app.setErrorHandler((error, request, reply) => {
	request.log.error({ err: error }, 'Request failed')
	const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500
	return reply.code(statusCode).send({ message: error.workflowMessage || 'Something went wrong.' })
})

require('./modules/subscriptions/routes').registerPublic(app)

const startedAt = new Date().toISOString()
app.get('/health', async () => ({
	status: 'ok',
	service: 'navar-backend',
	pid: process.pid,
	startedAt
}))

const { requireAuth, requireSuperAdmin, requirePrimarySuperAdmin } = createAuthGuards(supabase)
registerInquiryCorrections(app)

app.register(async protectedApp => {
	protectedApp.addHook('preHandler', requireAuth())
	protectedApp.addHook('preHandler', requireSuperAdmin)
	registerInquiryRoutes(protectedApp, {env:require('./modules/emailDelivery/service').officialEnv()})
	registerMallManagementRoutes(protectedApp)
	protectedApp.register(async workflowApp => {
		registerApplicationManagementRoutes(workflowApp)
	})
	registerNodeMapRoutes(protectedApp)
	registerAuditLogRoutes(protectedApp)
	registerSystemSettingsRoutes(protectedApp)
	require('./modules/subscriptions/routes').registerAdmin(protectedApp)
 require('./modules/stallApplications/routes')(protectedApp)
 require('./modules/mapApplications/routes')(protectedApp)
	require('./modules/emailDelivery/routes')(protectedApp)
})

// Separate mall-portal API: same verified identity, ownership checked in its module.
app.register(async mallWorkflowApp => {
 mallWorkflowApp.addHook('preHandler', requireAuth())
 require('./modules/applicationManagement/mallWorkflowRoutes')(mallWorkflowApp)
 require('./modules/subscriptions/routes').registerMall(mallWorkflowApp)
 require('./modules/stallApplications/routes').registerMall(mallWorkflowApp)
 require('./modules/mapApplications/routes').registerMall(mallWorkflowApp)
})

// Opt in after applying migration 23. No schema changes run on server startup.
if (process.env.WORKFLOW_REMINDERS_ENABLED === 'true' || process.env.SUBSCRIPTION_REMINDERS_ENABLED === 'true') {
 let running = false
 const tick = async () => {
  if (running) return
  running = true
  try {
   await require('./modules/subscriptions/service').runLifecycle(supabase)
   if(process.env.WORKFLOW_REMINDERS_ENABLED==='true') await require('./modules/applicationManagement/reminders').runReadyReminders(supabase)
   else await require('./modules/emailDelivery/service').sendQueued(supabase)
  }
  catch (error) { app.log.error({ code: error.code }, 'Subscription lifecycle or email delivery job failed') }
  finally { running = false }
 }
 const configuredInterval = Number(process.env.SUBSCRIPTION_WORKER_INTERVAL_MS || 15 * 60 * 1000)
 const workerInterval = Number.isSafeInteger(configuredInterval) && configuredInterval >= 60000 ? configuredInterval : 15 * 60 * 1000
 const timer = setInterval(tick, workerInterval)
 timer.unref()
 app.addHook('onReady', async () => { setImmediate(() => { void tick() }) })
 app.addHook('onClose', async () => clearInterval(timer))
}

registerAccountManagementRoutes(app, { supabase, requireAuth, requireSuperAdmin, requirePrimarySuperAdmin })
app.register(async testingApp => {
	testingApp.addHook('preHandler', requireAuth())
	testingApp.addHook('preHandler', requireSuperAdmin)
	registerApplicationTestingRoutes(testingApp)
})

const start = async () => {
	try {
		await app.listen({ port, host })
	} catch (error) {
		app.log.error(error)
		process.exit(1)
	}
}

start()
