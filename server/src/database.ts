import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'hermes-hub.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

type SqlCallback<T = unknown> = (err: Error | null, result: T) => void;
type RunCallback = (this: { lastID: number; changes: number }, err: Error | null) => void;

class SqliteCompatDatabase {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    console.log('Connected to SQLite database at', filename);
  }

  serialize(fn: () => void): void {
    fn();
  }

  private bind(params: unknown[]): SQLInputValue[] {
    return params.map((param) => (param === undefined ? null : param)) as SQLInputValue[];
  }

  run(sql: string, paramsOrCallback?: unknown[] | RunCallback, callback?: RunCallback): void {
    const params = Array.isArray(paramsOrCallback) ? paramsOrCallback : [];
    const cb = typeof paramsOrCallback === 'function' ? paramsOrCallback : callback;

    try {
      const result = this.db.prepare(sql).run(...this.bind(params));
      cb?.call(
        {
          lastID: Number(result.lastInsertRowid ?? 0),
          changes: Number(result.changes ?? 0),
        },
        null
      );
    } catch (err) {
      cb?.call({ lastID: 0, changes: 0 }, err as Error);
    }
  }

  get<T = unknown>(sql: string, params: unknown[] = [], callback: SqlCallback<T>): void {
    try {
      callback(null, this.db.prepare(sql).get(...this.bind(params)) as T);
    } catch (err) {
      callback(err as Error, undefined as T);
    }
  }

  all<T = unknown>(sql: string, params: unknown[] = [], callback: SqlCallback<T[]>): void {
    try {
      callback(null, this.db.prepare(sql).all(...this.bind(params)) as T[]);
    } catch (err) {
      callback(err as Error, undefined as unknown as T[]);
    }
  }
}

const db = new SqliteCompatDatabase(DB_PATH);

db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA foreign_keys=ON');

export function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Apps table
      db.run(`
        CREATE TABLE IF NOT EXISTS apps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          icon TEXT DEFAULT '',
          url TEXT NOT NULL,
          description TEXT DEFAULT '',
          category TEXT DEFAULT 'general',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Chat conversations table
      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT DEFAULT '新对话',
          model TEXT DEFAULT 'mimo-v2.5-pro',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Migrate: add pinned and system_prompt columns if missing
      try { db.run('ALTER TABLE conversations ADD COLUMN pinned INTEGER DEFAULT 0') } catch {}
      try { db.run('ALTER TABLE conversations ADD COLUMN system_prompt TEXT DEFAULT \'\'') } catch {}

      // Chat messages table
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          model TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
      `);

      // Hermes connections table
      db.run(`
        CREATE TABLE IF NOT EXISTS hermes_connections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('hermes', 'openclaw')),
          endpoint TEXT NOT NULL,
          api_key TEXT DEFAULT '',
          status TEXT DEFAULT 'disconnected',
          config TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Server terminal connections table
      db.run(`
        CREATE TABLE IF NOT EXISTS terminal_connections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          host TEXT NOT NULL,
          port INTEGER DEFAULT 22,
          username TEXT NOT NULL,
          auth_type TEXT DEFAULT 'password' CHECK(auth_type IN ('password', 'key')),
          password TEXT DEFAULT '',
          key_path TEXT DEFAULT '',
          default_path TEXT DEFAULT '',
          status TEXT DEFAULT 'disconnected',
          last_error TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Providers table
      db.run(`
        CREATE TABLE IF NOT EXISTS providers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          base_url TEXT NOT NULL,
          api_key TEXT DEFAULT '',
          type TEXT DEFAULT 'openai',
          enabled INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Models table
      db.run(`
        CREATE TABLE IF NOT EXISTS models (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_id INTEGER NOT NULL,
          model_id TEXT NOT NULL,
          name TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
        )
      `);

      // Migrate: add is_image_model to models table
      try { db.run('ALTER TABLE models ADD COLUMN is_image_model INTEGER DEFAULT 0') } catch {}

      // Auto-detect common image models
      try {
        db.run(`UPDATE models SET is_image_model = 1 WHERE is_image_model = 0 AND (
          model_id LIKE '%dall-e%' OR model_id LIKE '%gpt-image%' OR
          model_id LIKE '%flux%' OR model_id LIKE '%stable-diffusion%' OR
          model_id LIKE '%sdxl%' OR model_id LIKE '%midjourney%' OR
          model_id LIKE '%imagen%'
        )`)
      } catch {}

      // Generated images table
      db.run(`
        CREATE TABLE IF NOT EXISTS generated_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          model TEXT NOT NULL,
          prompt TEXT NOT NULL,
          size TEXT DEFAULT '1024x1024',
          file_path TEXT NOT NULL,
          provider_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL
        )
      `);

      db.run('SELECT 1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

export default db;
