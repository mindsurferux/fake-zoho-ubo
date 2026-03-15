// Dashboard static content served via Edge function
// Kept separate from app.js for cleanliness

export const DASHBOARD_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
    --bg: #f8f9fa; --surface: #ffffff; --border: #e5e7eb; --text: #1f2937;
    --text-muted: #6b7280; --primary: #374151; --accent: #4b5563;
    --green: #059669; --green-bg: #d1fae5; --red: #dc2626; --red-bg: #fee2e2;
    --yellow: #d97706; --yellow-bg: #fef3c7; --blue: #2563eb; --blue-bg: #dbeafe;
    --purple: #7c3aed; --purple-bg: #ede9fe; --radius: 0.75rem;
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; min-height: 100vh; display: flex; flex-direction: column; }
.app-header { background: var(--primary); color: #fff; padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.header-left { display: flex; align-items: center; gap: 1rem; }
.header-icon { font-size: 1.75rem; opacity: 0.9; }
.app-header h1 { font-size: 1.25rem; font-weight: 600; }
.header-subtitle { font-size: 0.8rem; opacity: 0.7; }
.header-right { display: flex; align-items: center; gap: 1.5rem; }
.portal-id { font-size: 0.8rem; opacity: 0.7; }
.portal-id code { background: rgba(255,255,255,0.15); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
.version-tag { display: inline-block; background: rgba(255,255,255,0.2); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 500; vertical-align: middle; margin-left: 0.25rem; }
.status-badge { padding: 0.35rem 0.75rem; border-radius: 2rem; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; }
.status-loading { background: rgba(255,255,255,0.2); color: #fff; }
.status-healthy { background: var(--green-bg); color: var(--green); }
.status-degraded { background: var(--red-bg); color: var(--red); }
.dashboard { flex: 1; padding: 1.5rem 2rem; display: flex; flex-direction: column; gap: 1.5rem; max-width: 1400px; width: 100%; margin: 0 auto; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem 1.5rem; }
.panel h2 { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
.panel h2 i { color: var(--text-muted); font-size: 0.9rem; }
.health-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.health-card { border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; text-align: center; transition: border-color 0.2s, background 0.2s; }
.health-card.healthy { border-color: var(--green); background: var(--green-bg); }
.health-card.unhealthy { border-color: var(--red); background: var(--red-bg); }
.health-icon { font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--text-muted); }
.health-card.healthy .health-icon { color: var(--green); }
.health-card.unhealthy .health-icon { color: var(--red); }
.health-label { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; }
.health-status { font-size: 0.85rem; font-weight: 600; }
.metrics-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; }
.metric-card { text-align: center; padding: 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem; }
.metric-value { font-size: 1.75rem; font-weight: 700; color: var(--primary); }
.metric-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.groups-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.group-card { border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; display: flex; align-items: center; gap: 0.75rem; }
.group-color { width: 4px; height: 48px; border-radius: 4px; flex-shrink: 0; }
.group-info { flex: 1; } .group-name { font-weight: 600; font-size: 0.9rem; }
.group-code { font-size: 0.75rem; color: var(--text-muted); }
.group-count { font-size: 0.8rem; color: var(--accent); }
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.panel-header h2 { margin-bottom: 0; } .filters { display: flex; gap: 0.5rem; }
.filter-select { padding: 0.4rem 0.75rem; border: 1px solid var(--border); border-radius: 0.375rem; font-size: 0.8rem; color: var(--text); background: var(--surface); cursor: pointer; }
.table-wrapper { overflow-x: auto; }
.projects-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.projects-table th { background: var(--bg); padding: 0.6rem 0.75rem; text-align: left; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-muted); border-bottom: 2px solid var(--border); }
.projects-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
.projects-table tr:hover td { background: #f9fafb; }
.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 1rem; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }
.badge-sin_iniciar { background: #f3f4f6; color: #6b7280; }
.badge-levantamiento { background: var(--blue-bg); color: var(--blue); }
.badge-desarrollo { background: var(--purple-bg); color: var(--purple); }
.badge-puesta_en_marcha { background: var(--yellow-bg); color: var(--yellow); }
.badge-completado { background: var(--green-bg); color: var(--green); }
.badge-vr { background: #f3f4f6; color: var(--accent); font-size: 0.65rem; }
.hitos-dots { display: flex; gap: 3px; align-items: center; }
.hito-dot { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--border); background: transparent; }
.hito-dot.completed { background: var(--green); border-color: var(--green); }
.progress-bar-container { width: 80px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; display: inline-block; vertical-align: middle; }
.progress-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
.progress-text { font-size: 0.75rem; color: var(--text-muted); margin-left: 0.35rem; }
.task-count { font-size: 0.8rem; } .task-count .done { color: var(--green); font-weight: 600; } .task-count .total { color: var(--text-muted); }
.date-range { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; }
.endpoints-list { display: flex; flex-direction: column; gap: 0.5rem; }
.endpoint-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 0.375rem; font-family: 'Courier New', monospace; font-size: 0.8rem; }
.endpoint-method { display: inline-block; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; background: var(--green-bg); color: var(--green); min-width: 36px; text-align: center; }
.endpoint-method.post { background: var(--blue-bg); color: var(--blue); }
.endpoint-method.patch { background: var(--yellow-bg); color: var(--yellow); }
.endpoint-path { flex: 1; color: var(--text); }
.endpoint-desc { font-family: -apple-system, sans-serif; color: var(--text-muted); font-size: 0.75rem; }
.app-footer { background: var(--surface); border-top: 1px solid var(--border); padding: 0.75rem 2rem; display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); }
@media (max-width: 900px) { .health-grid { grid-template-columns: repeat(2, 1fr); } .metrics-grid { grid-template-columns: repeat(3, 1fr); } .groups-grid { grid-template-columns: repeat(2, 1fr); } }`;

export const DASHBOARD_JS = `const BASE = window.location.origin;
let PORTAL_ID = '8060001';
async function fetchJSON(url) { const res = await fetch(url); if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); }
async function loadHealth() {
    try {
        const data = await fetchJSON(BASE + '/health');
        document.getElementById('portal-id').textContent = PORTAL_ID;
        const indicator = document.getElementById('status-indicator');
        if (data.status === 'healthy') { indicator.className = 'status-badge status-healthy'; indicator.innerHTML = '<i class="fas fa-check-circle"></i> Operativo'; }
        else { indicator.className = 'status-badge status-degraded'; indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Degradado'; }
        const dbCard = document.getElementById('health-db'), dbStatus = document.getElementById('health-db-status');
        if (data.database?.connected) { dbCard.className = 'health-card healthy'; dbStatus.textContent = data.database.projectCount + ' proyectos'; }
        else { dbCard.className = 'health-card unhealthy'; dbStatus.textContent = 'Desconectada'; }
        const endpoints = data.endpoints || [];
        const apiEp = endpoints.find(e => e.name === 'List Projects'), grpEp = endpoints.find(e => e.name === 'List Groups');
        const apiCard = document.getElementById('health-api'), apiStatus = document.getElementById('health-api-status');
        if (apiEp?.healthy) { apiCard.className = 'health-card healthy'; apiStatus.textContent = 'OK (200)'; }
        else { apiCard.className = 'health-card unhealthy'; apiStatus.textContent = 'Error'; }
        const grpCard = document.getElementById('health-groups'), grpStatus = document.getElementById('health-groups-status');
        if (grpEp?.healthy) { grpCard.className = 'health-card healthy'; grpStatus.textContent = 'OK (200)'; }
        else { grpCard.className = 'health-card unhealthy'; grpStatus.textContent = 'Error'; }
        const uptimeCard = document.getElementById('health-uptime');
        uptimeCard.className = 'health-card healthy';
        document.getElementById('health-uptime-status').textContent = data.uptime_human || '—';
        document.getElementById('metric-requests').textContent = data.metrics?.total_requests || 0;
        document.getElementById('metric-errors').textContent = data.metrics?.total_errors || 0;
    } catch (err) {
        console.error('Health check failed:', err);
        const indicator = document.getElementById('status-indicator');
        indicator.className = 'status-badge status-degraded';
        indicator.innerHTML = '<i class="fas fa-times-circle"></i> Sin conexion';
    }
}
async function loadDbMetrics() {
    try {
        const data = await fetchJSON(BASE + '/health/db');
        if (data.tables) {
            document.getElementById('metric-projects').textContent = data.tables.projects;
            document.getElementById('metric-tasks').textContent = data.tables.tasks;
            document.getElementById('metric-phases').textContent = data.tables.phases;
            document.getElementById('metric-groups').textContent = data.tables.groups;
        }
    } catch (err) { console.error('DB metrics failed:', err); }
}
async function loadGroups() {
    try {
        const data = await fetchJSON(BASE + '/api/v3/portal/' + PORTAL_ID + '/projectgroups');
        const grid = document.getElementById('groups-grid'), select = document.getElementById('filter-group');
        grid.innerHTML = ''; select.innerHTML = '<option value="">Todas las VR</option>';
        (data.project_groups || []).forEach(g => {
            grid.innerHTML += '<div class="group-card"><div class="group-color" style="background:' + g.color + '"></div><div class="group-info"><div class="group-name">' + g.name + '</div><div class="group-code">' + g.code + '</div></div><div class="group-count">' + g.project_count + ' proy.</div></div>';
            select.innerHTML += '<option value="' + g.code + '">' + g.code + ' - ' + g.name + '</option>';
        });
    } catch (err) { console.error('Groups load failed:', err); }
}
async function loadProjects() {
    try {
        const groupFilter = document.getElementById('filter-group').value;
        const statusFilter = document.getElementById('filter-status').value;
        let url = BASE + '/api/v3/portal/' + PORTAL_ID + '/projects?';
        if (groupFilter) url += 'group=' + groupFilter + '&';
        if (statusFilter) url += 'custom_status=' + statusFilter + '&';
        const data = await fetchJSON(url);
        const tbody = document.getElementById('projects-tbody');
        tbody.innerHTML = '';
        (data.projects || []).forEach(p => {
            const totalTasks = (p.task_count?.open || 0) + (p.task_count?.closed || 0);
            const closedTasks = p.task_count?.closed || 0;
            const closedMilestones = p.milestone_count?.closed || 0;
            const percent = parseInt(p.project_percent) || 0;
            let hitosDots = '';
            for (let i = 0; i < 7; i++) hitosDots += '<span class="hito-dot ' + (i < closedMilestones ? 'completed' : '') + '"></span>';
            const progressColor = percent >= 80 ? 'var(--green)' : percent >= 40 ? 'var(--yellow)' : 'var(--red)';
            const statusLabels = { sin_iniciar: 'Sin iniciar', levantamiento: 'Levantamiento', desarrollo: 'Desarrollo', puesta_en_marcha: 'Puesta en Marcha', completado: 'Completado' };
            const statusLabel = statusLabels[p.custom_status] || p.custom_status;
            tbody.innerHTML += '<tr><td><strong>' + (p.project_code || '—') + '</strong></td><td><div>' + p.name + '</div><div style="font-size:0.7rem;color:var(--text-muted)">' + (p.area_solicitante || '') + '</div></td><td><span class="badge badge-vr">' + (p.group?.code || '—') + '</span></td><td><span class="badge badge-' + p.custom_status + '">' + statusLabel + '</span></td><td><div class="hitos-dots">' + hitosDots + '</div><span style="font-size:0.7rem;color:var(--text-muted)">' + closedMilestones + '/7</span></td><td><span class="task-count"><span class="done">' + closedTasks + '</span>/<span class="total">' + totalTasks + '</span></span></td><td><div style="display:flex;align-items:center;gap:0.3rem"><div class="progress-bar-container"><div class="progress-bar-fill" style="width:' + percent + '%;background:' + progressColor + '"></div></div><span class="progress-text">' + percent + '%</span></div></td><td><div class="date-range">' + (p.start_date || '—') + ' / ' + (p.end_date || '—') + '</div></td></tr>';
        });
    } catch (err) { console.error('Projects load failed:', err); }
}
function renderEndpoints() {
    const list = document.getElementById('endpoints-list');
    const endpoints = [
        { method: 'GET', path: '/api/v3/portal/' + PORTAL_ID + '/projects', desc: 'Listar proyectos' },
        { method: 'GET', path: '/api/v3/portal/' + PORTAL_ID + '/projects/{id}', desc: 'Detalle proyecto' },
        { method: 'GET', path: '/api/v3/portal/' + PORTAL_ID + '/projects/{id}/phases', desc: 'Hitos' },
        { method: 'GET', path: '/api/v3/portal/' + PORTAL_ID + '/projects/{id}/tasks', desc: 'Tareas' },
        { method: 'GET', path: '/api/v3/portal/' + PORTAL_ID + '/projectgroups', desc: 'Grupos (VRs)' },
        { method: 'POST', path: '/oauth/v2/token', desc: 'OAuth2 token' },
        { method: 'POST', path: '/api/v3/portal/' + PORTAL_ID + '/webhooks', desc: 'Registrar webhook' },
        { method: 'PATCH', path: '/admin/projects/{id}', desc: 'Admin: editar proyecto' },
        { method: 'GET', path: '/health', desc: 'Estado del sistema' },
    ];
    list.innerHTML = endpoints.map(e => '<div class="endpoint-item"><span class="endpoint-method ' + e.method.toLowerCase() + '">' + e.method + '</span><span class="endpoint-path">' + e.path + '</span><span class="endpoint-desc">' + e.desc + '</span></div>').join('');
}
async function init() { renderEndpoints(); await Promise.all([loadHealth(), loadDbMetrics(), loadGroups()]); await loadProjects(); document.getElementById('last-refresh').textContent = 'Ultima actualizacion: ' + new Date().toLocaleTimeString('es-CL'); }
document.getElementById('filter-group').addEventListener('change', loadProjects);
document.getElementById('filter-status').addEventListener('change', loadProjects);
setInterval(async () => { await loadHealth(); document.getElementById('last-refresh').textContent = 'Ultima actualizacion: ' + new Date().toLocaleTimeString('es-CL'); }, 30000);
init();`;

export function getDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fake Zoho Projects v2 - Dashboard</title>
    <style>${DASHBOARD_CSS}</style>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>
<body>
    <header class="app-header">
        <div class="header-left">
            <i class="fas fa-project-diagram header-icon"></i>
            <div>
                <h1>Fake Zoho Projects <span class="version-tag">v2</span></h1>
                <span class="header-subtitle">API Mock para UBO Insight — Hono + Neon Postgres + Vercel</span>
            </div>
        </div>
        <div class="header-right">
            <div id="status-indicator" class="status-badge status-loading">
                <i class="fas fa-circle-notch fa-spin"></i> Verificando...
            </div>
            <span class="portal-id">Portal: <code id="portal-id">—</code></span>
        </div>
    </header>
    <main class="dashboard">
        <section class="panel health-panel">
            <h2><i class="fas fa-heartbeat"></i> Estado del Sistema</h2>
            <div class="health-grid" id="health-grid">
                <div class="health-card" id="health-db"><div class="health-icon"><i class="fas fa-database"></i></div><div class="health-label">Base de Datos</div><div class="health-status" id="health-db-status">—</div></div>
                <div class="health-card" id="health-api"><div class="health-icon"><i class="fas fa-plug"></i></div><div class="health-label">API Projects</div><div class="health-status" id="health-api-status">—</div></div>
                <div class="health-card" id="health-groups"><div class="health-icon"><i class="fas fa-layer-group"></i></div><div class="health-label">API Groups</div><div class="health-status" id="health-groups-status">—</div></div>
                <div class="health-card" id="health-uptime"><div class="health-icon"><i class="fas fa-clock"></i></div><div class="health-label">Uptime</div><div class="health-status" id="health-uptime-status">—</div></div>
            </div>
        </section>
        <section class="panel metrics-panel">
            <h2><i class="fas fa-chart-bar"></i> Metricas</h2>
            <div class="metrics-grid">
                <div class="metric-card"><div class="metric-value" id="metric-projects">0</div><div class="metric-label">Proyectos</div></div>
                <div class="metric-card"><div class="metric-value" id="metric-tasks">0</div><div class="metric-label">Tareas totales</div></div>
                <div class="metric-card"><div class="metric-value" id="metric-phases">0</div><div class="metric-label">Hitos totales</div></div>
                <div class="metric-card"><div class="metric-value" id="metric-groups">0</div><div class="metric-label">Grupos (VR)</div></div>
                <div class="metric-card"><div class="metric-value" id="metric-requests">0</div><div class="metric-label">Requests</div></div>
                <div class="metric-card"><div class="metric-value" id="metric-errors">0</div><div class="metric-label">Errores</div></div>
            </div>
        </section>
        <section class="panel groups-panel">
            <h2><i class="fas fa-layer-group"></i> Vicerrectorias (Project Groups)</h2>
            <div class="groups-grid" id="groups-grid"></div>
        </section>
        <section class="panel projects-panel">
            <div class="panel-header">
                <h2><i class="fas fa-list"></i> Proyectos</h2>
                <div class="filters">
                    <select id="filter-group" class="filter-select"><option value="">Todas las VR</option></select>
                    <select id="filter-status" class="filter-select"><option value="">Todos los estados</option><option value="sin_iniciar">Sin iniciar</option><option value="levantamiento">Levantamiento</option><option value="desarrollo">Desarrollo</option><option value="puesta_en_marcha">Puesta en Marcha</option><option value="completado">Completado</option></select>
                </div>
            </div>
            <div class="table-wrapper">
                <table class="projects-table">
                    <thead><tr><th>Codigo</th><th>Proyecto</th><th>VR</th><th>Estado</th><th>Hitos</th><th>Tareas</th><th>Avance</th><th>Fechas</th></tr></thead>
                    <tbody id="projects-tbody"></tbody>
                </table>
            </div>
        </section>
        <section class="panel endpoints-panel">
            <h2><i class="fas fa-code"></i> Endpoints API</h2>
            <div class="endpoints-list" id="endpoints-list"></div>
        </section>
    </main>
    <footer class="app-footer">
        <span>Fake Zoho Projects API v2 — Hono + Neon Postgres + Vercel — UBO DTI</span>
        <span id="last-refresh">Ultima actualizacion: —</span>
    </footer>
    <script>${DASHBOARD_JS}</script>
</body>
</html>`;
}
