import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import db from '../database';

const router = Router();

const imagesDir = path.join(__dirname, '..', '..', 'uploads', 'images');
fs.mkdirSync(imagesDir, { recursive: true });

function dbAll(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function dbGet(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function normalizeBaseUrl(baseUrl: string): string {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function joinEndpoint(baseUrl: string, ep: string): string {
  return `${normalizeBaseUrl(baseUrl)}${ep.startsWith('/') ? ep : `/${ep}`}`;
}

// POST /api/images/generate - Generate an image
router.post('/generate', async (req: Request, res: Response) => {
  const { model, prompt, size } = req.body;

  if (!model || !prompt) {
    res.status(400).json({ error: 'model and prompt are required' });
    return;
  }

  try {
    // Find provider for this model
    const row: any = await dbGet(
      `SELECT p.base_url, p.api_key, p.id as provider_id, p.type
       FROM models m JOIN providers p ON m.provider_id = p.id
       WHERE m.model_id = ? AND m.enabled = 1 AND p.enabled = 1 AND m.is_image_model = 1`,
      [model],
    );

    if (!row) {
      res.status(400).json({ error: `No image provider found for model ${model}` });
      return;
    }

    const { base_url, api_key, provider_id, type } = row;

    // Try /v1/images/generations first, fallback to /images/generations
    let imageUrl = joinEndpoint(base_url, '/v1/images/generations');
    if (normalizeBaseUrl(base_url).endsWith('/v1')) {
      imageUrl = joinEndpoint(base_url, '/images/generations');
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (api_key) {
      if (type === 'anthropic') headers['x-api-key'] = api_key;
      else headers['Authorization'] = `Bearer ${api_key}`;
    }

    const body = JSON.stringify({
      model,
      prompt,
      size: size || '1024x1024',
      response_format: 'b64_json',
    });

    let response = await fetch(imageUrl, { method: 'POST', headers, body });

    // Fallback: try without /v1
    if (response.status === 404 && !normalizeBaseUrl(base_url).endsWith('/v1')) {
      imageUrl = joinEndpoint(base_url, '/images/generations');
      response = await fetch(imageUrl, { method: 'POST', headers, body });
    }

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: `Image API error: ${errText}` });
      return;
    }

    const data: any = await response.json();
    const imageData = data.data?.[0];

    if (!imageData) {
      res.status(500).json({ error: 'No image data in response' });
      return;
    }

    // Save image
    const filename = `${Date.now()}-${crypto.randomUUID()}.png`;
    const filePath = path.join(imagesDir, filename);

    if (imageData.b64_json) {
      fs.writeFileSync(filePath, Buffer.from(imageData.b64_json, 'base64'));
    } else if (imageData.url) {
      const imgRes = await fetch(imageData.url);
      const arrayBuf = await imgRes.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuf));
    } else {
      res.status(500).json({ error: 'Response had neither b64_json nor url' });
      return;
    }

    // Save to database
    const { lastID } = await dbRun(
      'INSERT INTO generated_images (model, prompt, size, file_path, provider_id) VALUES (?, ?, ?, ?, ?)',
      [model, prompt, size || '1024x1024', filename, provider_id],
    );

    res.json({
      id: lastID,
      url: `/api/images/file/${filename}`,
      model,
      prompt,
      size: size || '1024x1024',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/images - List generated images
router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await dbAll('SELECT * FROM generated_images ORDER BY created_at DESC LIMIT 100');
    const images = rows.map((r) => ({
      ...r,
      url: `/api/images/file/${r.file_path}`,
    }));
    res.json({ images });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/images/file/:filename - Serve generated image
router.get('/file/:filename', (req: Request, res: Response) => {
  const filePath = path.join(imagesDir, String(req.params.filename));
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  res.sendFile(filePath);
});

export default router;
