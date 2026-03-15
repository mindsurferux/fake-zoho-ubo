import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getDb, checkDbHealth } from './db/connection.js';
import { formatProject, formatPhase, formatTask, formatGroup } from './services/zoho-formatter.js';
import { getDashboardHTML } from './dashboard-content.js';

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

// Phase names matching seed.js (7 hitos per project)
const PHASE_NAMES = [
    'Levantamiento de Requerimientos', 'Diseno de Solucion', 'Desarrollo Core',
    'Desarrollo Integraciones', 'Testing y QA', 'Puesta en Marcha', 'Cierre y Documentacion'
];

const TASK_TEMPLATES = [
    'Reunion de kickoff', 'Definir alcance del proyecto', 'Recopilar requerimientos funcionales',
    'Recopilar requerimientos no funcionales', 'Analisis de riesgos', 'Diseno de arquitectura',
    'Diseno de base de datos', 'Diseno de interfaces', 'Prototipado UI/UX',
    'Desarrollo modulo principal', 'Desarrollo API REST', 'Integracion con sistemas externos',
    'Configuracion de infraestructura', 'Pruebas unitarias', 'Pruebas de integracion',
    'Pruebas de aceptacion usuario', 'Correccion de bugs', 'Documentacion tecnica',
    'Documentacion de usuario', 'Capacitacion equipo', 'Despliegue en staging',
    'Despliegue en produccion', 'Monitoreo post-despliegue', 'Cierre formal del proyecto'
];

function statusFromHitos(hitos) {
    if (hitos === 0) return 'sin_iniciar';
    if (hitos <= 2) return 'levantamiento';
    if (hitos <= 4) return 'desarrollo';
    if (hitos <= 6) return 'puesta_en_marcha';
    return 'completado';
}

async function requireAdmin(c) {
    const token = c.req.header('x-admin-token');
    if (!token) return null;
    const sql = getDb();
    const rows = await sql`SELECT * FROM admin_sessions WHERE token = ${token} AND action = 'login' ORDER BY created_at DESC LIMIT 1`;
    return rows.length > 0 ? rows[0] : null;
}

async function createPhasesForProject(sql, projectId, hitos, startDate, endDate, projectCode) {
    const projStart = new Date(startDate);
    const projEnd = new Date(endDate);
    const totalDays = (projEnd - projStart) / 86400000;
    const phaseLength = Math.floor(totalDays / 7);
    let counter = Date.now();

    for (let i = 0; i < 7; i++) {
        const isCompleted = i < hitos;
        const phaseStart = new Date(projStart.getTime() + i * phaseLength * 86400000);
        const phaseEnd = new Date(phaseStart.getTime() + phaseLength * 86400000);
        const phaseStartStr = phaseStart.toISOString().split('T')[0];
        const phaseEndStr = phaseEnd.toISOString().split('T')[0];

        await sql`
            INSERT INTO phases (id_string, project_id, name, description, status, start_date, end_date, completed_date, sequence)
            VALUES (${`FZH-${counter++}`}, ${projectId}, ${PHASE_NAMES[i]}, ${`Fase ${i + 1} del proyecto ${projectCode}`},
                    ${isCompleted ? 'completed' : 'notcompleted'}, ${phaseStartStr}, ${phaseEndStr},
                    ${isCompleted ? phaseEndStr : null}, ${i + 1})
        `;
    }
}

async function syncProjectHitos(sql, projectId, hitos) {
    const phases = await sql`SELECT id, sequence FROM phases WHERE project_id = ${projectId} ORDER BY sequence ASC`;
    for (const phase of phases) {
        const isCompleted = phase.sequence <= hitos;
        await sql`UPDATE phases SET status = ${isCompleted ? 'completed' : 'notcompleted'},
                  completed_date = ${isCompleted ? new Date().toISOString().split('T')[0] : null},
                  updated_at = NOW() WHERE id = ${phase.id}`;
    }
}

async function syncProjectTasks(sql, projectId, totalTareas, tareasCompletadas, startDate, endDate) {
    await sql`DELETE FROM tasks WHERE project_id = ${projectId}`;
    const phases = await sql`SELECT id FROM phases WHERE project_id = ${projectId} ORDER BY sequence ASC`;
    const shuffled = [...TASK_TEMPLATES].sort(() => Math.random() - 0.5);
    const priorities = ['None', 'Low', 'Medium', 'High'];
    let counter = Date.now();

    for (let t = 0; t < totalTareas; t++) {
        const isCompleted = t < tareasCompletadas;
        const phaseIdx = Math.min(Math.floor(t / Math.ceil(totalTareas / 7)), 6);
        const phaseId = phases[phaseIdx]?.id || phases[0]?.id;
        const statusType = isCompleted ? 'closed' : 'open';
        const statusName = isCompleted ? 'Closed' : (t < tareasCompletadas + 3 ? 'In Progress' : 'Open');

        await sql`
            INSERT INTO tasks (id_string, project_id, phase_id, name, status_type, status_name, priority, percent_complete, start_date, end_date)
            VALUES (${`FZT-${counter++}`}, ${projectId}, ${phaseId}, ${shuffled[t % shuffled.length]},
                    ${statusType}, ${statusName}, ${priorities[Math.floor(Math.random() * 4)]},
                    ${isCompleted ? '100' : String(Math.floor(Math.random() * 80))}, ${startDate}, ${endDate})
        `;
    }
}

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

// ==================== Admin Auth ====================

// POST /admin/login
app.post('/admin/login', async (c) => {
    try {
        const sql = getDb();
        const body = await c.req.json();
        const { email, password } = body;
        const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
        const ua = c.req.header('user-agent') || 'unknown';

        if (email !== 'uboinsight@ubo.cl' || password !== 'uboinsight#2026') {
            await sql`INSERT INTO admin_sessions (email, action, ip, user_agent) VALUES (${email || 'unknown'}, 'login_failed', ${ip}, ${ua})`;
            return c.json({ error: 'Credenciales invalidas' }, 401);
        }

        const token = `fzadmin-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
        await sql`INSERT INTO admin_sessions (email, token, action, ip, user_agent) VALUES (${email}, ${token}, 'login', ${ip}, ${ua})`;

        return c.json({ token, user: { email, name: 'UBO Insight Admin', role: 'super_admin' } });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// POST /admin/logout
app.post('/admin/logout', async (c) => {
    try {
        const session = await requireAdmin(c);
        if (!session) return c.json({ error: 'No autenticado' }, 401);
        const sql = getDb();
        const ip = c.req.header('x-forwarded-for') || 'unknown';
        const ua = c.req.header('user-agent') || 'unknown';
        await sql`INSERT INTO admin_sessions (email, action, ip, user_agent) VALUES (${session.email}, 'logout', ${ip}, ${ua})`;
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// GET /admin/me — Verify token
app.get('/admin/me', async (c) => {
    const session = await requireAdmin(c);
    if (!session) return c.json({ error: 'No autenticado' }, 401);
    return c.json({ user: { email: session.email, name: 'UBO Insight Admin', role: 'super_admin', logged_in_at: session.created_at } });
});

// GET /admin/sessions — Recent login activity
app.get('/admin/sessions', async (c) => {
    const session = await requireAdmin(c);
    if (!session) return c.json({ error: 'No autenticado' }, 401);
    const sql = getDb();
    const sessions = await sql`SELECT id, email, action, ip, user_agent, created_at FROM admin_sessions ORDER BY created_at DESC LIMIT 30`;
    return c.json({ sessions });
});

// ==================== Admin CRUD (Simulate changes + trigger webhooks) ====================

/*
 * FAKE-ZOHO: Estos endpoints NO existen en Zoho real.
 * Son exclusivos del simulador para poder cambiar datos y disparar webhooks.
 * Prefijo /admin/ para diferenciarlos claramente.
 * En produccion, los cambios ocurren directamente en Zoho Projects UI.
 */

// POST /admin/projects — Create a new project
app.post('/admin/projects', async (c) => {
    try {
        const session = await requireAdmin(c);
        if (!session) return c.json({ error: 'No autenticado' }, 401);

        const sql = getDb();
        const body = await c.req.json();

        if (!body.name || !body.project_code || !body.group_code) {
            return c.json({ error: 'name, project_code, group_code son requeridos' }, 400);
        }

        // Auto-generate id_string
        const maxId = await sql`SELECT id_string FROM projects ORDER BY id DESC LIMIT 1`;
        let nextNum = 2017;
        if (maxId.length > 0) {
            const match = maxId[0].id_string.match(/FZP-(\d+)/);
            if (match) nextNum = parseInt(match[1]) + 1;
        }
        const idString = `FZP-${nextNum}`;

        // Resolve group
        const group = await sql`SELECT id FROM project_groups WHERE code = ${body.group_code}`;
        if (group.length === 0) return c.json({ error: `Grupo ${body.group_code} no encontrado` }, 400);

        const hitos = Math.min(Math.max(parseInt(body.hitos_completados) || 0, 0), 7);
        const customStatus = statusFromHitos(hitos);
        const percent = Math.round((hitos / 7) * 100);
        const totalTareas = parseInt(body.total_tareas) || 10;
        const tareasCompletadas = Math.min(parseInt(body.tareas_completadas) || 0, totalTareas);
        const startDate = body.start_date || new Date().toISOString().split('T')[0];
        const endDate = body.end_date || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];

        const projRows = await sql`
            INSERT INTO projects (id_string, name, description, project_code, status, custom_status, start_date, end_date,
                                  project_percent, owner_name, group_id, area_solicitante, planificado)
            VALUES (${idString}, ${body.name}, ${body.description || ''}, ${body.project_code}, 'active', ${customStatus},
                    ${startDate}, ${endDate}, ${String(percent)}, 'UBO DTI', ${group[0].id},
                    ${body.area_solicitante || ''}, ${body.planificado ? 1 : 0})
            RETURNING id
        `;

        await createPhasesForProject(sql, projRows[0].id, hitos, startDate, endDate, body.project_code);
        await syncProjectTasks(sql, projRows[0].id, totalTareas, tareasCompletadas, startDate, endDate);

        await dispatchWebhooks('project.created', { id_string: idString, name: body.name, custom_status: customStatus });

        return c.json({ success: true, id_string: idString, custom_status: customStatus, project_percent: percent }, 201);
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// PATCH /admin/projects/:id — Update a project (full edit)
app.patch('/admin/projects/:id', async (c) => {
    try {
        const session = await requireAdmin(c);
        if (!session) return c.json({ error: 'No autenticado' }, 401);

        const sql = getDb();
        const idString = c.req.param('id');
        const body = await c.req.json();

        const existing = await sql`SELECT * FROM projects WHERE id_string = ${idString}`;
        if (existing.length === 0) {
            return c.json({ error: { message: 'Project not found', code: 'NOT_FOUND' } }, 404);
        }
        const project = existing[0];

        // Build update fields
        const allowedFields = ['name', 'description', 'project_code', 'area_solicitante', 'start_date', 'end_date', 'status', 'owner_name'];
        let setClauses = [];
        let values = [];
        let idx = 1;

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                setClauses.push(`${field} = $${idx}`);
                values.push(body[field]);
                idx++;
            }
        }

        // Handle planificado (boolean → integer)
        if (body.planificado !== undefined) {
            setClauses.push(`planificado = $${idx}`);
            values.push(body.planificado ? 1 : 0);
            idx++;
        }

        // Handle group_code → group_id
        if (body.group_code) {
            const grp = await sql`SELECT id FROM project_groups WHERE code = ${body.group_code}`;
            if (grp.length > 0) {
                setClauses.push(`group_id = $${idx}`);
                values.push(grp[0].id);
                idx++;
            }
        }

        // Handle hitos_completados → update phases + recompute status/percent
        const hitos = body.hitos_completados !== undefined ? Math.min(Math.max(parseInt(body.hitos_completados), 0), 7) : null;
        if (hitos !== null) {
            const customStatus = statusFromHitos(hitos);
            const percent = Math.round((hitos / 7) * 100);
            setClauses.push(`custom_status = $${idx}`);
            values.push(customStatus);
            idx++;
            setClauses.push(`project_percent = $${idx}`);
            values.push(String(percent));
            idx++;

            await syncProjectHitos(sql, project.id, hitos);
        }

        // Handle tareas
        const totalTareas = body.total_tareas !== undefined ? parseInt(body.total_tareas) : null;
        const tareasCompletadas = body.tareas_completadas !== undefined ? parseInt(body.tareas_completadas) : null;
        if (totalTareas !== null || tareasCompletadas !== null) {
            const tt = totalTareas || parseInt((await sql`SELECT COUNT(*) as c FROM tasks WHERE project_id = ${project.id}`)[0].c);
            const tc = tareasCompletadas !== null ? Math.min(tareasCompletadas, tt) : parseInt((await sql`SELECT COUNT(*) as c FROM tasks WHERE project_id = ${project.id} AND status_type = 'closed'`)[0].c);
            const sd = body.start_date || project.start_date;
            const ed = body.end_date || project.end_date;
            await syncProjectTasks(sql, project.id, tt, tc, sd, ed);
        }

        if (setClauses.length === 0 && hitos === null && totalTareas === null && tareasCompletadas === null) {
            return c.json({ error: 'No hay campos validos para actualizar' }, 400);
        }

        if (setClauses.length > 0) {
            setClauses.push(`updated_at = NOW()`);
            values.push(idString);
            const updateQuery = `UPDATE projects SET ${setClauses.join(', ')} WHERE id_string = $${idx} RETURNING *`;
            await sql(updateQuery, values);
        }

        // Dispatch webhook
        await dispatchWebhooks('project.updated', { id_string: idString, name: body.name || project.name, changes: Object.keys(body) });

        return c.json({ success: true, id_string: idString, webhooks_dispatched: true });
    } catch (err) {
        return c.json({ error: err.message }, 500);
    }
});

// DELETE /admin/projects/:id — Delete a project (cascades phases + tasks)
app.delete('/admin/projects/:id', async (c) => {
    try {
        const session = await requireAdmin(c);
        if (!session) return c.json({ error: 'No autenticado' }, 401);

        const sql = getDb();
        const idString = c.req.param('id');

        const existing = await sql`SELECT id, name FROM projects WHERE id_string = ${idString}`;
        if (existing.length === 0) {
            return c.json({ error: { message: 'Project not found', code: 'NOT_FOUND' } }, 404);
        }

        // CASCADE handles phases + tasks deletion via FK
        await sql`DELETE FROM projects WHERE id_string = ${idString}`;

        await dispatchWebhooks('project.deleted', { id_string: idString, name: existing[0].name });

        return c.json({ success: true, deleted: idString });
    } catch (err) {
        return c.json({ error: err.message }, 500);
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

// ==================== Dashboard (served via Edge function) ====================

app.get('/', (c) => {
    return c.html(getDashboardHTML());
});

export default app;
