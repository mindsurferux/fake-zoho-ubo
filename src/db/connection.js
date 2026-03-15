import { neon } from '@neondatabase/serverless';

let sql = null;

export function getDb() {
    if (sql) return sql;
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
    }
    
    sql = neon(databaseUrl);
    return sql;
}

export async function checkDbHealth() {
    try {
        const sql = getDb();
        const rows = await sql`SELECT COUNT(*) as count FROM projects`;
        return {
            connected: true,
            projectCount: parseInt(rows[0].count),
            provider: 'Neon Postgres'
        };
    } catch (err) {
        return {
            connected: false,
            error: err.message,
            provider: 'Neon Postgres'
        };
    }
}

export async function initSchema() {
    const sql = getDb();

    await sql`
        CREATE TABLE IF NOT EXISTS project_groups (
            id SERIAL PRIMARY KEY,
            id_string TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            color TEXT DEFAULT '#6b7280',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            id_string TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            project_code TEXT,
            status TEXT DEFAULT 'active',
            custom_status TEXT DEFAULT 'sin_iniciar',
            is_public TEXT DEFAULT 'no',
            start_date DATE,
            end_date DATE,
            project_percent TEXT DEFAULT '0',
            owner_name TEXT,
            group_id INTEGER REFERENCES project_groups(id),
            area_solicitante TEXT,
            planificado INTEGER DEFAULT 0,
            budget_value TEXT DEFAULT '0',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS phases (
            id SERIAL PRIMARY KEY,
            id_string TEXT UNIQUE NOT NULL,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'notcompleted',
            start_date DATE,
            end_date DATE,
            completed_date DATE,
            sequence INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            id_string TEXT UNIQUE NOT NULL,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            description TEXT,
            status_type TEXT DEFAULT 'open',
            status_name TEXT DEFAULT 'Open',
            priority TEXT DEFAULT 'None',
            percent_complete TEXT DEFAULT '0',
            start_date DATE,
            end_date DATE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS webhooks (
            id SERIAL PRIMARY KEY,
            url TEXT NOT NULL,
            events TEXT[] DEFAULT ARRAY['project.updated', 'project.created', 'project.deleted'],
            secret TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_phase ON tasks(phase_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_group ON projects(group_id)`;
}
