import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type Principal = { sub: string; isHrAdmin: boolean };
export type Authenticator = (authorizationHeader: string | undefined) => Promise<Principal | null>;

export interface Auth0Config {
  issuer: string;
  audience: string;
  rolesClaim: string;
  hrAdminRole: string;
}

/** Accepts only tokens issued by Auth0 for this API (ADR-0003). `keys` is injectable for tests. */
export function createAuth0Authenticator(cfg: Auth0Config, keys?: JWTVerifyGetKey): Authenticator {
  let remote: JWTVerifyGetKey | undefined;
  return async (header) => {
    const match = /^Bearer (.+)$/.exec(header ?? '');
    if (!match || !cfg.issuer || !cfg.audience) return null;
    try {
      // Built lazily so an unconfigured issuer rejects tokens instead of crashing at startup.
      const jwks = keys ?? (remote ??= createRemoteJWKSet(new URL('.well-known/jwks.json', cfg.issuer)));
      const { payload } = await jwtVerify(match[1], jwks, { issuer: cfg.issuer, audience: cfg.audience });
      if (!payload.sub) return null;
      const roles = payload[cfg.rolesClaim];
      return { sub: payload.sub, isHrAdmin: Array.isArray(roles) && roles.includes(cfg.hrAdminRole) };
    } catch {
      return null;
    }
  };
}
