export class Redis {
  on(): this {
    return this;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<string> {
    return 'OK';
  }

  async disconnect(): Promise<void> {}

  duplicate(): Redis {
    return new Redis();
  }

  async get(): Promise<null> {
    return null;
  }

  async set(): Promise<string> {
    return 'OK';
  }

  async del(): Promise<number> {
    return 0;
  }

  async exists(): Promise<number> {
    return 0;
  }

  async incr(): Promise<number> {
    return 1;
  }

  async expire(): Promise<number> {
    return 1;
  }

  async sadd(): Promise<number> {
    return 0;
  }

  async smembers(): Promise<string[]> {
    return [];
  }

  async srem(): Promise<number> {
    return 0;
  }

  async getdel(): Promise<null> {
    return null;
  }

  async publish(): Promise<number> {
    return 0;
  }

  async subscribe(): Promise<number> {
    return 0;
  }
}

export default Redis;
