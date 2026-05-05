import http from 'http';
import express from 'express';
import cors, { type CorsOptions } from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database';
import appsRouter from './routes/apps';
import chatRouter from './routes/chat';
import hermesRouter from './routes/hermes';
import providersRouter, { seedDefaultProviders } from './routes/providers';
import terminalsRouter from './routes/terminals';
import imagesRouter from './routes/images';
import proxyRouter from './routes/proxy';
import { setupTerminalWs } from './terminal-ws';
import { authMiddleware, createAuthRouter } from './auth';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);
const corsOrigin = parseCorsOrigin(process.env.CORS_ORIGIN);

// Middleware
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10mb' }));

function parseCorsOrigin(raw?: string): CorsOptions['origin'] {
  const origins = raw
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins?.length || origins.includes('*')) return '*';

  return (origin, callback) => {
    if (!origin || origins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  };
}

// Health check (no auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Auth routes (no auth required)
app.use('/api/auth', createAuthRouter());

// Auth middleware for all other API routes
app.use('/api', authMiddleware);

// Protected routes
app.use('/api/apps', appsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/hermes', hermesRouter);
app.use('/api/providers', providersRouter);
app.use('/api/terminals', terminalsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/proxy', proxyRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    await initializeDatabase();
    console.log('Database initialized');

    await seedDefaultProviders();

    const httpServer = http.createServer(app);
    setupTerminalWs(httpServer);

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Hermes Hub API server running on http://0.0.0.0:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
