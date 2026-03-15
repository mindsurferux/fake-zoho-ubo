import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getDb, checkDbHealth } from './db/connection.js';
import { formatProject, formatPhase, formatTask, formatGroup } from './services/zoho-formatter.js';

const app = new Hono();
const PORTAL_ID = process.env.PORTAL_ID || '8060001';

/*
 * FAKE-ZOHO: Token secreto simulado. En Zoho real, los tokens son generados
 * por el servidor OAuth de Zoho (accounts.zoho.com). Aqui aceptamos cualquier
 * token que empiece con 'fake-' o el token fijo de abajo.
 */
const FAKE_ACCESS_TOKEN = 'fake-access-token-ubo-2026';
const FAKE_REFRESH_TOKEN = 'fake-refresh-token-ubo-2026';
const FAKE_CLIENT_ID = 'fake-client-id';
const FAKE_CLIENT_SECRET = 'fake-client-secret';

// In-memory metrics (reset per cold start on Vercel, persistent locally)
const metrics = {
    totalRequests: 0,
    endpointCalls: {},
    startTime: Date.now(),
    lastRequest: null,
    errors: 0
};

// ==================== Middleware ====================

app.use('*', cors());

// Metrics + Rate limit headers middleware
app.use('*', async (c, next) => {
    metrics.totalRequests++;
    metrics.lastRequest = new Date().toISOString();
    const key = `${c.req.method} ${c.req.path}`;
    metrics.endpointCalls[key] = (metrics.endpointCalls[key] || 0) + 1;
    await next();
    if (c.res.status >= 400) metrics.errors++;

    /*
     * FAKE-ZOHO: Zoho real retorna headers de rate limit:
     * X-RateLimit-Limit: 100 (por ventana de 2 min)
     * X-RateLimit-Remaining: N
     * X-RateLimit-Reset: timestamp
     * Aqui los simulamos para que el consumer los maneje correctamente.
     * En produccion con Zoho real, estos headers vendran del servidor Zoho.
     */
    c.res.headers.set('X-RateLimit-Limit', '100');
    c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, 100 - metrics.totalRequests % 100)));
    c.res.headers.set('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 120));
});

// ==================== OAuth2 Simulation ====================

/*
 * FAKE-ZOHO: En Zoho real, el endpoint OAuth es:
 *   POST https://accounts.zoho.com/oauth/v2/token
 * Con params: grant_type, client_id, client_secret, refresh_token
 * Retorna: access_token (expira 1h), token_type, expires_in
 *
 * Aqui simulamos el mismo flujo. El consumer (Laravel) debe usar
 * exactamente la misma logica que usaria con Zoho real.
 * Al migrar a produccion, solo cambiar ZOHO_OAUTH_URL en .env.
 */
app.post('/oauth/v2/token', async (c) => {
    let body;
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
        body = await c.req.json();
    } else {
        body = Object.fromEntries(new URLSearchParams(await c.req.text()));
    }

    const { grant_type, client_id, client_secret, refresh_token } = body;

    // Validate grant_type
    if (grant_type !== 'refresh_token') {
        return c.json({ error: 'unsupported_grant_type', description: 'Only refresh_token grant is supported' }, 400);
    }

    // FAKE-ZOHO: Lenient validation — accept any non-empty credentials
    if (!client_id || !client_secret || !refresh_token) {
        return c.json({ error: 'invalid_client', description: 'client_id, client_secret, and refresh_token are required' }, 401);
    }

    return c.json({
        access_token: `fake-at-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        token_type: 'Zoho-oauthtoken',
        expires_in: 3600,
        api_domain: 'https://www.zohoapis.com',
        /* FAKE-ZOHO: Zoho real no retorna refresh_token en refresh flow */
    });
});

// ==================== Auth check helper ====================

/*
 * FAKE-ZOHO: En Zoho real, todas las API calls requieren:
 *   Authorization: Zoho-oauthtoken {access_token}
 * Aqui aceptamos tanto 'Zoho-oauthtoken' como 'Bearer' para
 * facilitar desarrollo. En produccion, Laravel debe usar 'Zoho-oauthtoken'.
 */
function checkAuth(c) {
    const authHeader = c.req.header('authorization') || '';
    // Accept: 'Zoho-oauthtoken xxx', 'Bearer xxx', or no auth (dev mode)
    if (!authHeader) return true; // FAKE-ZOHO: Allow no auth in dev
    if (authHeader.startsWith('Zoho-oauthtoken ')) return true;
    if (authHeader.startsWith('Bearer ')) return true;
    return false;
}

// ==================== API Routes (Zoho V3 format) ====================

const apiBase = `/api/v3/portal/${PORTAL_ID}`;

/*
 * FAKE-ZOHO: Zoho V3 pagination uses 'index' (0-based offset) and 'range' (page size, max 100).
 * Default range=100. Response includes pagination metadata.
 * In production, Laravel must handle pagination to fetch all projects if >100.
 */

// GET /projects — List all projects
app.get(`${apiBase}/projects`, async (c) => {
    try {
        const sql = getDb();
        const group = c.req.query('group');
        const status = c.req.query('status');
        const custom_status = c.req.query('custom_status');
        const index = parseInt(c.req.query('index')) || 0;
        const range = Math.min(parseInt(c.req.query('range')) || 100, 100);

        let query = `
            SELECT p.*, g.name as group_name, g.code as group_code, g.id_string as group_id_string,
                   (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status_type = 'open') as tasks_open,
                   (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status_type = 'closed') as tasks_closed,
                   (SELECT COUNT(*) FROM phases WHERE project_id = p.id AND status = 'notcompleted') as milestones_open,
                   (SELECT COUNT(*) FROM phases WHERE project_id = p.id AND status = 'completed') as milestones_closed
            FROM projects p
            LEFT JOIN project_groups g ON p.group_id = g.id
            WHERE 1=1
        `;
        const params = [];

        if (group) {
            query += ` AND g.code = $${params.length + 1}`;
            params.push(group);
        }
        if (status) {
            query += ` AND p.status = $${params.length + 1}`;
            params.push(status);
        }
        if (custom_status) {
            query += ` AND p.custom_status = $${params.length + 1}`;
            params.push(custom_status);
        }

        query += ` ORDER BY p.project_code ASC`;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(range, index);

        const rows = await sql(query, params);

        /* FAKE-ZOHO: Zoho real includes page_token for next page. We use index+range. */
        return c.json({
            projects: rows.map(formatProject),
            page_info: {
                index,
                range,
                has_more: rows.length === range
            }
        });
    } catch (err) {
        return c.json({ error: { message: err.message, code: 'INTERNAL_ERROR' } }, 500);
    }
});

// GET /projects/:id — Project detail
app.get(`${apiBase}/projects/:id`, async (c) => {
    try {
        const sql = getDb();
        const idString = c.req.param('id');

        const rows = await sql`
            SELECT p.*, g.name as group_name, g.code as group_code, g.id_string as group_id_string,
                   (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status_type = 'open') as tasks_open,
                   (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status_type = 'closed') as tasks_closed,
                   (SELECT COUNT(*) FROM phases WHERE project_id = p.id AND status = 'notcompleted') as milestones_open,
                   (SELECT COUNT(*) FROM phases WHERE project_id = p.id AND status = 'completed') as milestones_closed
            FROM projects p
            LEFT JOIN project_groups g ON p.group_id = g.id
            WHERE p.id_string = ${idString}
        `;

        if (rows.length === 0) {
            return c.json({ error: { message: 'Project not found', code: 'NOT_FOUND' } }, 404);
        }

        return c.json({ projects: [formatProject(rows[0])] });
    } catch (err) {
        return c.json({ error: { message: err.message, code: 'INTERNAL_ERROR' } }, 500);
    }
});

// GET /projects/:id/phases — Project milestones/phases
app.get(`${apiBase}/projects/:id/phases`, async (c) => {
    try {
        const sql = getDb();
        const idString = c.req.param('id');

        const project = await sql`SELECT id FROM projects WHERE id_string = ${idString}`;
        if (project.length === 0) {
            return c.json({ error: { message: 'Project not found', code: 'NOT_FOUND' } }, 404);
        }

        const rows = await sql`
            SELECT * FROM phases WHERE project_id = ${project[0].id} ORDER BY sequence ASC
        `;

        return c.json({ phases: rows.map(formatPhase) });
    } catch (err) {
        return c.json({ error: { message: err.message, code: 'INTERNAL_ERROR' } }, 500);
    }
});

// GET /projects/:id/tasks — Project tasks
app.get(`${apiBase}/projects/:id/tasks`, async (c) => {
    try {
        const sql = getDb();
        const idString = c.req.param('id');
        const statusFilter = c.req.query('status');
        const phaseIdFilter = c.req.query('phase_id');

        const project = await sql`SELECT id FROM projects WHERE id_string = ${idString}`;
        if (project.length === 0) {
            return c.json({ error: { message: 'Project not found', code: 'NOT_FOUND' } }, 404);
        }

        let query = `SELECT * FROM tasks WHERE project_id = $1`;
        const params = [project[0].id];

        if (statusFilter) {
            query += ` AND status_type = $${params.length + 1}`;
            params.push(statusFilter);
        }
        if (phaseIdFilter) {
            const phase = await sql`SELECT id FROM phases WHERE id_string = ${phaseIdFilter}`;
            if (phase.length > 0) {
                query += ` AND phase_id = $${params.length + 1}`;
                params.push(phase[0].id);
            }
        }

        query += ` ORDER BY id ASC`;
        const rows = await sql(query, params);

        return c.json({ tasks: rows.map(formatTask) });
    } catch (err) {
        return c.json({ error: { message: err.message, code: 'INTERNAL_ERROR' } }, 500);
    }
});

// GET /projectgroups — Project groups (Vicerrectorias)
app.get(`${apiBase}/projectgroups`, async (c) => {
    try {
        const sql = getDb();
        const rows = await sql`
            SELECT g.*,
                   (SELECT COUNT(*) FROM projects WHERE group_id = g.id) as project_count
            FROM project_groups g
            ORDER BY g.code ASC
        `;

        return c.json({ project_groups: rows.map(formatGroup) });
    } catch (err) {
        return c.json({ error: { message: err.message, code: 'INTERNAL_ERROR' } }, 500);
    }
});

// ==================== Webhook Routes ====================

/*
 * FAKE-ZOHO: Zoho Projects Enterprise supports webhooks.
 * POST /api/v3/portal/{id}/webhooks — Register a webhook URL
 * GET  /api/v3/portal/{id}/webhooks — List registered webhooks
 * DELETE /api/v3/portal/{id}/webhooks/{whId} — Remove webhook
 *
 * In Zoho real, webhook registration is done via the Zoho Projects UI or API.
 * The payload format follows Zoho's webhook notification standard.
 * When migrating to production, register webhook URL in Zoho Projects settings
 * instead of via this API.
 */

// POST /webhooks — Register a webhook
app.post(`${apiBase}/webhooks`, async (c) => {
    try {
        const sql = getDb();
        const body = await c.req.json();
        const { url, events, secret } = body;

        if (!url) {
            return c.json({ error: { message: 'url is required', code: 'INVALID_REQUEST' } }, 400);
        }

        const evts = events || ['project.updated', 'project.created', 'project.deleted'];
        const rows = await sql`
            INSERT INTO webhooks (url, events, secret, is_active)
            VALUES (${url}, ${evts}, ${secret || null}, true)
            RETURNING *
        `;

        return c.json({ webhook: rows[0] }, 201);
    } catch (err) {
        return c.json({ error: { message: err.message, code: 'INTERNAL_ERROR' } }, 500);
    }
});

// GET /webhooks — List webhooks
app.get(`${apiBase}/webhooks`, async (c) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT * FROM webhooks WHERE is_active = true ORDER BY created_at DESC`;
        return c.json({ webhooks: rows });
    } catch (err) {
        return c.json({ error: { message: err.message, code: 'INTERNAL_ERROR' } }, 500);
    }
});

// DELETE /webhooks/:id — Remove webhook
app.delete(`${apiBase}/webhooks/:whId`, async (c) => {
    try {
        const sql = getDb();
        const whId = parseInt(c.req.param('whId'));
        await sql`UPDATE webhooks SET is_active = false WHERE id = ${whId}`;
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: { message: err.message, code: 'INTERNAL_ERROR' } }, 500);
    }
});

// ==================== Admin API (Simulate changes + trigger webhooks) ====================

/*
 * FAKE-ZOHO: Estos endpoints NO existen en Zoho real.
 * Son exclusivos del simulador para poder cambiar datos y disparar webhooks.
 * Prefijo /admin/ para diferenciarlos claramente.
 * En produccion, los cambios ocurren directamente en Zoho Projects UI.
 */

// PATCH /admin/projects/:id — Update a project (simulate change)
app.patch('/admin/projects/:id', async (c) => {
    try {
        const sql = getDb();
        const idString = c.req.param('id');
        const body = await c.req.json();

        // Check project exists
        const existing = await sql`SELECT * FROM projects WHERE id_string = ${idString}`;
        if (existing.length === 0) {
            return c.json({ error: { message: 'Project not found', code: 'NOT_FOUND' } }, 404);
        }

        // Allowed fields to update
        const allowedFields = ['name', 'custom_status', 'project_percent', 'status', 'start_date', 'end_date'];
        const updates = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) updates[field] = body[field];
        }

        if (Object.keys(updates).length === 0) {
            return c.json({ error: { message: 'No valid fields to update', code: 'INVALID_REQUEST' } }, 400);
        }

        // Build dynamic update
        let setClauses = [];
        let values = [];
        let idx = 1;
        for (const [key, val] of Object.entries(updates)) {
            setClauses.push(`${key} = $${idx}`);
            values.push(val);
            idx++;
        }
        setClauses.push(`updated_at = NOW()`);
        values.push(idString);

        const updateQuery = `UPDATE projects SET ${setClauses.join(', ')} WHERE id_string = $${idx} RETURNING *`;
        const updated = await sql(updateQuery, values);

        // Dispatch webhooks
        await dispatchWebhooks('project.updated', {
            id_string: idString,
            name: updated[0].name,
            status: updated[0].status,
            custom_status: updated[0].custom_status,
            project_percent: updated[0].project_percent,
            changes: updates
        });

        return c.json({ success: true, project: updated[0], webhooks_dispatched: true });
    } catch (err) {
        return c.json({ error: { message: err.message, code: 'INTERNAL_ERROR' } }, 500);
    }
});

// POST /admin/webhooks/test — Test webhook delivery
app.post('/admin/webhooks/test', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const eventType = body.event_type || 'project.updated';
        const projectId = body.project_id || 'FZP-2001';

        const sql = getDb();
        const project = await sql`SELECT * FROM projects WHERE id_string = ${projectId}`;
        if (project.length === 0) {
            return c.json({ error: { message: 'Project not found', code: 'NOT_FOUND' } }, 404);
        }

        const result = await dispatchWebhooks(eventType, {
            id_string: project[0].id_string,
            name: project[0].name,
            status: project[0].status,
            custom_status: project[0].custom_status,
            project_percent: project[0].project_percent
        });

        return c.json({ success: true, dispatched_to: result.dispatched, errors: result.errors });
    } catch (err) {
        return c.json({ error: { message: err.message, code: 'INTERNAL_ERROR' } }, 500);
    }
});

// GET /admin/info — Fake Zoho system info
app.get('/admin/info', (c) => {
    return c.json({
        name: 'Fake Zoho Projects API v2',
        description: 'Simulador de Zoho Projects V3 para desarrollo DTIUBOCL',
        portal_id: PORTAL_ID,
        version: '2.0.0',
        stack: 'Hono + Neon Postgres + Vercel',
        note: 'FAKE-ZOHO: Este servicio simula la API de Zoho Projects. No es la API real.',
        endpoints: {
            oauth: 'POST /oauth/v2/token',
            projects: `GET ${apiBase}/projects`,
            project_detail: `GET ${apiBase}/projects/{id}`,
            phases: `GET ${apiBase}/projects/{id}/phases`,
            tasks: `GET ${apiBase}/projects/{id}/tasks`,
            groups: `GET ${apiBase}/projectgroups`,
            webhooks: `POST/GET ${apiBase}/webhooks`,
            admin_update: 'PATCH /admin/projects/{id}',
            admin_webhook_test: 'POST /admin/webhooks/test',
            health: 'GET /health'
        }
    });
});

// ==================== Webhook Dispatcher ====================

/*
 * FAKE-ZOHO: En Zoho real, el webhook se envia automaticamente cuando
 * hay un cambio en un proyecto. El payload sigue este formato:
 * { event_type, project: {...}, timestamp }
 *
 * En produccion, este dispatcher NO se usa. Zoho envia directamente.
 * El ZohoWebhookController en Laravel debe aceptar el mismo formato.
 */
async function dispatchWebhooks(eventType, projectData) {
    const sql = getDb();
    const webhooks = await sql`SELECT * FROM webhooks WHERE is_active = true`;
    const results = { dispatched: 0, errors: [] };

    const payload = {
        event_type: eventType,
        project: projectData,
        timestamp: new Date().toISOString(),
        portal_id: PORTAL_ID,
        /* FAKE-ZOHO: Zoho real includes a signature header for verification */
        source: 'fake-zoho-v2'
    };

    for (const wh of webhooks) {
        if (!wh.events || wh.events.includes(eventType)) {
            try {
                const res = await fetch(wh.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Zoho-Webhook-Source': 'fake-zoho-v2',
                        /* FAKE-ZOHO: Zoho real sends X-Zoho-Webhook-Signature for HMAC verification */
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(5000)
                });
                if (res.ok) results.dispatched++;
                else results.errors.push({ url: wh.url, status: res.status });
            } catch (err) {
                results.errors.push({ url: wh.url, error: err.message });
            }
        }
    }

    return results;
}

// ==================== Health Routes ====================

// GET /health — Overall health
app.get('/health', async (c) => {
    const dbHealth = await checkDbHealth();
    const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
    const endpoints = await checkEndpoints();
    const allHealthy = dbHealth.connected && endpoints.every(e => e.healthy);

    return c.json({
        status: allHealthy ? 'healthy' : 'degraded',
        uptime_seconds: uptime,
        uptime_human: formatUptime(uptime),
        database: dbHealth,
        endpoints,
        metrics: {
            total_requests: metrics.totalRequests,
            total_errors: metrics.errors,
            error_rate: metrics.totalRequests > 0
                ? ((metrics.errors / metrics.totalRequests) * 100).toFixed(2) + '%'
                : '0%',
            last_request: metrics.lastRequest,
            endpoint_calls: metrics.endpointCalls
        }
    });
});

// GET /health/db — Database health
app.get('/health/db', async (c) => {
    const dbHealth = await checkDbHealth();

    if (dbHealth.connected) {
        const sql = getDb();
        const counts = await sql`
            SELECT
                (SELECT COUNT(*) FROM project_groups) as groups,
                (SELECT COUNT(*) FROM projects) as projects,
                (SELECT COUNT(*) FROM phases) as phases,
                (SELECT COUNT(*) FROM tasks) as tasks
        `;

        return c.json({
            status: 'connected',
            ...dbHealth,
            tables: {
                groups: parseInt(counts[0].groups),
                projects: parseInt(counts[0].projects),
                phases: parseInt(counts[0].phases),
                tasks: parseInt(counts[0].tasks)
            }
        });
    }

    return c.json({ status: 'disconnected', ...dbHealth }, 503);
});

// GET /health/endpoints — Endpoint health check
app.get('/health/endpoints', async (c) => {
    const endpoints = await checkEndpoints();
    const allHealthy = endpoints.every(e => e.healthy);

    return c.json({
        status: allHealthy ? 'all_healthy' : 'some_unhealthy',
        checked_at: new Date().toISOString(),
        endpoints
    });
});

// GET /health/metrics — Request metrics
app.get('/health/metrics', (c) => {
    const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);

    return c.json({
        uptime_seconds: uptime,
        uptime_human: formatUptime(uptime),
        total_requests: metrics.totalRequests,
        total_errors: metrics.errors,
        error_rate: metrics.totalRequests > 0
            ? ((metrics.errors / metrics.totalRequests) * 100).toFixed(2) + '%'
            : '0%',
        requests_per_minute: uptime > 0
            ? ((metrics.totalRequests / uptime) * 60).toFixed(2)
            : '0',
        last_request: metrics.lastRequest,
        endpoint_calls: metrics.endpointCalls
    });
});

// ==================== Helpers ====================

/*
 * FAKE-ZOHO TRANSITION NOTES:
 * When switching from fake-zoho-v2 to real Zoho Projects API:
 *
 * 1. AUTH: Change ZOHO_OAUTH_URL from fake-zoho URL to https://accounts.zoho.com/oauth/v2/token
 *    - Header changes from flexible to strict: 'Zoho-oauthtoken {token}'
 *
 * 2. IDS: Real Zoho uses numeric strings like '170876000006477013'
 *    - Our fake uses 'FZP-2001' format
 *    - ZohoSyncService must map id_string → zoho_project_id in dash_zoho_projects
 *
 * 3. PAGINATION: Real Zoho uses 'index' (offset) + 'range' (limit, max 100)
 *    - Same params as we simulate here
 *
 * 4. RATE LIMITS: Real Zoho enforces 100 requests / 2 minutes with 30min block
 *    - Our headers simulate this but don't enforce
 *    - ZohoSyncService should respect X-RateLimit-Remaining header
 *
 * 5. CUSTOM FIELDS: project_code and area_solicitante
 *    - If Zoho Enterprise: these are custom fields in the project object
 *    - If not: store as local metadata in dash_project_metadata table
 *
 * 6. WEBHOOKS: Register webhook URL in Zoho Projects settings panel
 *    - Zoho sends X-Zoho-Webhook-Signature header for HMAC verification
 *    - ZohoWebhookController should verify signature in production
 */

async function checkEndpoints() {
    const base = `/api/v3/portal/${PORTAL_ID}`;
    const checks = [
        { path: `${base}/projects`, name: 'List Projects' },
        { path: `${base}/projectgroups`, name: 'List Groups' },
        { path: `/health/db`, name: 'Database Health' }
    ];

    const results = [];
    for (const check of checks) {
        try {
            const sql = getDb();
            if (check.path.includes('/projects') && !check.path.includes('groups')) {
                await sql`SELECT COUNT(*) as c FROM projects`;
            } else if (check.path.includes('/projectgroups')) {
                await sql`SELECT COUNT(*) as c FROM project_groups`;
            } else {
                await sql`SELECT 1`;
            }
            results.push({ ...check, healthy: true, status: 200 });
        } catch (err) {
            results.push({ ...check, healthy: false, status: 503, error: err.message });
        }
    }
    return results;
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

export default app;
