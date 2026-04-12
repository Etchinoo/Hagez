// ============================================================
// SUPER RESERVATION PLATFORM — Firebase Admin Plugin
// Initialises Firebase Admin SDK for server-side ID-token
// verification (Firebase Phone Auth).
// Env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
//           FIREBASE_PRIVATE_KEY
// ============================================================

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    firebaseAuth: Auth | null;
  }
}

const firebasePlugin: FastifyPluginAsync = async (fastify) => {
  const projectId = env.FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    fastify.log.warn(
      '[firebase] FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not all set — Firebase Auth disabled'
    );
    fastify.decorate('firebaseAuth', null);
    return;
  }

  let app: App;
  if (getApps().length === 0) {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        // The PEM key is stored with literal "\n" in env — convert to real newlines
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    app = getApps()[0];
  }

  const auth = getAuth(app);
  fastify.decorate('firebaseAuth', auth);
  fastify.log.info('[firebase] Firebase Admin SDK initialised (project: %s)', projectId);
};

export default fp(firebasePlugin, { name: 'firebase' });
