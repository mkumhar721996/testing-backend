export interface Config {
  host: string;
  port: number;
  databaseUrl: string;
  auth0Issuer: string;
  auth0Audience: string;
  rolesClaim: string;
  hrAdminRole: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/app',
    // No safe default: an unset issuer/audience makes the authenticator reject every token.
    auth0Issuer: env.AUTH0_ISSUER ?? '',
    auth0Audience: env.AUTH0_AUDIENCE ?? '',
    // Placeholder namespace until the real Auth0 roles claim is confirmed.
    rolesClaim: env.AUTH0_ROLES_CLAIM ?? 'https://onboarding.example/roles',
    hrAdminRole: env.AUTH0_HR_ADMIN_ROLE ?? 'hr_admin',
  };
}
