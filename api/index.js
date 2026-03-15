import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import app from '../src/app.js';

export const config = {
    runtime: 'edge'
};

const handler = handle(app);
export default handler;
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
export const PUT = handler;
