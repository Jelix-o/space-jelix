import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Client } from 'ssh2';
import db from './database';

interface TermSession {
  ws: WebSocket;
  ssh: Client;
  stream: any;
}

const sessions = new Map<WebSocket, TermSession>();

function dbGet(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

export function setupTerminalWs(httpServer: http.Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/terminal' });

  wss.on('connection', (ws) => {
    let session: TermSession | null = null;

    ws.on('message', async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // Auth message: connect to SSH
      if (msg.type === 'connect') {
        try {
          const conn: any = await dbGet('SELECT * FROM terminal_connections WHERE id = ?', [msg.connectionId]);
          if (!conn) {
            ws.send(JSON.stringify({ type: 'error', data: 'Connection not found' }));
            ws.close();
            return;
          }

          const ssh = new Client();
          session = { ws, ssh, stream: null };

          ssh.on('ready', () => {
            ssh.shell(
              { term: 'xterm-256color', cols: msg.cols || 80, rows: msg.rows || 24 },
              (err, stream) => {
                if (err) {
                  ws.send(JSON.stringify({ type: 'error', data: err.message }));
                  ws.close();
                  return;
                }

                session!.stream = stream;
                sessions.set(ws, session!);

                ws.send(JSON.stringify({ type: 'connected' }));

                stream.on('data', (data: Buffer) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'output', data: data.toString('utf-8') }));
                  }
                });

                stream.stderr.on('data', (data: Buffer) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'output', data: data.toString('utf-8') }));
                  }
                });

                stream.on('close', () => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'closed' }));
                    ws.close();
                  }
                });
              },
            );
          });

          ssh.on('error', (err) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', data: err.message }));
              ws.close();
            }
          });

          const connectConfig: any = {
            host: conn.host,
            port: Number(conn.port || 22),
            username: conn.username,
            readyTimeout: 10000,
            keepaliveInterval: 10000,
          };

          if (conn.auth_type === 'key' && conn.key_path) {
            const fs = await import('fs');
            try {
              connectConfig.privateKey = fs.readFileSync(conn.key_path);
              if (msg.passphrase) connectConfig.passphrase = msg.passphrase;
            } catch (readErr: any) {
              ws.send(JSON.stringify({ type: 'error', data: `Failed to read key file: ${readErr.message}` }));
              ws.close();
              return;
            }
          } else {
            connectConfig.password = conn.password;
          }

          ssh.connect(connectConfig);
        } catch (err: any) {
          ws.send(JSON.stringify({ type: 'error', data: err.message }));
          ws.close();
        }
        return;
      }

      // Input from terminal
      if (msg.type === 'input' && session?.stream) {
        session.stream.write(msg.data);
        return;
      }

      // Resize
      if (msg.type === 'resize' && session?.stream) {
        session.stream.setWindow(msg.rows, msg.cols, msg.height || 0, msg.width || 0);
        return;
      }
    });

    ws.on('close', () => {
      if (session) {
        session.stream?.close();
        session.ssh.end();
        sessions.delete(ws);
      }
    });
  });
}
