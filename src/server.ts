import express, { type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PORT } from './config.js';
import { registerBoardRoutes } from './routes/board.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerNewsletterRoutes } from './routes/newsletter.js';
import { registerSystemRoutes } from './routes/system.js';

const app = express();
app.use(express.json());

// Allow the desktop pet (file:// origin) to call the API.
app.use((_req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Static newsletter dashboard (public/).
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
app.use(express.static(publicDir));

// Routes (one module per concern).
registerSystemRoutes(app); // /health, /api/events, /api/loop/heartbeat, /api/info
registerBoardRoutes(app); // /api/board
registerTaskRoutes(app); // /api/tasks*
registerNewsletterRoutes(app); // /api/newsletter*

app.listen(PORT, () => console.log(`aivis-manager listening on :${PORT} (dashboard: /)`));
