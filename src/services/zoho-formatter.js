/**
 * Transforms DB rows into Zoho Projects API V3-compatible format
 */

const PORTAL_ID = process.env.PORTAL_ID || '8060001';
const BASE_URL = `https://projectsapi.zoho.com/restapi/portal/${PORTAL_ID}`;

export function formatProject(row) {
    return {
        id: row.id,
        id_string: row.id_string,
        name: row.name,
        description: row.description,
        project_code: row.project_code,
        status: row.status,
        custom_status: row.custom_status,
        is_public: row.is_public || 'no',
        project_percent: row.project_percent || '0',
        start_date: formatDateZoho(row.start_date),
        start_date_long: row.start_date ? new Date(row.start_date).getTime() : null,
        end_date: formatDateZoho(row.end_date),
        end_date_long: row.end_date ? new Date(row.end_date).getTime() : null,
        owner_name: row.owner_name,
        budget_value: row.budget_value || '0',
        area_solicitante: row.area_solicitante,
        planificado: row.planificado === 1 || row.planificado === true,
        task_count: {
            open: parseInt(row.tasks_open) || 0,
            closed: parseInt(row.tasks_closed) || 0
        },
        milestone_count: {
            open: parseInt(row.milestones_open) || 0,
            closed: parseInt(row.milestones_closed) || 0
        },
        bug_count: { open: 0, closed: 0 },
        group: row.group_id_string ? {
            id_string: row.group_id_string,
            name: row.group_name,
            code: row.group_code
        } : null,
        link: {
            task: { url: `${BASE_URL}/projects/${row.id_string}/tasks/` },
            milestone: { url: `${BASE_URL}/projects/${row.id_string}/milestones/` },
            activity: { url: `${BASE_URL}/projects/${row.id_string}/activities/` }
        },
        created_date: formatDateZoho(row.created_at),
        updated_date: formatDateZoho(row.updated_at),
        IS_BUG_ENABLED: false,
        is_strict: 'no'
    };
}

export function formatPhase(row) {
    return {
        id: row.id,
        id_string: row.id_string,
        name: row.name,
        description: row.description,
        status: row.status,
        sequence: row.sequence,
        start_date: formatDateZoho(row.start_date),
        start_date_long: row.start_date ? new Date(row.start_date).getTime() : null,
        end_date: formatDateZoho(row.end_date),
        end_date_long: row.end_date ? new Date(row.end_date).getTime() : null,
        completed_date: formatDateZoho(row.completed_date),
        created_date: formatDateZoho(row.created_at),
        updated_date: formatDateZoho(row.updated_at)
    };
}

export function formatTask(row) {
    return {
        id: row.id,
        id_string: row.id_string,
        name: row.name,
        description: row.description,
        status: {
            name: row.status_name,
            type: row.status_type
        },
        priority: row.priority,
        percent_complete: row.percent_complete || '0',
        start_date: formatDateZoho(row.start_date),
        start_date_long: row.start_date ? new Date(row.start_date).getTime() : null,
        end_date: formatDateZoho(row.end_date),
        end_date_long: row.end_date ? new Date(row.end_date).getTime() : null,
        created_time: row.created_at,
        last_updated_time: row.updated_at
    };
}

export function formatGroup(row) {
    return {
        id: row.id,
        id_string: row.id_string,
        name: row.name,
        code: row.code,
        color: row.color,
        project_count: parseInt(row.project_count) || 0,
        created_date: formatDateZoho(row.created_at)
    };
}

/**
 * Format date to Zoho style: MM-DD-YYYY
 */
function formatDateZoho(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}-${dd}-${yyyy}`;
}
