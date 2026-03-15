const BASE = window.location.origin;
const PORTAL_ID = '8060001';
let _projectsCache = [];
let _deleteTarget = null;

const STATUS_LABELS = {
    'sin_iniciar': 'Sin iniciar', 'levantamiento': 'Levantamiento',
    'desarrollo': 'Desarrollo', 'puesta_en_marcha': 'Puesta en Marcha', 'completado': 'Completado'
};

function statusFromHitos(h) {
    if (h === 0) return 'sin_iniciar';
    if (h <= 2) return 'levantamiento';
    if (h <= 4) return 'desarrollo';
    if (h <= 6) return 'puesta_en_marcha';
    return 'completado';
}

// ==================== Toast ====================
function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = `toast ${type}`; t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3000);
}

// ==================== Auth ====================
function getToken() { return sessionStorage.getItem('fz_token'); }
function setToken(t) { sessionStorage.setItem('fz_token', t); }
function clearToken() { sessionStorage.removeItem('fz_token'); }
function isLoggedIn() { return !!getToken(); }

function adminHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) h['X-Admin-Token'] = t;
    return h;
}

function updateAuthUI() {
    const li = isLoggedIn();
    document.getElementById('btn-login').style.display = li ? 'none' : '';
    document.getElementById('user-info').style.display = li ? 'flex' : 'none';
    document.getElementById('btn-add-project').style.display = li ? '' : 'none';
    document.getElementById('th-actions').style.display = li ? '' : 'none';
    document.getElementById('sessions-panel').style.display = li ? '' : 'none';
    if (li) {
        document.getElementById('user-email').textContent = 'uboinsight@ubo.cl';
        loadSessions();
    }
}

function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('login-email').focus();
    document.getElementById('login-error').style.display = 'none';
}
function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('login-form').reset();
}

async function doLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    try {
        const res = await fetch(`${BASE}/admin/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || 'Error'; errEl.style.display = 'block'; return; }
        setToken(data.token);
        closeLoginModal();
        updateAuthUI();
        loadProjects();
        showToast('Sesion iniciada', 'success');
    } catch { errEl.textContent = 'Error de conexion'; errEl.style.display = 'block'; }
}

async function doLogout() {
    try { await fetch(`${BASE}/admin/logout`, { method: 'POST', headers: adminHeaders() }); } catch {}
    clearToken();
    updateAuthUI();
    loadProjects();
    showToast('Sesion cerrada', 'info');
}

async function loadSessions() {
    try {
        const res = await fetch(`${BASE}/admin/sessions`, { headers: adminHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const list = document.getElementById('sessions-list');
        list.innerHTML = (data.sessions || []).map(s => {
            const d = new Date(s.created_at);
            const time = d.toLocaleString('es-CL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
            return `<div class="session-row">
                <span class="session-action ${s.action}">${s.action}</span>
                <span class="session-email">${s.email}</span>
                <span class="session-ip">${s.ip || ''}</span>
                <span class="session-time">${time}</span>
            </div>`;
        }).join('');
    } catch {}
}

// ==================== Fetch ====================
async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ==================== Health ====================
async function loadHealth() {
    try {
        const data = await fetchJSON(`${BASE}/health`);
        document.getElementById('portal-id').textContent = PORTAL_ID;
        const indicator = document.getElementById('status-indicator');
        if (data.status === 'healthy') {
            indicator.className = 'status-badge status-healthy';
            indicator.innerHTML = '<i class="fas fa-check-circle"></i> Operativo';
        } else {
            indicator.className = 'status-badge status-degraded';
            indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Degradado';
        }
        const dbCard = document.getElementById('health-db');
        const dbStatus = document.getElementById('health-db-status');
        if (data.database?.connected) {
            dbCard.className = 'health-card healthy';
            dbStatus.textContent = `${data.database.projectCount} proyectos`;
        } else {
            dbCard.className = 'health-card unhealthy';
            dbStatus.textContent = 'Desconectada';
        }
        const endpoints = data.endpoints || [];
        const apiEp = endpoints.find(e => e.name === 'List Projects');
        const grpEp = endpoints.find(e => e.name === 'List Groups');
        const apiCard = document.getElementById('health-api');
        const apiStatus = document.getElementById('health-api-status');
        if (apiEp?.healthy) { apiCard.className = 'health-card healthy'; apiStatus.textContent = 'OK (200)'; }
        else { apiCard.className = 'health-card unhealthy'; apiStatus.textContent = 'Error'; }
        const grpCard = document.getElementById('health-groups');
        const grpStatus = document.getElementById('health-groups-status');
        if (grpEp?.healthy) { grpCard.className = 'health-card healthy'; grpStatus.textContent = 'OK (200)'; }
        else { grpCard.className = 'health-card unhealthy'; grpStatus.textContent = 'Error'; }
        document.getElementById('health-uptime').className = 'health-card healthy';
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

// ==================== DB Metrics ====================
async function loadDbMetrics() {
    try {
        const data = await fetchJSON(`${BASE}/health/db`);
        if (data.tables) {
            document.getElementById('metric-projects').textContent = data.tables.projects;
            document.getElementById('metric-tasks').textContent = data.tables.tasks;
            document.getElementById('metric-phases').textContent = data.tables.phases;
            document.getElementById('metric-groups').textContent = data.tables.groups;
        }
    } catch (err) { console.error('DB metrics failed:', err); }
}

// ==================== Groups ====================
async function loadGroups() {
    try {
        const data = await fetchJSON(`${BASE}/api/v3/portal/${PORTAL_ID}/projectgroups`);
        const grid = document.getElementById('groups-grid');
        const select = document.getElementById('filter-group');
        grid.innerHTML = '';
        select.innerHTML = '<option value="">Todas las VR</option>';
        (data.project_groups || []).forEach(g => {
            grid.innerHTML += `<div class="group-card">
                <div class="group-color" style="background:${g.color}"></div>
                <div class="group-info"><div class="group-name">${g.name}</div><div class="group-code">${g.code}</div></div>
                <div class="group-count">${g.project_count} proy.</div>
            </div>`;
            select.innerHTML += `<option value="${g.code}">${g.code} - ${g.name}</option>`;
        });
    } catch (err) { console.error('Groups load failed:', err); }
}

// ==================== Projects ====================
async function loadProjects() {
    try {
        const groupFilter = document.getElementById('filter-group').value;
        const statusFilter = document.getElementById('filter-status').value;
        let url = `${BASE}/api/v3/portal/${PORTAL_ID}/projects?range=50`;
        if (groupFilter) url += `&group=${groupFilter}`;
        if (statusFilter) url += `&custom_status=${statusFilter}`;

        const data = await fetchJSON(url);
        _projectsCache = data.projects || [];
        const tbody = document.getElementById('projects-tbody');
        const li = isLoggedIn();
        tbody.innerHTML = '';

        _projectsCache.forEach(p => {
            const totalTasks = (p.task_count?.open || 0) + (p.task_count?.closed || 0);
            const closedTasks = p.task_count?.closed || 0;
            const closedMilestones = p.milestone_count?.closed || 0;
            const percent = parseInt(p.project_percent) || 0;
            const hitosDots = Array.from({ length: 7 }, (_, i) =>
                `<span class="hito-dot ${i < closedMilestones ? 'completed' : ''}"></span>`
            ).join('');
            const progressColor = percent >= 80 ? 'var(--green)' : percent >= 40 ? 'var(--yellow)' : 'var(--red)';
            const statusLabel = STATUS_LABELS[p.custom_status] || p.custom_status;

            const actionsCell = li ? `<td class="col-actions"><div class="row-actions">
                <button class="btn-icon edit" onclick="openEditProject('${p.id_string}')" title="Editar"><i class="fas fa-pen"></i></button>
                <button class="btn-icon delete" onclick="openDeleteProject('${p.id_string}','${p.name.replace(/'/g, "\\'")}')" title="Eliminar"><i class="fas fa-trash"></i></button>
            </div></td>` : '';

            tbody.innerHTML += `<tr>
                <td><strong>${p.project_code || '—'}</strong></td>
                <td><div>${p.name}</div><div style="font-size:0.7rem;color:var(--text-muted)">${p.area_solicitante || ''}</div></td>
                <td><span class="badge badge-vr">${p.group?.code || '—'}</span></td>
                <td><span class="badge badge-${p.custom_status}">${statusLabel}</span></td>
                <td><div class="hitos-dots">${hitosDots}</div><span style="font-size:0.7rem;color:var(--text-muted)">${closedMilestones}/7</span></td>
                <td><span class="task-count"><span class="done">${closedTasks}</span>/<span class="total">${totalTasks}</span></span></td>
                <td><div style="display:flex;align-items:center;gap:0.3rem">
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${percent}%;background:${progressColor}"></div></div>
                    <span class="progress-text">${percent}%</span>
                </div></td>
                <td><div class="date-range">${p.start_date || '—'} / ${p.end_date || '—'}</div></td>
                ${actionsCell}
            </tr>`;
        });
    } catch (err) { console.error('Projects load failed:', err); }
}

// ==================== Project Modal (Create / Edit) ====================
function openProjectModal() {
    document.getElementById('pf-id-string').value = '';
    document.getElementById('project-form').reset();
    document.getElementById('modal-title').innerHTML = '<i class="fas fa-plus-circle"></i> Nuevo Proyecto';
    document.getElementById('pf-submit-btn').innerHTML = '<i class="fas fa-save"></i> Crear Proyecto';
    onHitosChange(0);
    updatePlanificadoLabel();
    document.getElementById('project-modal').style.display = 'flex';
}

function openEditProject(idString) {
    const p = _projectsCache.find(x => x.id_string === idString);
    if (!p) return;
    document.getElementById('pf-id-string').value = p.id_string;
    document.getElementById('pf-name').value = p.name;
    document.getElementById('pf-project-code').value = p.project_code || '';
    document.getElementById('pf-description').value = p.description || '';
    document.getElementById('pf-group-code').value = p.group?.code || '';
    document.getElementById('pf-area').value = p.area_solicitante || '';
    document.getElementById('pf-planificado').checked = !!p.planificado;
    updatePlanificadoLabel();

    // Dates: convert from MM-DD-YYYY to YYYY-MM-DD for input
    const parseDate = (d) => {
        if (!d) return '';
        const parts = d.split('-');
        if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[0]}-${parts[1]}`;
        return d;
    };
    document.getElementById('pf-start-date').value = parseDate(p.start_date);
    document.getElementById('pf-end-date').value = parseDate(p.end_date);

    const hitos = p.milestone_count?.closed || 0;
    document.getElementById('pf-hitos').value = hitos;
    onHitosChange(hitos);

    const totalTasks = (p.task_count?.open || 0) + (p.task_count?.closed || 0);
    document.getElementById('pf-total-tareas').value = totalTasks;
    document.getElementById('pf-tareas-completadas').value = p.task_count?.closed || 0;

    document.getElementById('modal-title').innerHTML = '<i class="fas fa-edit"></i> Editar Proyecto';
    document.getElementById('pf-submit-btn').innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
    document.getElementById('project-modal').style.display = 'flex';
}

function closeProjectModal() { document.getElementById('project-modal').style.display = 'none'; }

function onHitosChange(val) {
    val = parseInt(val);
    document.getElementById('pf-hitos-value').textContent = val;
    const status = statusFromHitos(val);
    const percent = Math.round((val / 7) * 100);
    document.getElementById('pf-status-preview').innerHTML =
        `<span class="badge badge-${status}">${STATUS_LABELS[status]}</span><span class="progress-text">${percent}%</span>`;
    document.getElementById('pf-hitos-preview').innerHTML = Array.from({ length: 7 }, (_, i) =>
        `<span class="hito-dot ${i < val ? 'completed' : ''}"></span>`
    ).join('');
}

function updatePlanificadoLabel() {
    const chk = document.getElementById('pf-planificado');
    document.getElementById('pf-planificado-label').textContent = chk.checked ? 'Si' : 'No';
}

async function saveProject(e) {
    e.preventDefault();
    const idString = document.getElementById('pf-id-string').value;
    const isEdit = !!idString;

    const body = {
        name: document.getElementById('pf-name').value,
        project_code: document.getElementById('pf-project-code').value,
        description: document.getElementById('pf-description').value,
        group_code: document.getElementById('pf-group-code').value,
        area_solicitante: document.getElementById('pf-area').value,
        planificado: document.getElementById('pf-planificado').checked,
        start_date: document.getElementById('pf-start-date').value,
        end_date: document.getElementById('pf-end-date').value,
        hitos_completados: parseInt(document.getElementById('pf-hitos').value),
        total_tareas: parseInt(document.getElementById('pf-total-tareas').value),
        tareas_completadas: parseInt(document.getElementById('pf-tareas-completadas').value)
    };

    try {
        const url = isEdit ? `${BASE}/admin/projects/${idString}` : `${BASE}/admin/projects`;
        const method = isEdit ? 'PATCH' : 'POST';
        const res = await fetch(url, { method, headers: adminHeaders(), body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Error al guardar', 'error'); return; }
        closeProjectModal();
        showToast(isEdit ? 'Proyecto actualizado' : 'Proyecto creado', 'success');
        await Promise.all([loadProjects(), loadDbMetrics(), loadGroups()]);
    } catch (err) { showToast('Error de conexion', 'error'); }
}

// ==================== Delete ====================
function openDeleteProject(idString, name) {
    _deleteTarget = idString;
    document.getElementById('delete-project-name').textContent = name;
    document.getElementById('delete-modal').style.display = 'flex';
}
function closeDeleteModal() { document.getElementById('delete-modal').style.display = 'none'; _deleteTarget = null; }

async function confirmDelete() {
    if (!_deleteTarget) return;
    try {
        const res = await fetch(`${BASE}/admin/projects/${_deleteTarget}`, { method: 'DELETE', headers: adminHeaders() });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Error al eliminar', 'error'); return; }
        closeDeleteModal();
        showToast('Proyecto eliminado', 'success');
        await Promise.all([loadProjects(), loadDbMetrics(), loadGroups()]);
    } catch { showToast('Error de conexion', 'error'); }
}

// ==================== API Endpoints (clickable) ====================
function renderEndpoints() {
    const list = document.getElementById('endpoints-list');
    const firstProject = _projectsCache[0]?.id_string || 'FZP-2001';
    const endpoints = [
        { method: 'GET', path: `/api/v3/portal/${PORTAL_ID}/projects`, desc: 'Listar todos los proyectos' },
        { method: 'GET', path: `/api/v3/portal/${PORTAL_ID}/projects/${firstProject}`, desc: 'Detalle de un proyecto' },
        { method: 'GET', path: `/api/v3/portal/${PORTAL_ID}/projects/${firstProject}/phases`, desc: 'Hitos de un proyecto' },
        { method: 'GET', path: `/api/v3/portal/${PORTAL_ID}/projects/${firstProject}/tasks`, desc: 'Tareas de un proyecto' },
        { method: 'GET', path: `/api/v3/portal/${PORTAL_ID}/projectgroups`, desc: 'Grupos (Vicerrectorias)' },
        { method: 'GET', path: `/health`, desc: 'Estado general del sistema' },
        { method: 'GET', path: `/health/db`, desc: 'Estado de la base de datos' },
        { method: 'GET', path: `/health/endpoints`, desc: 'Estado de endpoints' },
        { method: 'GET', path: `/health/metrics`, desc: 'Metricas de requests' },
        { method: 'POST', path: `/oauth/v2/token`, desc: 'OAuth2 simulado' }
    ];

    list.innerHTML = endpoints.map(e => `
        <div class="endpoint-item" onclick="fetchEndpoint('${e.method}','${e.path}')">
            <span class="endpoint-method ${e.method.toLowerCase()}">${e.method}</span>
            <span class="endpoint-path">${e.path}</span>
            <span class="endpoint-desc">${e.desc}</span>
        </div>
    `).join('');
}

async function fetchEndpoint(method, path) {
    document.getElementById('api-modal-title').innerHTML = `<i class="fas fa-code"></i> ${method} ${path}`;
    document.getElementById('api-modal-body').textContent = 'Cargando...';
    document.getElementById('api-meta').textContent = '';
    document.getElementById('api-modal').style.display = 'flex';

    const start = performance.now();
    try {
        let res;
        if (method === 'POST' && path.includes('oauth')) {
            res = await fetch(`${BASE}${path}`, {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'grant_type=authorization_code&client_id=fake-client-id&client_secret=fake-client-secret&code=fake-auth-code'
            });
        } else {
            res = await fetch(`${BASE}${path}`);
        }
        const ms = Math.round(performance.now() - start);
        const data = await res.json();
        document.getElementById('api-meta').innerHTML = `<span>Status: <strong>${res.status}</strong></span><span>Tiempo: <strong>${ms}ms</strong></span><span>Content-Type: application/json</span>`;
        document.getElementById('api-modal-body').textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        document.getElementById('api-modal-body').textContent = `Error: ${err.message}`;
    }
}

function closeApiModal() { document.getElementById('api-modal').style.display = 'none'; }

// ==================== Init ====================
async function init() {
    // Check existing session
    if (isLoggedIn()) {
        try {
            const res = await fetch(`${BASE}/admin/me`, { headers: adminHeaders() });
            if (!res.ok) clearToken();
        } catch { clearToken(); }
    }
    updateAuthUI();

    await Promise.all([loadHealth(), loadDbMetrics(), loadGroups()]);
    await loadProjects();
    renderEndpoints();

    document.getElementById('last-refresh').textContent = `Ultima actualizacion: ${new Date().toLocaleTimeString('es-CL')}`;

    // Planificado toggle listener
    document.getElementById('pf-planificado').addEventListener('change', updatePlanificadoLabel);
}

document.getElementById('filter-group').addEventListener('change', loadProjects);
document.getElementById('filter-status').addEventListener('change', loadProjects);

setInterval(async () => {
    await loadHealth();
    document.getElementById('last-refresh').textContent = `Ultima actualizacion: ${new Date().toLocaleTimeString('es-CL')}`;
}, 30000);

init();
