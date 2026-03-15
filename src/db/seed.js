import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { initSchema } from './connection.js';

const PHASE_NAMES = [
    'Levantamiento de Requerimientos',
    'Diseno de Solucion',
    'Desarrollo Core',
    'Desarrollo Integraciones',
    'Testing y QA',
    'Puesta en Marcha',
    'Cierre y Documentacion'
];

const TASK_TEMPLATES = [
    'Reunion de kickoff',
    'Definir alcance del proyecto',
    'Recopilar requerimientos funcionales',
    'Recopilar requerimientos no funcionales',
    'Analisis de riesgos',
    'Diseno de arquitectura',
    'Diseno de base de datos',
    'Diseno de interfaces',
    'Prototipado UI/UX',
    'Desarrollo modulo principal',
    'Desarrollo API REST',
    'Integracion con sistemas externos',
    'Configuracion de infraestructura',
    'Pruebas unitarias',
    'Pruebas de integracion',
    'Pruebas de aceptacion usuario',
    'Correccion de bugs',
    'Documentacion tecnica',
    'Documentacion de usuario',
    'Capacitacion equipo',
    'Despliegue en staging',
    'Despliegue en produccion',
    'Monitoreo post-despliegue',
    'Cierre formal del proyecto',
    'Retrospectiva del proyecto'
];

const groups = [
    { id_string: 'FZG-1001', name: 'Administracion y Finanzas', code: 'VRAF', color: '#3b82f6' },
    { id_string: 'FZG-1002', name: 'Academica', code: 'VRAC', color: '#8b5cf6' },
    { id_string: 'FZG-1003', name: 'De Vinculacion', code: 'VRV', color: '#10b981' },
    { id_string: 'FZG-1004', name: 'Rectoria', code: 'VREC', color: '#f59e0b' }
];

const projects = [
    // VRAF (4)
    { id_string: 'FZP-2001', name: 'Sistema Gestion Presupuestaria', project_code: 'AF-01', group_code: 'VRAF', area_solicitante: 'Direccion de Finanzas', status: 'active', custom_status: 'desarrollo', planificado: 1, start_date: '2025-03-01', end_date: '2025-12-15', hitos_completados: 3, total_tareas: 18, tareas_completadas: 10, owner_name: 'Jorge Mendez' },
    { id_string: 'FZP-2002', name: 'Portal de Transparencia Financiera', project_code: 'AF-02', group_code: 'VRAF', area_solicitante: 'Contraloria Interna', status: 'active', custom_status: 'levantamiento', planificado: 1, start_date: '2025-06-01', end_date: '2026-03-30', hitos_completados: 1, total_tareas: 12, tareas_completadas: 3, owner_name: 'Maria Lopez' },
    { id_string: 'FZP-2003', name: 'Automatizacion Rendiciones', project_code: 'AF-03', group_code: 'VRAF', area_solicitante: 'Tesoreria', status: 'active', custom_status: 'puesta_en_marcha', planificado: 1, start_date: '2024-09-01', end_date: '2025-06-30', hitos_completados: 6, total_tareas: 22, tareas_completadas: 20, owner_name: 'Carlos Ruiz' },
    { id_string: 'FZP-2004', name: 'Dashboard KPIs Financieros', project_code: 'AF-04', group_code: 'VRAF', area_solicitante: 'Planificacion', status: 'active', custom_status: 'sin_iniciar', planificado: 0, start_date: '2026-01-15', end_date: '2026-08-30', hitos_completados: 0, total_tareas: 8, tareas_completadas: 0, owner_name: 'Ana Torres' },
    // VRAC (4)
    { id_string: 'FZP-2005', name: 'Plataforma Evaluacion Docente', project_code: 'AC-01', group_code: 'VRAC', area_solicitante: 'Direccion Academica', status: 'active', custom_status: 'desarrollo', planificado: 1, start_date: '2025-02-15', end_date: '2025-11-30', hitos_completados: 4, total_tareas: 20, tareas_completadas: 14, owner_name: 'Patricia Soto' },
    { id_string: 'FZP-2006', name: 'Sistema Seguimiento Curricular', project_code: 'AC-02', group_code: 'VRAC', area_solicitante: 'Registro Academico', status: 'active', custom_status: 'levantamiento', planificado: 1, start_date: '2025-07-01', end_date: '2026-04-30', hitos_completados: 1, total_tareas: 15, tareas_completadas: 4, owner_name: 'Roberto Diaz' },
    { id_string: 'FZP-2007', name: 'Portal Acreditacion Programas', project_code: 'AC-03', group_code: 'VRAC', area_solicitante: 'Aseguramiento de Calidad', status: 'active', custom_status: 'desarrollo', planificado: 1, start_date: '2025-04-01', end_date: '2026-01-31', hitos_completados: 3, total_tareas: 25, tareas_completadas: 12, owner_name: 'Claudia Vera' },
    { id_string: 'FZP-2008', name: 'App Movil Estudiantes', project_code: 'AC-04', group_code: 'VRAC', area_solicitante: 'DAE', status: 'active', custom_status: 'sin_iniciar', planificado: 0, start_date: '2026-03-01', end_date: '2026-12-15', hitos_completados: 0, total_tareas: 10, tareas_completadas: 0, owner_name: 'Felipe Araya' },
    // VRV (4)
    { id_string: 'FZP-2009', name: 'CRM Alumni UBO', project_code: 'VV-01', group_code: 'VRV', area_solicitante: 'Direccion de Egresados', status: 'active', custom_status: 'puesta_en_marcha', planificado: 1, start_date: '2024-11-01', end_date: '2025-07-31', hitos_completados: 6, total_tareas: 19, tareas_completadas: 17, owner_name: 'Sandra Munoz' },
    { id_string: 'FZP-2010', name: 'Portal Practicas Profesionales', project_code: 'VV-02', group_code: 'VRV', area_solicitante: 'Centro de Practicas', status: 'active', custom_status: 'desarrollo', planificado: 1, start_date: '2025-05-01', end_date: '2026-02-28', hitos_completados: 3, total_tareas: 16, tareas_completadas: 8, owner_name: 'Diego Fuentes' },
    { id_string: 'FZP-2011', name: 'Sistema Convenios Institucionales', project_code: 'VV-03', group_code: 'VRV', area_solicitante: 'Relaciones Internacionales', status: 'active', custom_status: 'levantamiento', planificado: 1, start_date: '2025-08-01', end_date: '2026-05-31', hitos_completados: 2, total_tareas: 14, tareas_completadas: 5, owner_name: 'Valentina Rojas' },
    { id_string: 'FZP-2012', name: 'Encuesta Empleabilidad', project_code: 'VV-04', group_code: 'VRV', area_solicitante: 'Estudios', status: 'active', custom_status: 'completado', planificado: 1, start_date: '2024-06-01', end_date: '2025-03-15', hitos_completados: 7, total_tareas: 12, tareas_completadas: 12, owner_name: 'Ignacio Parra' },
    // VREC (4)
    { id_string: 'FZP-2013', name: 'Dashboard Indicadores Estrategicos', project_code: 'RE-01', group_code: 'VREC', area_solicitante: 'Planificacion Estrategica', status: 'active', custom_status: 'desarrollo', planificado: 1, start_date: '2025-01-15', end_date: '2025-10-31', hitos_completados: 4, total_tareas: 21, tareas_completadas: 13, owner_name: 'Cristian Morales' },
    { id_string: 'FZP-2014', name: 'Sistema Actas Consejo Superior', project_code: 'RE-02', group_code: 'VREC', area_solicitante: 'Secretaria General', status: 'active', custom_status: 'puesta_en_marcha', planificado: 1, start_date: '2024-10-01', end_date: '2025-05-31', hitos_completados: 5, total_tareas: 17, tareas_completadas: 15, owner_name: 'Lorena Castro' },
    { id_string: 'FZP-2015', name: 'Plataforma Comunicaciones Internas', project_code: 'RE-03', group_code: 'VREC', area_solicitante: 'Comunicaciones', status: 'active', custom_status: 'levantamiento', planificado: 0, start_date: '2025-09-01', end_date: '2026-06-30', hitos_completados: 1, total_tareas: 11, tareas_completadas: 2, owner_name: 'Andrea Silva' },
    { id_string: 'FZP-2016', name: 'Intranet Corporativa v2', project_code: 'RE-04', group_code: 'VREC', area_solicitante: 'DTI', status: 'active', custom_status: 'sin_iniciar', planificado: 0, start_date: '2026-04-01', end_date: '2027-01-31', hitos_completados: 0, total_tareas: 15, tareas_completadas: 0, owner_name: 'Daniela Ortiz' }
];

function genId(prefix, num) {
    return `${prefix}-${String(num).padStart(6, '0')}`;
}

function randomDate(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    const d = new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime()));
    return d.toISOString().split('T')[0];
}

async function seed(fresh = false) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('[Seed] ERROR: DATABASE_URL not set. Copy .env.example to .env and configure.');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    // Init schema
    console.log('[Seed] Initializing schema...');
    process.env.DATABASE_URL = databaseUrl; // ensure connection.js can use it
    await initSchema();

    if (fresh) {
        console.log('[Seed] Dropping existing data...');
        await sql`DELETE FROM tasks`;
        await sql`DELETE FROM phases`;
        await sql`DELETE FROM projects`;
        await sql`DELETE FROM project_groups`;
    }

    // Check if already seeded
    const existing = await sql`SELECT COUNT(*) as c FROM projects`;
    if (parseInt(existing[0].c) > 0 && !fresh) {
        console.log(`[Seed] Database already has ${existing[0].c} projects. Use --fresh to reseed.`);
        return;
    }

    // Insert groups
    console.log('[Seed] Seeding project groups (Vicerrectorias)...');
    const groupMap = {};
    for (const g of groups) {
        const rows = await sql`
            INSERT INTO project_groups (id_string, name, code, color)
            VALUES (${g.id_string}, ${g.name}, ${g.code}, ${g.color})
            RETURNING id
        `;
        groupMap[g.code] = rows[0].id;
        console.log(`  + ${g.code}: ${g.name}`);
    }

    // Insert projects + phases + tasks
    console.log('[Seed] Seeding 16 projects...');
    let phaseCounter = 3000;
    let taskCounter = 4000;

    for (const p of projects) {
        const percent = p.total_tareas > 0
            ? Math.round((p.tareas_completadas / p.total_tareas) * 100)
            : 0;

        const description = `Proyecto ${p.project_code} - ${p.name}. Area solicitante: ${p.area_solicitante}.`;
        const groupId = groupMap[p.group_code];

        const projRows = await sql`
            INSERT INTO projects (id_string, name, description, project_code, status, custom_status, start_date, end_date, project_percent, owner_name, group_id, area_solicitante, planificado)
            VALUES (${p.id_string}, ${p.name}, ${description}, ${p.project_code}, ${p.status}, ${p.custom_status}, ${p.start_date}, ${p.end_date}, ${String(percent)}, ${p.owner_name}, ${groupId}, ${p.area_solicitante}, ${p.planificado})
            RETURNING id
        `;
        const projectId = projRows[0].id;
        const phaseIds = [];

        // Create 7 phases (hitos)
        for (let i = 0; i < 7; i++) {
            const isCompleted = i < p.hitos_completados;
            const phaseIdString = genId('FZH', phaseCounter++);

            const projStart = new Date(p.start_date);
            const projEnd = new Date(p.end_date);
            const totalDays = (projEnd - projStart) / (1000 * 60 * 60 * 24);
            const phaseLength = Math.floor(totalDays / 7);

            const phaseStart = new Date(projStart.getTime() + i * phaseLength * 86400000);
            const phaseEnd = new Date(phaseStart.getTime() + phaseLength * 86400000);

            const phaseStartStr = phaseStart.toISOString().split('T')[0];
            const phaseEndStr = phaseEnd.toISOString().split('T')[0];
            const completedDate = isCompleted ? phaseEndStr : null;
            const phaseStatus = isCompleted ? 'completed' : 'notcompleted';
            const phaseName = PHASE_NAMES[i];
            const phaseDesc = `Fase ${i + 1} del proyecto ${p.project_code}`;

            const phaseRows = await sql`
                INSERT INTO phases (id_string, project_id, name, description, status, start_date, end_date, completed_date, sequence)
                VALUES (${phaseIdString}, ${projectId}, ${phaseName}, ${phaseDesc}, ${phaseStatus}, ${phaseStartStr}, ${phaseEndStr}, ${completedDate}, ${i + 1})
                RETURNING id
            `;
            phaseIds.push(phaseRows[0].id);
        }

        // Create tasks
        const shuffledTasks = [...TASK_TEMPLATES].sort(() => Math.random() - 0.5);
        const taskCount = p.total_tareas;
        const completedCount = p.tareas_completadas;
        const priorities = ['None', 'Low', 'Medium', 'High'];

        for (let t = 0; t < taskCount; t++) {
            const taskName = shuffledTasks[t % shuffledTasks.length];
            const isCompleted = t < completedCount;
            const phaseIdx = Math.min(Math.floor(t / Math.ceil(taskCount / 7)), 6);
            const phaseId = phaseIds[phaseIdx];

            const taskStart = randomDate(p.start_date, p.end_date);
            const taskEnd = randomDate(taskStart, p.end_date);
            const taskIdString = genId('FZT', taskCounter++);
            const statusType = isCompleted ? 'closed' : 'open';
            const statusName = isCompleted ? 'Closed' : (t < completedCount + 3 ? 'In Progress' : 'Open');
            const priority = priorities[Math.floor(Math.random() * priorities.length)];
            const percentComplete = isCompleted ? '100' : String(Math.floor(Math.random() * 80));

            await sql`
                INSERT INTO tasks (id_string, project_id, phase_id, name, status_type, status_name, priority, percent_complete, start_date, end_date)
                VALUES (${taskIdString}, ${projectId}, ${phaseId}, ${taskName}, ${statusType}, ${statusName}, ${priority}, ${percentComplete}, ${taskStart}, ${taskEnd})
            `;
        }

        console.log(`  + [${p.project_code}] ${p.name} — ${p.hitos_completados}/7 hitos, ${p.tareas_completadas}/${p.total_tareas} tareas`);
    }

    // Summary
    const summary = await sql`
        SELECT
            (SELECT COUNT(*) FROM project_groups) as groups,
            (SELECT COUNT(*) FROM projects) as projects,
            (SELECT COUNT(*) FROM phases) as phases,
            (SELECT COUNT(*) FROM tasks) as tasks
    `;

    console.log(`\n[Seed] Completado:`);
    console.log(`  Groups:   ${summary[0].groups}`);
    console.log(`  Projects: ${summary[0].projects}`);
    console.log(`  Phases:   ${summary[0].phases}`);
    console.log(`  Tasks:    ${summary[0].tasks}`);
}

const fresh = process.argv.includes('--fresh');
seed(fresh).catch(err => {
    console.error('[Seed] Fatal error:', err);
    process.exit(1);
});
