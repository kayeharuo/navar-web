require('dotenv').config()

const Fastify = require('fastify')
const cors = require('@fastify/cors')
const { createClient } = require('@supabase/supabase-js')
const registerMallManagementRoutes = require('./modules/mallManagement/routes')

const app = Fastify({ logger: true })

const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '127.0.0.1'
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!process.env.SUPABASE_URL || !supabaseKey) {
	throw new Error('SUPABASE_URL and a Supabase key must be set in .env')
}

const supabase = createClient(
	process.env.SUPABASE_URL,
	supabaseKey
)

app.decorate('supabase', supabase)

app.register(cors, {
	origin: frontendOrigin,
	credentials: true,
	methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
})

app.get('/health', async () => ({
	status: 'ok',
	service: 'navar-backend'
}))

app.get('/api/health', async (request, reply) => {
	const { error } = await app.supabase.from('users').select('id').limit(1)

	if (error && error.code !== 'PGRST205') {
		request.log.error(error, 'Supabase health check failed')
		return reply.code(503).send({
			status: 'error',
			service: 'navar-backend',
			database: 'unavailable'
		})
	}

	return {
		status: 'ok',
		service: 'navar-backend',
		database: 'connected'
	}
})

registerMallManagementRoutes(app)

const start = async () => {
	try {
		await app.listen({ port, host })
	} catch (error) {
		app.log.error(error)
		process.exit(1)
	}
}

start()
