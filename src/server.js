import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import app from './app.js';

const PORT = process.env.PORT || 3500;
const PORTAL_ID = process.env.PORTAL_ID || '8060001';

// Serve static files (dashboard) in local dev
app.use('/*', serveStatic({ root: './public' }));

serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`\n=== Fake Zoho Projects API v2 ===`);
    console.log(`Dashboard:  http://localhost:${PORT}`);
    console.log(`API Base:   http://localhost:${PORT}/api/v3/portal/${PORTAL_ID}`);
    console.log(`Health:     http://localhost:${PORT}/health`);
    console.log(`Portal ID:  ${PORTAL_ID}`);
    console.log(`DB:         Neon Postgres`);
    console.log(`=================================\n`);
});
