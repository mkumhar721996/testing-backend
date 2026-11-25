import { PgApplicationsRepository } from './applications/pgRepository.js';
import { buildApp } from './app.js';
import { createAuth0Authenticator } from './auth.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { PgOpeningsRepository } from './openings/pgRepository.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const app = buildApp({
  webOrigin: config.webOrigin,
  repository: new PgOpeningsRepository(pool),
  applications: new PgApplicationsRepository(pool),
  authenticate: createAuth0Authenticator({
    issuer: config.auth0Issuer,
    audience: config.auth0Audience,
    rolesClaim: config.rolesClaim,
    hrAdminRole: config.hrAdminRole,
  }),
});

app.listen({ host: config.host, port: config.port }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
