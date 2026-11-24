import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet, type KeyLike } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAuth0Authenticator } from '../../src/auth.js';

const cfg = {
  issuer: 'https://tenant.example/',
  audience: 'onboarding-api',
  rolesClaim: 'https://onboarding.example/roles',
  hrAdminRole: 'hr_admin',
};

let privateKey: KeyLike;
let authenticate: ReturnType<typeof createAuth0Authenticator>;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), alg: 'RS256', kid: 'k1' };
  authenticate = createAuth0Authenticator(cfg, createLocalJWKSet({ keys: [jwk] }));
});

function token(opts: { roles?: string[]; issuer?: string; audience?: string; exp?: string } = {}) {
  return new SignJWT({ [cfg.rolesClaim]: opts.roles ?? [] })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject('auth0|u1')
    .setIssuer(opts.issuer ?? cfg.issuer)
    .setAudience(opts.audience ?? cfg.audience)
    .setExpirationTime(opts.exp ?? '5m')
    .sign(privateKey);
}

describe('createAuth0Authenticator', () => {
  it('flags HR admins', async () => {
    const t = await token({ roles: ['hr_admin'] });
    expect(await authenticate(`Bearer ${t}`)).toEqual({ sub: 'auth0|u1', isHrAdmin: true });
  });

  it('does not flag other users', async () => {
    const t = await token({ roles: ['employee'] });
    expect(await authenticate(`Bearer ${t}`)).toEqual({ sub: 'auth0|u1', isHrAdmin: false });
  });

  it.each([
    ['wrong issuer', () => token({ issuer: 'https://evil.example/' })],
    ['wrong audience', () => token({ audience: 'other' })],
    ['expired', () => token({ exp: '-1m' })],
  ])('rejects a token with %s', async (_n, make) => {
    expect(await authenticate(`Bearer ${await make()}`)).toBeNull();
  });

  it('rejects a missing or malformed header', async () => {
    expect(await authenticate(undefined)).toBeNull();
    expect(await authenticate('Bearer nonsense')).toBeNull();
  });
});
