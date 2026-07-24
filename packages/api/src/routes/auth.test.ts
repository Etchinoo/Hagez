import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';
import authRoutes from './auth.js';

// Build a Fastify app with @fastify/jwt + a fake db decorated, then register the
// real auth routes. Drives branches by programming the fake Prisma client.
async function buildApp(db: Record<string, unknown>): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(jwt, { secret: process.env.JWT_ACCESS_SECRET as string });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', db as any);
  app.decorate('authenticate', async (req: { jwtVerify: () => Promise<unknown> }, reply: { code: (n: number) => { send: (b: unknown) => void } }) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: { code: 'UNAUTHORIZED' } });
    }
  });
  await app.register(authRoutes);
  await app.ready();
  return app;
}

describe('POST /auth/otp/verify', () => {
  it('401 INVALID_OTP when no matching OTP record is found', async () => {
    const db = { otpRequest: { findFirst: vi.fn().mockResolvedValue(null) } };
    const app = await buildApp(db);
    const res = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { phone: '+201000000000', otp: '123456' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_OTP');
    await app.close();
  });

  it('401 when the OTP code is wrong (record found, bcrypt mismatch)', async () => {
    const otp_hash = await bcrypt.hash('654321', 4);
    const db = { otpRequest: { findFirst: vi.fn().mockResolvedValue({ id: 'o1', otp_hash }) } };
    const app = await buildApp(db);
    const res = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { phone: '+201000000000', otp: '123456' } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('200 + access & refresh tokens on a valid OTP, creating a new user and marking the OTP used', async () => {
    const otp_hash = await bcrypt.hash('123456', 4);
    const db = {
      otpRequest: { findFirst: vi.fn().mockResolvedValue({ id: 'o1', otp_hash }), update: vi.fn() },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'u1', phone: '+201000000000', full_name: '+201000000000', language_pref: 'ar' }),
      },
    };
    const app = await buildApp(db);
    const res = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { phone: '+201000000000', otp: '123456' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.access_token).toBeTruthy();
    expect(body.refresh_token).toBeTruthy();
    expect(db.otpRequest.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { used: true } });
    expect(db.user.create).toHaveBeenCalled();
    await app.close();
  });
});

describe('POST /auth/otp/request', () => {
  it('invalidates prior OTPs BEFORE creating a new one and returns a generic message (no enumeration)', async () => {
    const db = { otpRequest: { updateMany: vi.fn(), create: vi.fn() } };
    const app = await buildApp(db);
    const res = await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { phone: '+201000000000' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ message: 'OTP sent' });
    expect(db.otpRequest.updateMany).toHaveBeenCalledWith({ where: { phone: '+201000000000', used: false }, data: { used: true } });
    expect(db.otpRequest.create).toHaveBeenCalled();
    // invalidation must run before creation
    expect(db.otpRequest.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(db.otpRequest.create.mock.invocationCallOrder[0]);
    await app.close();
  });
});

describe('POST /auth/refresh', () => {
  it('401 on a garbage refresh token', async () => {
    const app = await buildApp({});
    const res = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refresh_token: 'not.a.jwt' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_REFRESH_TOKEN');
    await app.close();
  });

  // SECURITY REGRESSION GUARD — documents the token-type-confusion finding:
  // refresh is verified with the ACCESS secret, so an access token is wrongly
  // accepted here. When the fix lands (separate refresh secret + `type` claim),
  // flip this expectation to 401.
  it('CURRENTLY accepts an ACCESS token as a refresh token (token-type-confusion finding)', async () => {
    const app = await buildApp({});
    const accessToken = app.jwt.sign({ sub: 'u1', phone: '+201000000000', role: 'consumer' }, { expiresIn: '15m' });
    const res = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refresh_token: accessToken } });
    expect(res.statusCode).toBe(200);
    expect(res.json().access_token).toBeTruthy();
    await app.close();
  });
});
