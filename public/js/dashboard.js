const BASE = window.location.origin;
let PORTAL_ID = '8060001';

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// --- Health ---
async function loadHealth() {
    try {
        const data = await fetchJSON(`${BASE}/health`);
        document.getElementById('portal-id').textContent = PORTAL_ID;

        // Overall status
        const indicator = document.getElementById('status-indicator');
        if (data.status === 'healthy') {
            indicator.className = 'status-badge status-healthy';
            indicator.innerHTML = '<i class="fas fa-check-circle"></i> Operativo';
        } else {
            indicator.className = 'status-badge status-degraded';
            indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Degradado';
        }

        // DB
        const dbCard = document.getElementById('health-db');
        const dbStatus = document.getElementById('health-db-status');
        if (data.database?.connected) {
            dbCard.className = 'health-card healthy';
            dbStatus.textContent = `${data.database.projectCount} proyectos`;
        } else {
            dbCard.className = 'health-card unhealthy';
            dbStatus.textContent = 'Desconectada';
        }

        // Endpoints
        const endpoints = data.endpoints || [];
        const apiEp = endpoints.find(e => e.name === 'List Projects');
        const grpEp = endpoints.find(e => e.name === 'List Groups');

        const apiCard = document.getElementById('health-api');
        const apiStatus = document.getElementById('health-api-status');
        if (apiEp?.healthy) {
            apiCard.className = 'health-card healthy';
            apiStatus.textContent = 'OK (200)';
        } else {
            apiCard.className = 'health-card unhealthy';
            apiStatus.textContent = 'Error';
        }

        const grpCard = document.getElementById('health-groups');
        const grpStatus = document.getElementById('health-groups-status');
        if (grpEp?.healthy) {
            grpCard.className = 'health-card healthy';
            grpStatus.textContent = 'OK (200)';
        } else {
            grpCard.className = 'health-card unhealthy';
            grpStatus.textContent = 'Error';
        }

        // Uptime
        const uptimeCard = document.getElementById('health-uptime');
        uptimeCard.className = 'health-card healthy';
        document.getElementById('health-uptime-status').textContent = data.uptime_human || '—';

        // Metrics
        document.getElementById('metric-requests').textContent = data.metrics?.total_requests || 0;
        document.getElementById('metric-errors').textContent = data.metrics?.total_errors || 0;

    } catch (err) {
        console.error('Health check failed:', err);
        const indicator = document.getElementById('status-indicator');
        indicator.className = 'status-badge status-degraded';
        indicator.innerHTML = '<i class="fas fa-times-circle"></i> Sin conexion';
    }
}

// --- DB Metrics ---
async function loadDbMetrics() {
    try {
        const data = await fetchJSON(`${BASE}/health/db`);
        if (data.tables) {
            document.getElementById('metric-projects').textContent = data.tables.projects;
            document.getElementById('metric-tasks').textContent = data.tables.tasks;
            document.getElementById('metric-phases').textContent = data.tables.phases;
            document.getElementById('metric-groups').textContent = data.tables.groups;
        }
    } catch (err) {
        console.error('DB metrics failed:', err);
    }
}

// --- Groups ---
async function loadGroups() {
    try {
        const data = await fetchJSON(`${BASE}/api/v3/portal/${PORTAL_ID}/projectgroups`);
        const grid = document.getElementById('groups-grid');
        const select = document.getElementById('filter-group');

        grid.innerHTML = '';
        select.innerHTML = '<option value="">Todas las VR</option>';

        (data.project_groups || []).forEach(g => {
            grid.innerHTML += `
                <div class="group-card">
                    <div class="group-color" style="background:${g.color}"></div>
                    <div class="group-info">
                        <div class="group-name">${g.name}</div>
                        <div class="group-code">${g.code}</div>
                    </div>
                    <div class="group-count">${g.project_count} proy.</div>
                </div>
            `;
            select.innerHTML += `<option value="${g.code}">${g.code} - ${g.name}</option>`;
        });
    } catch (err) {
        console.error('Groups load failed:', err);
    }
}

// --- Projects ---
async function loadProjects() {
    try {
        const groupFilter = document.getElementById('filter-group').value;
        const statusFilter = document.getElementById('filter-status').value;

        let url = `${BASE}/api/v3/portal/${PORTAL_ID}/projects?`;
        if (groupFilter) url += `group=${groupFilter}&`;
        if (statusFilter) url += `custom_status=${statusFilter}&`;

        const data = await fetchJSON(url);
        const tbody = document.getElementById('projects-tbody');
        tbody.innerHTML = '';

        (data.projects || []).forEach(p => {
            const totalTasks = (p.task_count?.open || 0) + (p.task_count?.closed || 0);
            const closedTasks = p.task_count?.closed || 0;
            const totalMilestones = (p.milestone_count?.open || 0) + (p.milestone_count?.closed || 0);
            const closedMilestones = p.milestone_count?.closed || 0;
            const percent = parseInt(p.project_percent) || 0;

            const hitosDots = Array.from({ length: 7 }, (_, i) =>
                `<span class="hito-dot ${i < closedMilestones ? 'completed' : ''}"></span>`
            ).join('');

            const progressColor = percent >= 80 ? 'var(--green)' :
                                  percent >= 40 ? 'var(--yellow)' : 'var(--red)';

            const statusLabel = {
                'sin_iniciar': 'Sin iniciar',
                'levantamiento': 'Levantamiento',
                'desarrollo': 'Desarrollo',
                'puesta_en_marcha': 'Puesta en Marcha',
                'completado': 'Completado'
            }[p.custom_status] || p.custom_status;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${p.project_code || '—'}</strong></td>
                    <td>
                        <div>${p.name}</div>
                        <div style="font-size:0.7rem;color:var(--text-muted)">${p.area_solicitante || ''}</div>
                    </td>
                    <td><span class="badge badge-vr">${p.group?.code || '—'}</span></td>
                    <td><span class="badge badge-${p.custom_status}">${statusLabel}</span></td>
                    <td>
                        <div class="hitos-dots">${hitosDots}</div>
                        <span style="font-size:0.7rem;color:var(--text-muted)">${closedMilestones}/7</span>
                    </td>
                    <td>
                        <span class="task-count">
                            <span class="done">${closedTasks}</span>/<span class="total">${totalTasks}</span>
                        </span>
                    </td>
                    <td>
                        <div style="display:flex;align-items:center;gap:0.3rem">
                            <div class="progress-bar-container">
                                <div class="progress-bar-fill" style="width:${percent}%;background:${progressColor}"></div>
                            </div>
                            <span class="progress-text">${percent}%</span>
                        </div>
                    </td>
                    <td>
                        <div class="date-range">${p.start_date || '—'} / ${p.end_date || '—'}</div>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        console.error('Projects load failed:', err);
    }
}

// --- Endpoints Reference ---
function renderEndpoints() {
    const list = document.getElementById('endpoints-list');
    const endpoints = [
        { method: 'GET', path: `/api/v3/portal/${PORTAL_ID}/projects`, desc: 'Listar todos los proyectos' },
        { method: 'GET', path: `/api/v3/portal/${PORTAL_ID}/projects/{id}`, desc: 'Detalle de un proyecto' },
        { method: 'GET', path: `/api/v3/portal/${PORTAL_ID}/projects/{id}/phases`, desc: 'Hitos de un proyecto' },
        { method: 'GET', path: `/api/v3/portal/${PORTAL_ID}/projects/{id}/tasks`, desc: 'Tareas de un proyecto' },
        { method: 'GET', path: `/api/v3/portal/${PORTAL_ID}/projectgroups`, desc: 'Grupos (Vicerrectorias)' },
        { method: 'GET', path: `/health`, desc: 'Estado general del sistema' },
        { method: 'GET', path: `/health/db`, desc: 'Estado de la base de datos' },
        { method: 'GET', path: `/health/endpoints`, desc: 'Estado de endpoints' },
        { method: 'GET', path: `/health/metrics`, desc: 'Metricas de requests' }
    ];

    list.innerHTML = endpoints.map(e => `
        <div class="endpoint-item">
            <span class="endpoint-method">${e.method}</span>
            <span class="endpoint-path">${e.path}</span>
            <span class="endpoint-desc">${e.desc}</span>
        </div>
    `).join('');
}

// --- Init ---
async function init() {
    renderEndpoints();
    await Promise.all([loadHealth(), loadDbMetrics(), loadGroups()]);
    await loadProjects();
    document.getElementById('last-refresh').textContent =
        `Ultima actualizacion: ${new Date().toLocaleTimeString('es-CL')}`;
}

// Filters
document.getElementById('filter-group').addEventListener('change', loadProjects);
document.getElementById('filter-status').addEventListener('change', loadProjects);

// Auto-refresh every 30s
setInterval(async () => {
    await loadHealth();
    document.getElementById('last-refresh').textContent =
        `Ultima actualizacion: ${new Date().toLocaleTimeString('es-CL')}`;
}, 30000);

init();
