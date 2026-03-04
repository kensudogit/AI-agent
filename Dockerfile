# ========== Build stage ==========
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Next.js の public が無い場合に備えて作成（COPY で必須のため）
RUN mkdir -p public
RUN npm run build

# ========== Production stage ==========
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/src/lib/schema.sql ./src/lib/schema.sql
COPY --from=builder /app/scripts/docker-init-db.mjs ./scripts/
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/

# entrypoint で DB 待ち・スキーマ初期化に pg が必要
RUN npm install pg --omit=dev && chown -R nextjs:nodejs /app

RUN chmod +x ./scripts/docker-entrypoint.sh

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
