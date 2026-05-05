import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import net from 'net';
import db from '../database';

const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'keys');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 } });

const router = Router();

function publicConnection(row: any) {
  if (!row) return row;
  const { password, ...safe } = row;
  return {
    ...safe,
    has_password: Boolean(password),
  };
}

function testTcp(host: string, port: number, timeoutMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Connection timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });

    socket.once('error', (err) => {
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    });
  });
}

router.get('/', (_req: Request, res: Response) => {
  db.all('SELECT * FROM terminal_connections ORDER BY updated_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ connections: rows.map(publicConnection) });
  });
});

router.post('/', (req: Request, res: Response) => {
  const { name, host, port, username, auth_type, password, key_path, default_path } = req.body;
  const normalizedPort = Number(port || 22);
  const normalizedAuth = auth_type || 'password';

  if (!name || !host || !username) {
    res.status(400).json({ error: 'name, host, and username are required' });
    return;
  }
  if (!Number.isInteger(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535) {
    res.status(400).json({ error: 'port must be between 1 and 65535' });
    return;
  }
  if (!['password', 'key'].includes(normalizedAuth)) {
    res.status(400).json({ error: 'auth_type must be password or key' });
    return;
  }

  db.run(
    `INSERT INTO terminal_connections
      (name, host, port, username, auth_type, password, key_path, default_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, host, normalizedPort, username, normalizedAuth, password || '', key_path || '', default_path || ''],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.get('SELECT * FROM terminal_connections WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) {
          res.status(500).json({ error: err2.message });
          return;
        }
        res.status(201).json({ connection: publicConnection(row) });
      });
    }
  );
});

router.put('/:id', (req: Request, res: Response) => {
  const { name, host, port, username, auth_type, password, key_path, default_path } = req.body;
  const normalizedPort = port === undefined || port === null || port === '' ? undefined : Number(port);

  if (normalizedPort !== undefined && (!Number.isInteger(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535)) {
    res.status(400).json({ error: 'port must be between 1 and 65535' });
    return;
  }
  if (auth_type && !['password', 'key'].includes(auth_type)) {
    res.status(400).json({ error: 'auth_type must be password or key' });
    return;
  }

  db.run(
    `UPDATE terminal_connections SET
      name = COALESCE(?, name),
      host = COALESCE(?, host),
      port = COALESCE(?, port),
      username = COALESCE(?, username),
      auth_type = COALESCE(?, auth_type),
      password = COALESCE(?, password),
      key_path = COALESCE(?, key_path),
      default_path = COALESCE(?, default_path),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [name, host, normalizedPort, username, auth_type, password, key_path, default_path, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Terminal connection not found' });
        return;
      }
      db.get('SELECT * FROM terminal_connections WHERE id = ?', [req.params.id], (err2, row) => {
        if (err2) {
          res.status(500).json({ error: err2.message });
          return;
        }
        res.json({ connection: publicConnection(row) });
      });
    }
  );
});

router.post('/:id/test', (req: Request, res: Response) => {
  db.get('SELECT * FROM terminal_connections WHERE id = ?', [req.params.id], async (err, row: any) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Terminal connection not found' });
      return;
    }

    try {
      await testTcp(row.host, Number(row.port || 22));
      db.run(
        `UPDATE terminal_connections
         SET status = 'reachable', last_error = '', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [row.id]
      );
      res.json({ status: 'reachable', message: 'SSH port is reachable' });
    } catch (testErr: any) {
      db.run(
        `UPDATE terminal_connections
         SET status = 'error', last_error = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [testErr.message, row.id]
      );
      res.json({ status: 'error', message: testErr.message });
    }
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  db.run('DELETE FROM terminal_connections WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Terminal connection not found' });
      return;
    }
    res.json({ success: true });
  });
});

// Upload SSH key file
router.post('/:id/upload-key', upload.single('key'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No key file provided' });
    return;
  }
  const keyPath = req.file.path;
  const keyName = req.file.originalname;

  db.run(
    'UPDATE terminal_connections SET key_path = ?, auth_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [keyPath, 'key', req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Terminal connection not found' });
        return;
      }
      db.get('SELECT * FROM terminal_connections WHERE id = ?', [req.params.id], (err2, row) => {
        if (err2) {
          res.status(500).json({ error: err2.message });
          return;
        }
        res.json({ connection: publicConnection(row), keyName });
      });
    }
  );
});

// Delete uploaded SSH key
router.delete('/:id/key', (req: Request, res: Response) => {
  db.get('SELECT key_path FROM terminal_connections WHERE id = ?', [req.params.id], (err, row: any) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Terminal connection not found' });
      return;
    }
    if (row.key_path) {
      fs.unlink(row.key_path, () => {}); // ignore errors
    }
    db.run(
      'UPDATE terminal_connections SET key_path = \'\', updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id],
      function (err2) {
        if (err2) {
          res.status(500).json({ error: err2.message });
          return;
        }
        db.get('SELECT * FROM terminal_connections WHERE id = ?', [req.params.id], (err3, updated) => {
          if (err3) {
            res.status(500).json({ error: err3.message });
            return;
          }
          res.json({ connection: publicConnection(updated) });
        });
      }
    );
  });
});

export default router;
