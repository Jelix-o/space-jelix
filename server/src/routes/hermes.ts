import { Router, Request, Response } from 'express';
import db from '../database';

const router = Router();

// Get all connections
router.get('/connections', (req: Request, res: Response) => {
  db.all('SELECT * FROM hermes_connections ORDER BY updated_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ connections: rows });
  });
});

// Create connection
router.post('/connections', (req: Request, res: Response) => {
  const { name, type, endpoint, api_key, config } = req.body;
  if (!name || !type || !endpoint) {
    res.status(400).json({ error: 'name, type, and endpoint are required' });
    return;
  }
  if (!['hermes', 'openclaw'].includes(type)) {
    res.status(400).json({ error: 'type must be hermes or openclaw' });
    return;
  }

  db.run(
    'INSERT INTO hermes_connections (name, type, endpoint, api_key, config) VALUES (?, ?, ?, ?, ?)',
    [name, type, endpoint, api_key || '', JSON.stringify(config || {})],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.get('SELECT * FROM hermes_connections WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) {
          res.status(500).json({ error: err2.message });
          return;
        }
        res.status(201).json({ connection: row });
      });
    }
  );
});

// Test connection
router.post('/connections/:id/test', (req: Request, res: Response) => {
  db.get('SELECT * FROM hermes_connections WHERE id = ?', [req.params.id], async (err, row: any) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (row.api_key) {
        headers['Authorization'] = `Bearer ${row.api_key}`;
      }

      let testUrl = row.endpoint;
      if (row.type === 'hermes') {
        testUrl = `${row.endpoint}/v1/models`;
      } else if (row.type === 'openclaw') {
        testUrl = `${row.endpoint}/api/health`;
      }

      const response = await fetch(testUrl, { method: 'GET', headers, signal: AbortSignal.timeout(10000) });
      const status = response.ok ? 'connected' : 'error';

      db.run('UPDATE hermes_connections SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        status,
        row.id,
      ]);

      res.json({
        status,
        statusCode: response.status,
        message: response.ok ? 'Connection successful' : `HTTP ${response.status}`,
      });
    } catch (fetchErr: any) {
      db.run('UPDATE hermes_connections SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'error',
        row.id,
      ]);
      res.json({ status: 'error', message: fetchErr.message });
    }
  });
});

// Update connection
router.put('/connections/:id', (req: Request, res: Response) => {
  const { name, endpoint, api_key, config } = req.body;
  const sql = `UPDATE hermes_connections SET
    name = COALESCE(?, name), endpoint = COALESCE(?, endpoint),
    api_key = COALESCE(?, api_key), config = COALESCE(?, config),
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

  db.run(sql, [name, endpoint, api_key, config ? JSON.stringify(config) : null, req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    db.get('SELECT * FROM hermes_connections WHERE id = ?', [req.params.id], (err2, row) => {
      if (err2) {
        res.status(500).json({ error: err2.message });
        return;
      }
      res.json({ connection: row });
    });
  });
});

// Delete connection
router.delete('/connections/:id', (req: Request, res: Response) => {
  db.run('DELETE FROM hermes_connections WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    res.json({ success: true });
  });
});

// Proxy chat through a connection (Hermes/OpenClaw)
router.post('/connections/:id/chat', async (req: Request, res: Response) => {
  const { messages, model } = req.body;

  db.get('SELECT * FROM hermes_connections WHERE id = ?', [req.params.id], async (err, conn: any) => {
    if (err || !conn) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (conn.api_key) headers['Authorization'] = `Bearer ${conn.api_key}`;

      let chatUrl = '';
      let body: any = {};

      if (conn.type === 'hermes') {
        chatUrl = `${conn.endpoint}/v1/chat/completions`;
        body = { model: model || 'hermes-3-llama-3.1-70b', messages, max_tokens: 2048, temperature: 0.7 };
      } else if (conn.type === 'openclaw') {
        chatUrl = `${conn.endpoint}/api/chat`;
        body = { model: model || 'default', messages };
      }

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errText = await response.text();
        res.status(response.status).json({ error: errText });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (fetchErr: any) {
      res.status(502).json({ error: fetchErr.message });
    }
  });
});

export default router;
