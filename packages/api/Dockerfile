FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY package.json package-lock.json .npmrc ./
COPY packages/api/package.json ./packages/api/

RUN npm ci

COPY packages/api/tsconfig.json ./packages/api/
COPY packages/api/prisma ./packages/api/prisma/
COPY packages/api/src ./packages/api/src/

WORKDIR /repo/packages/api
RUN npx prisma generate
RUN npm run build


FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

ENV NODE_ENV=production

COPY package.json package-lock.json .npmrc ./
COPY packages/api/package.json ./packages/api/

RUN npm ci --omit=dev

COPY --from=builder /repo/packages/api/node_modules/.prisma ./packages/api/node_modules/.prisma
COPY --from=builder /repo/packages/api/node_modules/@prisma ./packages/api/node_modules/@prisma
COPY --from=builder /repo/packages/api/dist ./packages/api/dist
COPY packages/api/prisma ./packages/api/prisma/

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nodejs && \
    chown -R nodejs:nodejs /repo

USER nodejs

WORKDIR /repo/packages/api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
