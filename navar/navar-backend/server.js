require('dotenv').config()

const Fastify = require('fastify')
const cors = require('@fastify/cors')
const helmet = require('@fastify/helmet')
const rateLimit = require('@fastify/rate-limit')
const { createClient } = require('@supabase/supabase-js')
const registerMallManagementRoutes = require('./modules/mallManagement/routes')
const createAuthGuards = require('./modules/auth/authGuard')
const registerAccountManagementRoutes = require('./modules/accountManagement/routes')
const registerApplicationTestingRoutes = require('./modules/applicationTesting/routes')
const registerApplicationManagementRoutes = require('./modules/applicationManagement/routes')
const registerNodeMapRoutes = require('./modules/nodeMap/routes')

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
	return reply.code(statusCode).send({ message: 'Something went wrong.' })
})

const startedAt = new Date().toISOString()
app.get('/health', async () => ({
	status: 'ok',
	service: 'navar-backend',
	pid: process.pid,
	startedAt
}))

const { requireAuth, requireSuperAdmin, requirePrimarySuperAdmin } = createAuthGuards(supabase)

app.register(async protectedApp => {
	protectedApp.addHook('preHandler', requireAuth())
	protectedApp.addHook('preHandler', requireSuperAdmin)
	registerMallManagementRoutes(protectedApp)
	registerApplicationManagementRoutes(protectedApp)
	registerNodeMapRoutes(protectedApp)
})

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
