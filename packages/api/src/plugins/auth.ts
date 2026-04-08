import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { JwtAccessPayload, UserRole } from '../types/index.js';

// @fastify/jwt v10: user payload is declared via FastifyJWT, not FastifyRequest
declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JwtAccessPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateOptional: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Strict auth — rejects unauthenticated requests
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify<JwtAccessPayload>();
    } catch (err) {
      reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
          message_ar: 'يجب تسجيل الدخول أولاً.',
        },
      });
    }
  });

  // Optional auth — sets request.user if token is valid, continues if not
  fastify.decorate('authenticateOptional', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify<JwtAccessPayload>();
    } catch {
      // No-op — unauthenticated requests are allowed
    }
  });

  // Role-based access control
  fastify.decorate(
    'requireRole',
    (roles: UserRole[]) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify<JwtAccessPayload>();
          const payload = request.user as JwtAccessPayload;
          if (!roles.includes(payload.role)) {
            reply.code(403).send({
              error: {
                code: 'FORBIDDEN',
                message: 'You do not have permission to perform this action.',
                message_ar: 'ليس لديك صلاحية للقيام بهذا الإجراء.',
              },
            });
          }
        } catch {
          reply.code(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required.',
              message_ar: 'يجب تسجيل الدخول أولاً.',
            },
          });
        }
      }
  );
};

export default fp(authPlugin, { name: 'auth', dependencies: ['@fastify/jwt'] });
