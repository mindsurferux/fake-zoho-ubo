import 'dotenv/config';
import { initSchema } from './src/db/connection.js';

initSchema()
  .then(() => console.log('Schema updated (webhooks table created)'))
  .catch(e => console.error(e));
