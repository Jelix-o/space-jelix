import { Router, Request, Response } from 'express';
import db from '../database';

const router = Router();

// Get all apps
router.get('/', (req: Request, res: Response) => {
  const { category, search } = req.query;
  let sql = 'SELECT * FROM apps';
  const params: any[] = [];
  const conditions: string[] = [];

  if (category && category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  }
  if (search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY updated_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ apps: rows });
  });
});

// Get single app
router.get('/:id', (req: Request, res: Response) => {
  db.get('SELECT * FROM apps WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    res.json({ app: row });
  });
});

// Create app
router.post('/', (req: Request, res: Response) => {
  const { name, icon, url, description, category } = req.body;
  if (!name || !url) {
    res.status(400).json({ error: 'name and url are required' });
    return;
  }

  const sql = 'INSERT INTO apps (name, icon, url, description, category) VALUES (?, ?, ?, ?, ?)';
  db.run(sql, [name, icon || '', url, description || '', category || 'general'], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.get('SELECT * FROM apps WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) {
        res.status(500).json({ error: err2.message });
        return;
      }
      res.status(201).json({ app: row });
    });
  });
});

// Update app
router.put('/:id', (req: Request, res: Response) => {
  const { name, icon, url, description, category } = req.body;
  const sql = `UPDATE apps SET name = COALESCE(?, name), icon = COALESCE(?, icon),
    url = COALESCE(?, url), description = COALESCE(?, description),
    category = COALESCE(?, category), updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

  db.run(sql, [name, icon, url, description, category, req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    db.get('SELECT * FROM apps WHERE id = ?', [req.params.id], (err2, row) => {
      if (err2) {
        res.status(500).json({ error: err2.message });
        return;
      }
      res.json({ app: row });
    });
  });
});

// Delete app
router.delete('/:id', (req: Request, res: Response) => {
  db.run('DELETE FROM apps WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    res.json({ success: true });
  });
});

export default router;
