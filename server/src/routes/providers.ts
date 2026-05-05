import { Router, Request, Response } from 'express';
import db from '../database';

const router = Router();
const MASKED_API_KEY = '********';

// Helper: promisify db calls
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

function joinEndpoint(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

function isMaskedApiKey(value: unknown): boolean {
  return typeof value === 'string' && /^\*+$/.test(value.trim());
}

function normalizeApiKeyForStorage(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeProvider(provider: any, models: any[] = []) {
  return {
    ...provider,
    api_key: provider.api_key ? MASKED_API_KEY : '',
    has_api_key: Boolean(provider.api_key),
    models,
  };
}

function authHeaders(apiKey: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

// GET /api/providers - List all providers with their models
router.get('/', async (req: Request, res: Response) => {
  try {
    const providers = await dbAll('SELECT * FROM providers ORDER BY id ASC');
    const models = await dbAll('SELECT * FROM models ORDER BY id ASC');

    const result = providers.map((p) => sanitizeProvider(p, models.filter((m) => m.provider_id === p.id)));

    res.json({ providers: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/providers - Create a provider
router.post('/', async (req: Request, res: Response) => {
  const { name, base_url, api_key, type, models } = req.body;

  if (!name || !base_url) {
    res.status(400).json({ error: 'name and base_url are required' });
    return;
  }

  try {
    const { lastID } = await dbRun(
      'INSERT INTO providers (name, base_url, api_key, type) VALUES (?, ?, ?, ?)',
      [name, normalizeBaseUrl(base_url), normalizeApiKeyForStorage(api_key), type || 'openai']
    );

    // Insert models if provided
    if (Array.isArray(models) && models.length > 0) {
      for (const m of models) {
        await dbRun(
          'INSERT INTO models (provider_id, model_id, name, is_image_model) VALUES (?, ?, ?, ?)',
          [lastID, m.model_id, m.name, m.is_image_model ? 1 : 0]
        );
      }
    }

    const provider = await dbGet('SELECT * FROM providers WHERE id = ?', [lastID]);
    const providerModels = await dbAll('SELECT * FROM models WHERE provider_id = ?', [lastID]);
    res.status(201).json({ provider: sanitizeProvider(provider, providerModels) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/providers/:id - Update a provider
router.put('/:id', async (req: Request, res: Response) => {
  const { name, base_url, api_key, type, enabled, models } = req.body;
  const { id } = req.params;

  try {
    const existing = await dbGet('SELECT * FROM providers WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }

    const hasApiKeyField = Object.prototype.hasOwnProperty.call(req.body, 'api_key');
    const nextApiKey =
      hasApiKeyField && !isMaskedApiKey(api_key) ? normalizeApiKeyForStorage(api_key) : null;

    await dbRun(
      `UPDATE providers SET
        name = COALESCE(?, name),
        base_url = COALESCE(?, base_url),
        api_key = COALESCE(?, api_key),
        type = COALESCE(?, type),
        enabled = COALESCE(?, enabled),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        name,
        base_url !== undefined ? normalizeBaseUrl(base_url) : null,
        nextApiKey,
        type,
        enabled !== undefined ? (enabled ? 1 : 0) : null,
        id,
      ]
    );

    if (Array.isArray(models)) {
      await dbRun('DELETE FROM models WHERE provider_id = ?', [id]);
      for (const m of models) {
        if (!m.model_id) continue;
        await dbRun(
          'INSERT INTO models (provider_id, model_id, name, enabled, is_image_model) VALUES (?, ?, ?, ?, ?)',
          [id, m.model_id, m.name || m.model_id, m.enabled === false || m.enabled === 0 ? 0 : 1, m.is_image_model ? 1 : 0]
        );
      }
    }

    const provider = await dbGet('SELECT * FROM providers WHERE id = ?', [id]);
    const providerModels = await dbAll('SELECT * FROM models WHERE provider_id = ?', [id]);
    res.json({ provider: sanitizeProvider(provider, providerModels) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/providers/:id - Delete a provider
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await dbGet('SELECT * FROM providers WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }
    await dbRun('DELETE FROM providers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/providers/:id/test - Test provider connection
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const provider = await dbGet('SELECT * FROM providers WHERE id = ?', [req.params.id]);
    if (!provider) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }

    const model = await dbGet(
      'SELECT model_id FROM models WHERE provider_id = ? AND enabled = 1 ORDER BY id ASC LIMIT 1',
      [req.params.id]
    );

    if (!model?.model_id) {
      res.json({ success: false, message: 'No enabled model configured for this provider' });
      return;
    }

    const startTime = Date.now();

    if (provider.type === 'anthropic') {
      const baseUrl = normalizeBaseUrl(provider.base_url);
      const testRes = await fetch(baseUrl.endsWith('/v1') ? joinEndpoint(baseUrl, '/messages') : joinEndpoint(baseUrl, '/v1/messages'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.api_key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model.model_id,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      const latency = Date.now() - startTime;
      if (testRes.ok) {
        res.json({ success: true, message: 'Connection successful', latency });
      } else {
        const errText = await testRes.text();
        res.json({ success: false, message: `Error ${testRes.status}: ${errText}`, latency });
      }
    } else {
      const testRes = await fetch(joinEndpoint(provider.base_url, '/chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(provider.api_key),
        },
        body: JSON.stringify({
          model: model.model_id,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
          temperature: 0,
        }),
      });
      const latency = Date.now() - startTime;
      if (testRes.ok) {
        res.json({ success: true, message: 'Connection successful', latency });
      } else {
        const errText = await testRes.text();
        res.json({ success: false, message: `Error ${testRes.status}: ${errText}`, latency });
      }
    }
  } catch (err: any) {
    res.json({ success: false, message: `Connection failed: ${err.message}` });
  }
});

// GET /api/providers/:id/models - Get models for a provider
router.get('/:id/models', async (req: Request, res: Response) => {
  try {
    const provider = await dbGet('SELECT * FROM providers WHERE id = ?', [req.params.id]);
    if (!provider) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }
    const models = await dbAll('SELECT * FROM models WHERE provider_id = ?', [req.params.id]);
    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/providers/:id/models - Add a model to a provider
router.post('/:id/models', async (req: Request, res: Response) => {
  const { model_id, name } = req.body;
  if (!model_id || !name) {
    res.status(400).json({ error: 'model_id and name are required' });
    return;
  }

  try {
    const provider = await dbGet('SELECT * FROM providers WHERE id = ?', [req.params.id]);
    if (!provider) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }

    const { lastID } = await dbRun(
      'INSERT INTO models (provider_id, model_id, name) VALUES (?, ?, ?)',
      [req.params.id, model_id, name]
    );
    const model = await dbGet('SELECT * FROM models WHERE id = ?', [lastID]);
    res.status(201).json({ model });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/providers/:id/fetch-models - Fetch available models from provider API
router.post('/:id/fetch-models', async (req: Request, res: Response) => {
  try {
    const provider = await dbGet('SELECT * FROM providers WHERE id = ?', [req.params.id]);
    if (!provider) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }

    const baseUrl = normalizeBaseUrl(provider.base_url);
    const modelsUrl = baseUrl.endsWith('/v1') ? joinEndpoint(baseUrl, '/models') : joinEndpoint(baseUrl, '/v1/models');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.api_key) {
      if (provider.type === 'anthropic') {
        headers['x-api-key'] = provider.api_key;
      } else {
        headers['Authorization'] = `Bearer ${provider.api_key}`;
      }
    }

    const response = await fetch(modelsUrl, { headers });
    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: `Failed to fetch models: ${errText}` });
      return;
    }

    const data: any = await response.json();
    const models = (data.data || data.models || []).map((m: any) => ({
      model_id: m.id || m.model,
      name: m.name || m.id || m.model,
    }));

    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: `Fetch failed: ${err.message}` });
  }
});

// DELETE /api/providers/:id/models/:modelId - Remove a model
router.delete('/:id/models/:modelId', async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM models WHERE id = ? AND provider_id = ?', [
      req.params.modelId,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Seed default providers if none exist (called on startup)
export async function seedDefaultProviders(): Promise<void> {
  const count: any = await dbGet('SELECT COUNT(*) as cnt FROM providers');
  if (count && count.cnt > 0) return;

  const defaults = [
    {
      name: 'Xiaomi (MiMo)',
      base_url: 'http://127.0.0.1:8317/v1',
      api_key: 'not-needed',
      type: 'openai',
      models: [{ model_id: 'mimo-v2.5-pro', name: 'MiMo V2.5 Pro' }],
    },
    {
      name: 'Nous Research',
      base_url: 'https://api.nousresearch.com/v1',
      api_key: '',
      type: 'openai',
      models: [
        { model_id: 'hermes-3-llama-3.1-405b', name: 'Hermes 3 405B' },
        { model_id: 'hermes-3-llama-3.1-70b', name: 'Hermes 3 70B' },
      ],
    },
    {
      name: 'OpenAI',
      base_url: 'https://api.openai.com/v1',
      api_key: '',
      type: 'openai',
      models: [
        { model_id: 'gpt-4o', name: 'GPT-4o' },
        { model_id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      ],
    },
    {
      name: 'Anthropic',
      base_url: 'https://api.anthropic.com',
      api_key: '',
      type: 'anthropic',
      models: [
        { model_id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
        { model_id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      ],
    },
    {
      name: 'DeepSeek',
      base_url: 'https://api.deepseek.com/v1',
      api_key: '',
      type: 'openai',
      models: [{ model_id: 'deepseek-chat', name: 'DeepSeek V3' }],
    },
    {
      name: 'Alibaba (Qwen)',
      base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      api_key: '',
      type: 'openai',
      models: [{ model_id: 'qwen-plus', name: 'Qwen Plus' }],
    },
  ];

  for (const p of defaults) {
    const { lastID } = await dbRun(
      'INSERT INTO providers (name, base_url, api_key, type) VALUES (?, ?, ?, ?)',
      [p.name, p.base_url, p.api_key, p.type]
    );
    for (const m of p.models) {
      await dbRun('INSERT INTO models (provider_id, model_id, name) VALUES (?, ?, ?)', [
        lastID,
        m.model_id,
        m.name,
      ]);
    }
  }
  console.log('Seeded default providers');
}

export default router;
