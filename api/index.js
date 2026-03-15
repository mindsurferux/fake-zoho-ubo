import { handle } from 'hono/vercel';
import app from '../src/app.js';

export const runtime = 'edge';
export default handle(app);
