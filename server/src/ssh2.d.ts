declare module 'ssh2' {
  import { EventEmitter } from 'events';

  interface ConnectConfig {
    host: string;
    port?: number;
    username?: string;
    password?: string;
    privateKey?: Buffer | string;
    passphrase?: string;
    readyTimeout?: number;
    keepaliveInterval?: number;
  }

  interface ShellOptions {
    term?: string;
    cols?: number;
    rows?: number;
  }

  class Client extends EventEmitter {
    connect(config: ConnectConfig): this;
    shell(options: ShellOptions, callback: (err: Error | undefined, stream: Channel) => void): void;
    end(): void;
  }

  class Channel extends EventEmitter {
    write(data: string | Buffer): boolean;
    setWindow(rows: number, cols: number, height: number, width: number): void;
    close(): void;
    stderr: EventEmitter;
  }
}
