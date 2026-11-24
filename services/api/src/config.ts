export interface Config {
  host: string;
  port: number;
  databaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/app',
  };
}
