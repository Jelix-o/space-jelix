import { Router, Request, Response } from 'express';
import db from '../database';

const router = Router();

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

// GET /api/chat/models - List all enabled models from database
router.get('/models', async (req: Request, res: Response) => {
  try {
    const rows = await dbAll(
      `SELECT m.id, m.model_id, m.name, m.enabled,
              p.id as provider_id, p.name as provider_name, p.base_url, p.type as provider_type
       FROM models m
       JOIN providers p ON m.provider_id = p.id
       WHERE m.enabled = 1 AND p.enabled = 1
       ORDER BY p.id ASC, m.id ASC`
    );

    const models = rows.map((r) => ({
      id: r.model_id,
      name: r.name,
      provider: r.provider_name,
      provider_id: r.provider_id,
      provider_type: r.provider_type,
    }));

    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get conversations with pagination (pinned first, then by updated_at DESC)
router.get('/conversations', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  db.all('SELECT * FROM conversations ORDER BY pinned DESC, updated_at DESC LIMIT ? OFFSET ?', [limit, offset], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.get('SELECT COUNT(*) as total FROM conversations', [], (err2, countRow: any) => {
      if (err2) {
        res.status(500).json({ error: err2.message });
        return;
      }
      res.json({ conversations: rows, total: countRow?.total ?? 0 });
    });
  });
});

// Create conversation
router.post('/conversations', (req: Request, res: Response) => {
  const { title, model } = req.body;
  db.run(
    'INSERT INTO conversations (title, model) VALUES (?, ?)',
    [title || '新对话', model || 'mimo-v2.5-pro'],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.get('SELECT * FROM conversations WHERE id = ?', [this.lastID], (err2, row) => {
        if (err2) {
          res.status(500).json({ error: err2.message });
          return;
        }
        res.status(201).json({ conversation: row });
      });
    }
  );
});

// Get messages for a conversation
router.get('/conversations/:id/messages', (req: Request, res: Response) => {
  db.all(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ messages: rows });
    }
  );
});

// Send message and get AI response
router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  const { content, model } = req.body;
  const conversationId = req.params.id;

  if (!content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  try {
    // Save user message
    await dbRun(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
      [conversationId, 'user', content]
    );

    // Get conversation history
    const messages: any[] = await dbAll(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );

    const conversation: any = await dbGet('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    const selectedModel = model || conversation?.model || 'mimo-v2.5-pro';

    // Build OpenAI-compatible messages
    const apiMessages: { role: string; content: string }[] = [];
    if (conversation?.system_prompt) {
      apiMessages.push({ role: 'system', content: conversation.system_prompt });
    }
    apiMessages.push(...messages.map((m: any) => ({ role: m.role, content: m.content })));

    // Try to get AI response from configured providers
    let assistantContent = '';
    try {
      assistantContent = await callAI(selectedModel, apiMessages);
    } catch (aiError: any) {
      assistantContent = `[AI Error: ${aiError.message}. Model: ${selectedModel}]`;
    }

    // Save assistant message
    await dbRun(
      'INSERT INTO messages (conversation_id, role, content, model) VALUES (?, ?, ?, ?)',
      [conversationId, 'assistant', assistantContent, selectedModel]
    );

    // Update conversation timestamp
    db.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);

    res.json({
      role: 'assistant',
      content: assistantContent,
      model: selectedModel,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update conversation (title, model, pinned, system_prompt)
router.put('/conversations/:id', async (req: Request, res: Response) => {
  const { title, model, pinned, system_prompt } = req.body;
  const fields: string[] = [];
  const params: any[] = [];

  if (title !== undefined) { fields.push('title = ?'); params.push(title); }
  if (model !== undefined) { fields.push('model = ?'); params.push(model); }
  if (pinned !== undefined) { fields.push('pinned = ?'); params.push(pinned ? 1 : 0); }
  if (system_prompt !== undefined) { fields.push('system_prompt = ?'); params.push(system_prompt); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.params.id);

  try {
    await dbRun(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`, params);
    const row = await dbGet('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
    res.json({ conversation: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all messages in a conversation
router.delete('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM messages WHERE conversation_id = ?', [req.params.id]);
    await dbRun('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate conversation name from first few messages
router.post('/conversations/:id/generate-name', async (req: Request, res: Response) => {
  try {
    const messages: any[] = await dbAll(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 6',
      [req.params.id]
    );

    if (messages.length === 0) {
      res.status(400).json({ error: 'No messages to generate name from' });
      return;
    }

    const conversation: any = await dbGet('SELECT model FROM conversations WHERE id = ?', [req.params.id]);
    const model = req.body?.model || conversation?.model || 'mimo-v2.5-pro';

    const summaryPrompt = [
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: '请用不超过20个字概括这段对话的主题，只输出标题，不要任何标点符号或解释。' },
    ];

    let name = '';
    try {
      name = await callAI(model, summaryPrompt);
    } catch {
      name = messages[0].content.slice(0, 20);
    }

    name = name.replace(/["""「」【】\[\]《》<>]/g, '').trim().slice(0, 24);

    await dbRun('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, req.params.id]);
    res.json({ title: name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Branch: create a new conversation with the same messages
router.post('/conversations/:id/branch', async (req: Request, res: Response) => {
  try {
    const sourceId = req.params.id;
    const source: any = await dbGet('SELECT * FROM conversations WHERE id = ?', [sourceId]);
    if (!source) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const { lastID } = await dbRun(
      'INSERT INTO conversations (title, model, system_prompt) VALUES (?, ?, ?)',
      [source.title + ' (分支)', source.model, source.system_prompt || '']
    );

    const messages: any[] = await dbAll(
      'SELECT role, content, model FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [sourceId]
    );

    for (const msg of messages) {
      await dbRun(
        'INSERT INTO messages (conversation_id, role, content, model) VALUES (?, ?, ?, ?)',
        [lastID, msg.role, msg.content, msg.model]
      );
    }

    const newConv = await dbGet('SELECT * FROM conversations WHERE id = ?', [lastID]);
    res.status(201).json({ conversation: newConv });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete conversation
router.delete('/conversations/:id', (req: Request, res: Response) => {
  db.run('DELETE FROM conversations WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// AI calling function - looks up provider from database
async function callAI(model: string, messages: { role: string; content: string }[]): Promise<string> {
  // Find the provider for this model in the database
  const row: any = await dbGet(
    `SELECT p.base_url, p.api_key, p.type
     FROM models m
     JOIN providers p ON m.provider_id = p.id
     WHERE m.model_id = ? AND m.enabled = 1 AND p.enabled = 1`,
    [model]
  );

  // Fall back to env-based routing if no DB config found
  if (!row) {
    return callAIFromEnv(model, messages);
  }

  const { base_url, api_key, type } = row;

  if (!api_key && type !== 'openai') {
    throw new Error(`No API key configured for model ${model}. Update the provider in Settings.`);
  }

  if (type === 'anthropic') {
    return callAnthropicWithConfig(base_url, api_key, model, messages);
  }

  // Default: OpenAI-compatible
  const response = await fetch(`${base_url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${api_key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || 'No response';
}

// Fallback: env-based provider routing (legacy)
async function callAIFromEnv(model: string, messages: { role: string; content: string }[]): Promise<string> {
  let apiKey = '';
  let baseUrl = '';

  if (model.startsWith('mimo')) {
    apiKey = process.env.MIMO_API_KEY || 'not-needed';
    baseUrl = process.env.MIMO_API_URL || 'http://127.0.0.1:8317/v1';
  } else if (model.startsWith('hermes') || model.startsWith('nous')) {
    apiKey = process.env.NOUS_API_KEY || process.env.OPENAI_API_KEY || '';
    baseUrl = process.env.NOUS_API_URL || 'https://api.nousresearch.com/v1';
  } else if (model.startsWith('gpt')) {
    apiKey = process.env.OPENAI_API_KEY || '';
    baseUrl = 'https://api.openai.com/v1';
  } else if (model.startsWith('claude')) {
    return callAnthropicWithConfig(
      'https://api.anthropic.com',
      process.env.ANTHROPIC_API_KEY || '',
      model,
      messages
    );
  } else if (model.startsWith('deepseek')) {
    apiKey = process.env.DEEPSEEK_API_KEY || '';
    baseUrl = 'https://api.deepseek.com/v1';
  } else if (model.startsWith('qwen')) {
    apiKey = process.env.DASHSCOPE_API_KEY || '';
    baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  } else {
    apiKey = process.env.OPENAI_API_KEY || '';
    baseUrl = 'https://api.openai.com/v1';
  }

  if (!apiKey) {
    throw new Error(`No API key configured for model ${model}. Set the appropriate environment variable or add a provider.`);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || 'No response';
}

async function callAnthropicWithConfig(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  if (!apiKey) {
    throw new Error('No API key configured for Anthropic provider');
  }

  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemMsg?.content || undefined,
      messages: nonSystemMessages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();
  return data.content?.[0]?.text || 'No response';
}

export default router;
